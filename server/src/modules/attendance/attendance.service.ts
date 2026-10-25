import { Request } from 'express';
import { Types } from 'mongoose';
import { getDistance } from 'geolib';
import { Attendance, IAttendanceDocument, AttendanceRulesSnapshot, AttendanceStatus } from './attendance.model';
import { AttendanceCorrection, IAttendanceCorrectionDocument } from './correction.model';
import { Employee } from '../employees/employee.model';
import { Settings } from '../settings/settings.model';
import { settingsService } from '../settings/settings.service';
import { holidayService } from '../holidays/holiday.service';
import { todayInCompanyTz, isWeekend, toDateKey } from '../../utils/date';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { sectionProviders } from '../employees/employee360.registry';
import {
  CheckInInput,
  CheckOutInput,
  CreateCorrectionInput,
  ApproveCorrectionInput,
  RejectCorrectionInput,
} from './attendance.schema';
import { IUserDocument } from '../users/user.model';

/**
 * Pure function to compute attendance status from check-in time, worked minutes, and rules.
 */
export function computeAttendanceStatus(
  checkInTimeStr: string,
  workedMinutes: number,
  rules: AttendanceRulesSnapshot
): AttendanceStatus {
  const [startH, startM] = rules.officeStart.split(':').map(Number);
  const lateCutoffMinutes = startH * 60 + startM + rules.graceMinutes;

  const [inH, inM] = checkInTimeStr.split(':').map(Number);
  const checkInMinutes = inH * 60 + inM;
  const isLate = checkInMinutes > lateCutoffMinutes;

  const halfDayMinutes = rules.halfDayHours * 60;
  if (workedMinutes > 0 && workedMinutes < halfDayMinutes) {
    return 'half_day';
  }

  return isLate ? 'late' : 'present';
}

export class AttendanceService {
  constructor() {
    // Register Attendance as a section provider for Employee 360
    sectionProviders.register('attendance', async (employeeId, _viewer) => {
      const today = todayInCompanyTz();
      const currentMonth = today.slice(0, 7);

      const [recentRecords, todayRecord] = await Promise.all([
        Attendance.find({
          employeeId: new Types.ObjectId(employeeId),
          dateKey: { $gte: `${currentMonth}-01` },
        })
          .sort({ dateKey: -1 })
          .limit(31)
          .lean(),
        Attendance.findOne({
          employeeId: new Types.ObjectId(employeeId),
          dateKey: today,
        }).lean(),
      ]);

      const lateCount = recentRecords.filter((r) => r.status === 'late').length;
      const presentCount = recentRecords.filter((r) => r.status === 'present' || r.status === 'late').length;
      const halfDayCount = recentRecords.filter((r) => r.status === 'half_day').length;

      return {
        month: currentMonth,
        presentDays: presentCount,
        lateDays: lateCount,
        halfDays: halfDayCount,
        today: todayRecord ? { status: todayRecord.status, checkInAt: todayRecord.checkInAt, checkOutAt: todayRecord.checkOutAt } : null,
      };
    });
  }

  /**
   * Validates camera location against office geofencing configuration.
   */
  private async validateCameraCheck(
    input: CheckInInput | CheckOutInput
  ): Promise<number | undefined> {
    if (input.source !== 'camera') {
      return undefined;
    }

    const settings = await Settings.findOne({ key: 'company' });
    if (!settings?.office?.lat || !settings?.office?.lng) {
      return undefined; // No office location enforced
    }

    if (input.faceCount !== 1) {
      throw new AppError(
        'Camera attendance requires exactly one verified face',
        422,
        'CAMERA_FACE_INVALID'
      );
    }

    if (input.accuracy !== undefined && input.accuracy > 100) {
      throw new AppError(
        'Location accuracy exceeds acceptable threshold (> 100m)',
        422,
        'LOCATION_ACCURACY_LOW'
      );
    }

    if (input.lat === undefined || input.lng === undefined) {
      throw new AppError(
        'Location coordinates are required for camera attendance',
        422,
        'LOCATION_REQUIRED'
      );
    }

    const distanceMeters = getDistance(
      { latitude: input.lat, longitude: input.lng },
      { latitude: settings.office.lat, longitude: settings.office.lng }
    );

    if (distanceMeters > settings.office.radiusMeters) {
      throw new AppError(
        `Outside authorized office boundary (${distanceMeters}m > ${settings.office.radiusMeters}m). Request an attendance correction instead.`,
        422,
        'GEOFENCE_VIOLATION',
        { distanceMeters, radiusMeters: settings.office.radiusMeters }
      );
    }

    return distanceMeters;
  }

  /**
   * Check in an employee for today.
   */
  async checkIn(
    employeeId: string,
    input: CheckInInput,
    req?: Request
  ): Promise<IAttendanceDocument> {
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.status === 'exited') {
      throw AppError.notFound('Employee profile not active or found');
    }

    const rules = await settingsService.getRulesSnapshot();
    const dateKey = todayInCompanyTz(rules.timezone);

    // 1. Second check-in on the same day returns 409
    const existing = await Attendance.findOne({
      employeeId: employee._id,
      dateKey,
    });
    if (existing) {
      throw AppError.conflict('Already checked in for today', { dateKey });
    }

    // 2. Reject on weekend
    if (isWeekend(dateKey, rules.weekendDays)) {
      throw new AppError('Cannot check in on a weekend day', 422, 'WEEKEND_DAY');
    }

    // 3. Reject on public holiday
    const holidayDates = await holidayService.getHolidayDateKeys(dateKey, dateKey);
    if (holidayDates.has(dateKey)) {
      throw new AppError('Cannot check in on a recognized public holiday', 422, 'PUBLIC_HOLIDAY');
    }

    // 4. Reject on approved leave day
    const { Leave } = await import('../leave/leave.model');
    const onLeave = await Leave.findOne({
      employeeId: employee._id,
      startDate: { $lte: dateKey },
      endDate: { $gte: dateKey },
      status: 'approved',
    });
    if (onLeave) {
      throw new AppError('Cannot check in on an approved leave day', 422, 'APPROVED_LEAVE_DAY');
    }

    // 5. Geofence distance calculation if camera
    const distanceMeters = await this.validateCameraCheck(input);

    const now = new Date();
    // Server checkIn time in company timezone HH:mm
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: rules.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const checkInTimeStr = timeFormatter.format(now);
    const initialStatus = computeAttendanceStatus(checkInTimeStr, 0, rules);

    const record = await Attendance.create({
      employeeId: employee._id,
      dateKey,
      checkInAt: now,
      status: initialStatus,
      workedMinutes: 0,
      source: input.source || 'web',
      location: {
        lat: input.lat,
        lng: input.lng,
        accuracy: input.accuracy,
        distanceMeters,
      },
      rulesSnapshot: rules,
    });

    await auditService.log({
      req,
      action: 'ATTENDANCE_CHECK_IN',
      entity: 'Attendance',
      entityId: record._id.toString(),
      after: {
        dateKey: record.dateKey,
        checkInAt: record.checkInAt,
        status: record.status,
        source: record.source,
      },
    });

    return record;
  }

  /**
   * Check out an employee for today.
   */
  async checkOut(
    employeeId: string,
    input: CheckOutInput,
    req?: Request
  ): Promise<IAttendanceDocument> {
    const rules = await settingsService.getRulesSnapshot();
    const dateKey = todayInCompanyTz(rules.timezone);

    const record = await Attendance.findOne({
      employeeId: new Types.ObjectId(employeeId),
      dateKey,
    });

    if (!record || !record.checkInAt) {
      throw AppError.badRequest('No check-in record found for today');
    }

    if (record.checkOutAt) {
      throw AppError.conflict('Already checked out for today');
    }

    const distanceMeters = await this.validateCameraCheck(input);

    const now = new Date();
    record.checkOutAt = now;

    // Calculate worked minutes
    const workedMinutes = Math.max(
      0,
      Math.floor((now.getTime() - record.checkInAt.getTime()) / (60 * 1000))
    );
    record.workedMinutes = workedMinutes;

    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: record.rulesSnapshot.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const checkInTimeStr = timeFormatter.format(record.checkInAt);

    // Recompute status (half_day vs present/late)
    record.status = computeAttendanceStatus(checkInTimeStr, workedMinutes, record.rulesSnapshot);

    if (input.lat !== undefined && input.lng !== undefined) {
      record.location = {
        lat: input.lat,
        lng: input.lng,
        accuracy: input.accuracy,
        distanceMeters,
      };
    }

    await record.save();

    await auditService.log({
      req,
      action: 'ATTENDANCE_CHECK_OUT',
      entity: 'Attendance',
      entityId: record._id.toString(),
      after: {
        checkOutAt: record.checkOutAt,
        workedMinutes: record.workedMinutes,
        status: record.status,
      },
    });

    return record;
  }

  /**
   * Returns current employee's widget state for today.
   */
  async getToday(employeeId: string): Promise<{
    dateKey: string;
    record: IAttendanceDocument | null;
    rules: AttendanceRulesSnapshot;
  }> {
    const rules = await settingsService.getRulesSnapshot();
    const dateKey = todayInCompanyTz(rules.timezone);

    const record = await Attendance.findOne({
      employeeId: new Types.ObjectId(employeeId),
      dateKey,
    });

    return {
      dateKey,
      record,
      rules,
    };
  }

  /**
   * Returns calendar month attendance data for an employee.
   */
  async getMy(
    employeeId: string,
    month?: string
  ): Promise<IAttendanceDocument[]> {
    const rules = await settingsService.getRulesSnapshot();
    const targetMonth = month || todayInCompanyTz(rules.timezone).slice(0, 7);

    return Attendance.find({
      employeeId: new Types.ObjectId(employeeId),
      dateKey: { $regex: new RegExp(`^${targetMonth}`) },
    }).sort({ dateKey: 1 });
  }

  /**
   * Attendance board for HR and Admin showing all expected employees on a date.
   */
  async getBoard(
    dateKey: string,
    departmentId?: string,
    statusFilter?: string,
    page = 1,
    limit = 50
  ) {
    const rules = await settingsService.getRulesSnapshot();
    const today = todayInCompanyTz(rules.timezone);

    // 1. Find all active employees who joined on or before dateKey
    const empFilter: Record<string, any> = {
      joiningDate: { $lte: dateKey },
      status: { $ne: 'exited' },
    };
    if (departmentId) {
      empFilter.departmentId = new Types.ObjectId(departmentId);
    }

    const employees = await Employee.find(empFilter)
      .populate('departmentId', 'name code')
      .populate('designationId', 'title')
      .lean();

    const empIds = employees.map((e) => e._id);

    // 2. Load attendance records, leaves, holidays
    const [attendanceRecords, leaves, holidayDates] = await Promise.all([
      Attendance.find({ employeeId: { $in: empIds }, dateKey }).lean(),
      (await import('../leave/leave.model')).Leave.find({
        employeeId: { $in: empIds },
        startDate: { $lte: dateKey },
        endDate: { $gte: dateKey },
        status: 'approved',
      }).lean(),
      holidayService.getHolidayDateKeys(dateKey, dateKey),
    ]);

    const attMap = new Map<string, any>();
    attendanceRecords.forEach((r) => attMap.set(r.employeeId.toString(), r));

    const leaveMap = new Map<string, any>();
    leaves.forEach((l) => leaveMap.set(l.employeeId.toString(), l));

    const isHolidayDay = holidayDates.has(dateKey);
    const isWeekendDay = isWeekend(dateKey, rules.weekendDays);

    // 3. Compute live expected status for every employee
    const boardItems = employees.map((emp) => {
      const att = attMap.get(emp._id.toString());
      const onLeave = leaveMap.get(emp._id.toString());

      let resolvedStatus: string;
      if (att) {
        if (!att.checkOutAt && dateKey < today) {
          resolvedStatus = 'missing_checkout';
        } else {
          resolvedStatus = att.status;
        }
      } else if (onLeave) {
        resolvedStatus = 'on_leave';
      } else if (isHolidayDay) {
        resolvedStatus = 'holiday';
      } else if (isWeekendDay) {
        resolvedStatus = 'weekend';
      } else if (dateKey < today) {
        resolvedStatus = 'absent';
      } else {
        resolvedStatus = 'absent'; // Not yet checked in
      }

      return {
        employee: {
          _id: emp._id,
          employeeCode: emp.employeeCode,
          name: emp.name,
          department: emp.departmentId,
          designation: emp.designationId,
        },
        attendance: att || null,
        status: resolvedStatus,
      };
    });

    const filtered = statusFilter
      ? boardItems.filter((i) => i.status === statusFilter)
      : boardItems;

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return {
      items: paginated,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Submit an attendance correction request.
   */
  async createCorrection(
    employeeId: string,
    input: CreateCorrectionInput,
    _req?: Request
  ): Promise<IAttendanceCorrectionDocument> {
    // Check if pending correction already exists
    const existing = await AttendanceCorrection.findOne({
      employeeId: new Types.ObjectId(employeeId),
      dateKey: input.dateKey,
      status: 'pending',
    });

    if (existing) {
      throw AppError.conflict(
        `A pending correction request already exists for ${input.dateKey}`
      );
    }

    const correction = await AttendanceCorrection.create({
      employeeId: new Types.ObjectId(employeeId),
      dateKey: input.dateKey,
      requestedCheckIn: input.requestedCheckIn,
      requestedCheckOut: input.requestedCheckOut,
      reason: input.reason,
      status: 'pending',
    });

    // Notify HR users
    const { notificationService } = await import('../comms/notification.service');
    const employee = await Employee.findById(employeeId);
    await notificationService.notifyRole('hr', {
      type: 'attendance_correction_submitted',
      title: 'New Attendance Correction Request',
      message: `${employee?.name || 'An employee'} submitted a correction for ${input.dateKey}`,
      link: '/attendance/corrections',
    });

    return correction;
  }

  /**
   * List correction requests with scoping.
   */
  async listCorrections(
    viewer: { role: string; employeeId?: Types.ObjectId | string },
    statusFilter?: string,
    page = 1,
    limit = 50
  ) {
    const filter: Record<string, any> = {};
    if (viewer.role === 'employee') {
      filter.employeeId = new Types.ObjectId(viewer.employeeId);
    }
    if (statusFilter) {
      filter.status = statusFilter;
    }

    const skip = (page - 1) * limit;
    const [corrections, total] = await Promise.all([
      AttendanceCorrection.find(filter)
        .populate('employeeId', 'employeeCode name')
        .populate('decidedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      AttendanceCorrection.countDocuments(filter),
    ]);

    return {
      corrections,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Approve a correction request (HR only).
   */
  async approveCorrection(
    correctionId: string,
    approver: IUserDocument,
    input: ApproveCorrectionInput,
    req?: Request
  ): Promise<IAttendanceCorrectionDocument> {
    const correction = await AttendanceCorrection.findById(correctionId);
    if (!correction) {
      throw AppError.notFound('AttendanceCorrection');
    }

    if (correction.status !== 'pending') {
      throw AppError.badRequest(`Correction is already ${correction.status}`);
    }

    correction.status = 'approved';
    correction.decidedBy = approver._id;
    correction.decisionComment = input.comment;
    correction.decidedAt = new Date();
    await correction.save();

    // Reconstruct or update the Attendance record with source='correction'
    const rules = await settingsService.getRulesSnapshot();
    const [inH, inM] = correction.requestedCheckIn.split(':').map(Number);
    const [year, month, day] = correction.dateKey.split('-').map(Number);

    const checkInAt = new Date(Date.UTC(year, month - 1, day, inH, inM));
    let checkOutAt: Date | undefined;
    let workedMinutes = 0;

    if (correction.requestedCheckOut) {
      const [outH, outM] = correction.requestedCheckOut.split(':').map(Number);
      checkOutAt = new Date(Date.UTC(year, month - 1, day, outH, outM));
      workedMinutes = Math.max(0, Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / (60 * 1000)));
    }

    const status = computeAttendanceStatus(correction.requestedCheckIn, workedMinutes, rules);

    await Attendance.findOneAndUpdate(
      { employeeId: correction.employeeId, dateKey: correction.dateKey },
      {
        checkInAt,
        checkOutAt,
        workedMinutes,
        status,
        source: 'correction',
        rulesSnapshot: rules,
      },
      { upsert: true, new: true }
    );

    // Notify employee
    const { notificationService } = await import('../comms/notification.service');
    const emp = await Employee.findById(correction.employeeId);
    if (emp?.userId) {
      await notificationService.createNotification({
        userId: emp.userId,
        type: 'attendance_correction_approved',
        title: 'Attendance Correction Approved',
        message: `Your correction for ${correction.dateKey} was approved`,
        link: '/attendance',
      });
    }

    await auditService.log({
      req,
      action: 'ATTENDANCE_CORRECTION_APPROVED',
      entity: 'AttendanceCorrection',
      entityId: correction._id.toString(),
      after: {
        dateKey: correction.dateKey,
        status: 'approved',
        decidedBy: approver.name,
      },
    });

    return correction;
  }

  /**
   * Reject a correction request (HR only).
   */
  async rejectCorrection(
    correctionId: string,
    approver: IUserDocument,
    input: RejectCorrectionInput,
    req?: Request
  ): Promise<IAttendanceCorrectionDocument> {
    const correction = await AttendanceCorrection.findById(correctionId);
    if (!correction) {
      throw AppError.notFound('AttendanceCorrection');
    }

    if (correction.status !== 'pending') {
      throw AppError.badRequest(`Correction is already ${correction.status}`);
    }

    correction.status = 'rejected';
    correction.decidedBy = approver._id;
    correction.decisionComment = input.comment;
    correction.decidedAt = new Date();
    await correction.save();

    // Notify employee
    const { notificationService } = await import('../comms/notification.service');
    const emp = await Employee.findById(correction.employeeId);
    if (emp?.userId) {
      await notificationService.createNotification({
        userId: emp.userId,
        type: 'attendance_correction_rejected',
        title: 'Attendance Correction Rejected',
        message: `Your correction for ${correction.dateKey} was rejected: ${input.comment}`,
        link: '/attendance',
      });
    }

    await auditService.log({
      req,
      action: 'ATTENDANCE_CORRECTION_REJECTED',
      entity: 'AttendanceCorrection',
      entityId: correction._id.toString(),
      after: {
        dateKey: correction.dateKey,
        status: 'rejected',
        decidedBy: approver.name,
        comment: input.comment,
      },
    });

    return correction;
  }
}

export const attendanceService = new AttendanceService();

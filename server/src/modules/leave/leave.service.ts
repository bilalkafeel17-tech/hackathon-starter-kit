import { Request } from 'express';
import { Types } from 'mongoose';
import { Leave, ILeaveDocument } from './leave.model';
import { LeaveType, ILeaveType } from '../leave-types/leave-type.model';
import { Employee } from '../employees/employee.model';
import { settingsService } from '../settings/settings.service';
import { holidayService } from '../holidays/holiday.service';
import { countWorkingDays, listWorkingDays } from '../../utils/workingDays';
import { todayInCompanyTz, isValidDateKey } from '../../utils/date';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { sectionProviders } from '../employees/employee360.registry';
import { ApplyLeaveInput } from './leave.schema';
import { IUserDocument } from '../users/user.model';
import { Attendance } from '../attendance/attendance.model';

export class LeaveService {
  constructor() {
    // Register Leave as an Employee 360 section provider
    sectionProviders.register('leave', async (employeeId, _viewer) => {
      const currentYear = Number(todayInCompanyTz().slice(0, 4));
      const balances = await this.getBalances(employeeId, currentYear);
      const recentLeaves = await Leave.find({
        employeeId: new Types.ObjectId(employeeId),
      })
        .populate('leaveTypeId', 'name code isPaid')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      return {
        year: currentYear,
        balances,
        recentLeaves,
      };
    });
  }

  /**
   * Computes number of working days between two dates, excluding company weekends and holidays.
   */
  async computeWorkingDays(startDate: string, endDate: string): Promise<number> {
    const rules = await settingsService.getRulesSnapshot();
    const holidaySet = await holidayService.getHolidayDateKeys(startDate, endDate);
    return countWorkingDays(startDate, endDate, rules.weekendDays, holidaySet);
  }

  /**
   * Returns list of working date keys between two dates.
   */
  async listWorkingDates(startDate: string, endDate: string): Promise<string[]> {
    const rules = await settingsService.getRulesSnapshot();
    const holidaySet = await holidayService.getHolidayDateKeys(startDate, endDate);
    return listWorkingDays(startDate, endDate, rules.weekendDays, holidaySet);
  }

  /**
   * Retrieves leave balances per leave type for an employee in a given year.
   */
  async getBalances(employeeId: string, year?: number) {
    const currentYear = year || Number(todayInCompanyTz().slice(0, 4));
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    const leaveTypes = await LeaveType.find({ isActive: true }).sort({ name: 1 });
    const leaves = await Leave.find({
      employeeId: new Types.ObjectId(employeeId),
      startDate: { $lte: yearEnd },
      endDate: { $gte: yearStart },
      status: { $in: ['approved', 'pending'] },
    });

    return leaveTypes.map((type) => {
      const typeLeaves = leaves.filter((l) => l.leaveTypeId.toString() === type._id.toString());
      const approvedDays = typeLeaves
        .filter((l) => l.status === 'approved')
        .reduce((sum, l) => sum + l.workingDays, 0);
      const pendingDays = typeLeaves
        .filter((l) => l.status === 'pending')
        .reduce((sum, l) => sum + l.workingDays, 0);

      const quota = type.yearlyQuota;
      const remaining = quota !== null ? Math.max(0, quota - approvedDays) : null;

      return {
        leaveType: {
          _id: type._id,
          name: type.name,
          code: type.code,
          isPaid: type.isPaid,
          yearlyQuota: type.yearlyQuota,
        },
        quota,
        used: approvedDays,
        pending: pendingDays,
        remaining,
      };
    });
  }

  /**
   * Submits a leave application with overlap, past-date, and balance validation.
   */
  async applyLeave(
    employeeId: string,
    input: ApplyLeaveInput,
    req?: Request
  ): Promise<ILeaveDocument> {
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.status === 'exited') {
      throw AppError.notFound('Employee profile not found or already exited');
    }

    const leaveType = await LeaveType.findOne({ _id: input.leaveTypeId, isActive: true });
    if (!leaveType) {
      throw AppError.unprocessable('Leave type does not exist or is inactive', [
        { field: 'leaveTypeId', message: 'Invalid leave type' },
      ]);
    }

    // 1. Past date limit: start date in the past is allowed only up to 7 days back
    const today = todayInCompanyTz();
    const [tY, tM, tD] = today.split('-').map(Number);
    const pastLimitDate = new Date(Date.UTC(tY, tM - 1, tD - 7)).toISOString().slice(0, 10);

    if (input.startDate < pastLimitDate) {
      throw AppError.unprocessable(
        `Leave cannot be requested more than 7 days in the past (earliest allowed: ${pastLimitDate})`,
        [{ field: 'startDate', message: 'Date precedes 7-day retroactive application limit' }]
      );
    }

    // 2. Compute working days (excluding weekends and public holidays)
    const workingDaysCount = await this.computeWorkingDays(input.startDate, input.endDate);
    if (workingDaysCount === 0) {
      throw AppError.unprocessable(
        'Selected leave range contains zero working days (falls entirely on weekends or public holidays)',
        [{ field: 'startDate', message: 'No working days in selected range' }]
      );
    }

    // 3. Overlapping leave check (pending or approved leaves)
    const overlapping = await Leave.findOne({
      employeeId: employee._id,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: input.endDate },
      endDate: { $gte: input.startDate },
    });

    if (overlapping) {
      throw AppError.unprocessable(
        `Leave request overlaps with an existing ${overlapping.status} leave from ${overlapping.startDate} to ${overlapping.endDate}`,
        [{ field: 'startDate', message: 'Overlapping leave application' }]
      );
    }

    // 4. Balance check (for paid/quota-based leave types)
    if (leaveType.yearlyQuota !== null) {
      const year = Number(input.startDate.slice(0, 4));
      const balances = await this.getBalances(employeeId, year);
      const targetBalance = balances.find((b) => b.leaveType._id.toString() === leaveType._id.toString());
      const remaining = targetBalance?.remaining ?? 0;

      if (workingDaysCount > remaining) {
        throw AppError.unprocessable(
          `Insufficient leave balance. Remaining: ${remaining} day(s), requested: ${workingDaysCount} day(s)`,
          [{ field: 'leaveTypeId', message: `Exceeds remaining quota (${remaining} days available)` }]
        );
      }
    }

    const leave = await Leave.create({
      employeeId: employee._id,
      leaveTypeId: leaveType._id,
      startDate: input.startDate,
      endDate: input.endDate,
      workingDays: workingDaysCount,
      reason: input.reason.trim(),
      status: 'pending',
    });

    // Notify HR users
    const { notificationService } = await import('../comms/notification.service');
    await notificationService.notifyRole('hr', {
      type: 'leave_submitted',
      title: 'New Leave Request',
      message: `${employee.name} applied for ${leaveType.name} (${workingDaysCount} day${workingDaysCount > 1 ? 's' : ''})`,
      link: '/leaves',
    });

    await auditService.log({
      req,
      action: 'LEAVE_APPLIED',
      entity: 'Leave',
      entityId: leave._id.toString(),
      after: {
        employeeName: employee.name,
        leaveType: leaveType.name,
        startDate: leave.startDate,
        endDate: leave.endDate,
        workingDays: leave.workingDays,
      },
    });

    return leave;
  }

  /**
   * Cancels a pending leave, or an approved leave if the start date is still in the future.
   */
  async cancelLeave(
    leaveId: string,
    employeeId: string,
    req?: Request
  ): Promise<ILeaveDocument> {
    const leave = await Leave.findOne({
      _id: leaveId,
      employeeId: new Types.ObjectId(employeeId),
    });

    if (!leave) {
      throw AppError.notFound('Leave application');
    }

    if (leave.status === 'cancelled' || leave.status === 'rejected') {
      throw AppError.badRequest(`Leave is already ${leave.status}`);
    }

    const today = todayInCompanyTz();
    if (leave.status === 'approved' && leave.startDate <= today) {
      throw AppError.badRequest(
        'Cannot cancel an approved leave that has already started or taken place'
      );
    }

    const before = { status: leave.status };
    leave.status = 'cancelled';
    await leave.save();

    await auditService.log({
      req,
      action: 'LEAVE_CANCELLED',
      entity: 'Leave',
      entityId: leave._id.toString(),
      before,
      after: { status: leave.status },
    });

    return leave;
  }

  /**
   * Approves a leave request (HR only). Re-verifies balance at approval time.
   */
  async approveLeave(
    leaveId: string,
    approver: IUserDocument,
    comment?: string,
    req?: Request
  ): Promise<ILeaveDocument> {
    const leave = await Leave.findById(leaveId).populate('leaveTypeId');
    if (!leave) {
      throw AppError.notFound('Leave application');
    }

    if (leave.status !== 'pending') {
      throw AppError.badRequest(`Cannot approve leave with status '${leave.status}'`);
    }

    const leaveType = leave.leaveTypeId as unknown as ILeaveType;

    // Recheck balance at approval time
    if (leaveType.yearlyQuota !== null) {
      const year = Number(leave.startDate.slice(0, 4));
      const balances = await this.getBalances(leave.employeeId.toString(), year);
      const targetBalance = balances.find((b) => b.leaveType._id.toString() === leaveType._id.toString());
      const remaining = targetBalance?.remaining ?? 0;

      if (leave.workingDays > remaining) {
        throw AppError.unprocessable(
          `Cannot approve: employee's remaining quota is ${remaining} day(s), but this leave requires ${leave.workingDays} day(s)`
        );
      }
    }

    const before = { status: leave.status };
    leave.status = 'approved';
    leave.decidedBy = approver._id;
    leave.decisionComment = comment;
    leave.decidedAt = new Date();
    await leave.save();

    // Mark attendance records as on_leave for all working days in range
    const workingDates = await this.listWorkingDates(leave.startDate, leave.endDate);
    const rules = await settingsService.getRulesSnapshot();

    for (const dKey of workingDates) {
      await Attendance.findOneAndUpdate(
        { employeeId: leave.employeeId, dateKey: dKey },
        {
          status: 'on_leave',
          source: 'web',
          rulesSnapshot: rules,
        },
        { upsert: true, new: true }
      );
    }

    // Notify employee
    const { notificationService } = await import('../comms/notification.service');
    const emp = await Employee.findById(leave.employeeId);
    if (emp?.userId) {
      await notificationService.createNotification({
        userId: emp.userId,
        type: 'leave_approved',
        title: 'Leave Approved',
        message: `Your ${leaveType.name} request for ${leave.startDate} to ${leave.endDate} was approved`,
        link: '/leaves',
      });
    }

    await auditService.log({
      req,
      action: 'LEAVE_APPROVED',
      entity: 'Leave',
      entityId: leave._id.toString(),
      before,
      after: {
        status: leave.status,
        decidedBy: approver.name,
        comment,
      },
    });

    return leave;
  }

  /**
   * Rejects a leave request (HR only).
   */
  async rejectLeave(
    leaveId: string,
    approver: IUserDocument,
    comment: string,
    req?: Request
  ): Promise<ILeaveDocument> {
    const leave = await Leave.findById(leaveId).populate('leaveTypeId');
    if (!leave) {
      throw AppError.notFound('Leave application');
    }

    if (leave.status !== 'pending') {
      throw AppError.badRequest(`Cannot reject leave with status '${leave.status}'`);
    }

    const before = { status: leave.status };
    leave.status = 'rejected';
    leave.decidedBy = approver._id;
    leave.decisionComment = comment.trim();
    leave.decidedAt = new Date();
    await leave.save();

    // Notify employee
    const { notificationService } = await import('../comms/notification.service');
    const emp = await Employee.findById(leave.employeeId);
    const leaveType = leave.leaveTypeId as unknown as ILeaveType;
    if (emp?.userId) {
      await notificationService.createNotification({
        userId: emp.userId,
        type: 'leave_rejected',
        title: 'Leave Rejected',
        message: `Your ${leaveType?.name || 'leave'} request was rejected: ${comment}`,
        link: '/leaves',
      });
    }

    await auditService.log({
      req,
      action: 'LEAVE_REJECTED',
      entity: 'Leave',
      entityId: leave._id.toString(),
      before,
      after: {
        status: leave.status,
        decidedBy: approver.name,
        comment,
      },
    });

    return leave;
  }

  /**
   * Lists leaves with filtering and scoping.
   */
  async listLeaves(
    viewer: { role: string; employeeId?: Types.ObjectId | string },
    filters: {
      status?: string;
      employeeId?: string;
      departmentId?: string;
      leaveTypeId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const query: Record<string, any> = {};

    if (viewer.role === 'employee') {
      query.employeeId = new Types.ObjectId(viewer.employeeId);
    } else {
      if (filters.employeeId) query.employeeId = new Types.ObjectId(filters.employeeId);
      if (filters.leaveTypeId) query.leaveTypeId = new Types.ObjectId(filters.leaveTypeId);
      if (filters.status) query.status = filters.status;
      if (filters.departmentId) {
        const emps = await Employee.find({ departmentId: new Types.ObjectId(filters.departmentId) }).select('_id');
        query.employeeId = { $in: emps.map((e) => e._id) };
      }
      if (filters.from || filters.to) {
        if (filters.from && filters.to) {
          query.startDate = { $lte: filters.to };
          query.endDate = { $gte: filters.from };
        } else if (filters.from) {
          query.endDate = { $gte: filters.from };
        } else if (filters.to) {
          query.startDate = { $lte: filters.to };
        }
      }
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 50));
    const skip = (page - 1) * limit;

    const [leaves, total] = await Promise.all([
      Leave.find(query)
        .populate('employeeId', 'employeeCode name email')
        .populate('leaveTypeId', 'name code isPaid')
        .populate('decidedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Leave.countDocuments(query),
    ]);

    return {
      leaves,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export const leaveService = new LeaveService();

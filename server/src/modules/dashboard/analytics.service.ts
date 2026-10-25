import { Types } from 'mongoose';
import { Employee } from '../employees/employee.model';
import { Attendance } from '../attendance/attendance.model';
import { AttendanceCorrection } from '../attendance/correction.model';
import { Leave } from '../leave/leave.model';
import { LeaveType } from '../leave-types/leave-type.model';
import { PayrollRun, PayrollItem } from '../payroll/payroll.model';
import { Department } from '../departments/department.model';
import { AuditLog } from '../audit/audit.model';
import { Announcement } from '../comms/announcement.model';
import { orgService } from '../org/org.service';
import { leaveService } from '../leave/leave.service';
import { todayInCompanyTz, listDateKeys } from '../../utils/date';
import { settingsService } from '../settings/settings.service';
import { holidayService } from '../holidays/holiday.service';
import { countWorkingDays } from '../../utils/workingDays';

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  departmentId?: string;
}

export class AnalyticsService {
  /**
   * Headcount metric: active + probation employees on given date.
   */
  async getHeadcount(asOfDate?: string, departmentId?: string): Promise<number> {
    const targetDate = asOfDate || todayInCompanyTz();
    const query: Record<string, any> = {
      joiningDate: { $lte: targetDate },
      $or: [{ exitDate: { $exists: false } }, { exitDate: null }, { exitDate: { $gt: targetDate } }],
      status: { $in: ['active', 'probation'] },
    };
    if (departmentId) {
      query.departmentId = new Types.ObjectId(departmentId);
    }
    return Employee.countDocuments(query);
  }

  /**
   * Attrition Rate YTD: (exits in year / average headcount) * 100
   */
  async getAttritionYtd(year?: number): Promise<number> {
    const currentYear = year || Number(todayInCompanyTz().slice(0, 4));
    const startOfYear = `${currentYear}-01-01`;
    const today = todayInCompanyTz();

    const [startHeadcount, currentHeadcount, exits] = await Promise.all([
      this.getHeadcount(startOfYear),
      this.getHeadcount(today),
      Employee.countDocuments({
        exitDate: { $gte: startOfYear, $lte: today },
        status: 'exited',
      }),
    ]);

    const avgHeadcount = (startHeadcount + currentHeadcount) / 2;
    if (avgHeadcount === 0) return 0;

    return Math.round((exits / avgHeadcount) * 100 * 10) / 10;
  }

  /**
   * Aggregates attendance metrics across date range.
   */
  async getAttendanceSummary(filters: AnalyticsFilters = {}) {
    const today = todayInCompanyTz();
    const from = filters.from || `${today.slice(0, 7)}-01`;
    const to = filters.to || today;

    const match: Record<string, any> = {
      dateKey: { $gte: from, $lte: to },
    };

    if (filters.departmentId) {
      const emps = await Employee.find({ departmentId: new Types.ObjectId(filters.departmentId) }).select('_id');
      match.employeeId = { $in: emps.map((e) => e._id) };
    }

    const counts = await Attendance.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const map = new Map<string, number>();
    counts.forEach((c) => map.set(c._id, c.count));

    const present = map.get('present') || 0;
    const late = map.get('late') || 0;
    const halfDay = map.get('half_day') || 0;
    const missingCheckout = map.get('missing_checkout') || 0;
    const onLeave = map.get('on_leave') || 0;

    const totalAttendanceDays = present + late + halfDay + missingCheckout;
    const effectivePresent = present + late + missingCheckout + 0.5 * halfDay;
    const rate = totalAttendanceDays > 0 ? Math.round((effectivePresent / totalAttendanceDays) * 100 * 10) / 10 : 100;
    const latePercent = present + late > 0 ? Math.round((late / (present + late)) * 100 * 10) / 10 : 0;

    return {
      from,
      to,
      present,
      late,
      halfDay,
      missingCheckout,
      onLeave,
      rate,
      latePercent,
    };
  }

  /**
   * Top 5 employees with late arrivals in period.
   */
  async getTopLateComers(filters: AnalyticsFilters = {}) {
    const today = todayInCompanyTz();
    const from = filters.from || `${today.slice(0, 7)}-01`;
    const to = filters.to || today;

    const match: Record<string, any> = {
      dateKey: { $gte: from, $lte: to },
      status: 'late',
    };

    if (filters.departmentId) {
      const emps = await Employee.find({ departmentId: new Types.ObjectId(filters.departmentId) }).select('_id');
      match.employeeId = { $in: emps.map((e) => e._id) };
    }

    const aggregated = await Attendance.aggregate([
      { $match: match },
      { $group: { _id: '$employeeId', lateCount: { $sum: 1 } } },
      { $sort: { lateCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: '$employee' },
      {
        $lookup: {
          from: 'departments',
          localField: 'employee.departmentId',
          foreignField: '_id',
          as: 'department',
        },
      },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          lateCount: 1,
          employeeCode: '$employee.employeeCode',
          name: '$employee.name',
          departmentName: '$department.name',
        },
      },
    ]);

    return aggregated;
  }

  /**
   * HR Dashboard aggregation endpoint.
   */
  async getHrDashboard(filters: AnalyticsFilters = {}) {
    const today = todayInCompanyTz();
    const currentMonth = today.slice(0, 7);

    const [
      headcount,
      todayRecords,
      pendingLeaves,
      pendingCorrections,
      attendanceSummary,
      topLateComers,
      departments,
    ] = await Promise.all([
      this.getHeadcount(today, filters.departmentId),
      Attendance.find({ dateKey: today }),
      Leave.countDocuments({ status: 'pending' }),
      AttendanceCorrection.countDocuments({ status: 'pending' }),
      this.getAttendanceSummary(filters),
      this.getTopLateComers(filters),
      Department.find({ isActive: true }).lean(),
    ]);

    const presentToday = todayRecords.filter((r) => r.status === 'present' || r.status === 'late').length;
    const lateToday = todayRecords.filter((r) => r.status === 'late').length;
    const onLeaveToday = todayRecords.filter((r) => r.status === 'on_leave').length;

    // Leave usage by type
    const leaveUsage = await Leave.aggregate([
      { $match: { status: 'approved', startDate: { $regex: new RegExp(`^${currentMonth}`) } } },
      { $group: { _id: '$leaveTypeId', days: { $sum: '$workingDays' }, count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'leavetypes',
          localField: '_id',
          foreignField: '_id',
          as: 'type',
        },
      },
      { $unwind: '$type' },
      { $project: { name: '$type.name', days: 1, count: 1 } },
    ]);

    // Pending approvals quick list
    const [recentPendingLeaves, recentPendingCorrections] = await Promise.all([
      Leave.find({ status: 'pending' })
        .populate('employeeId', 'name employeeCode')
        .populate('leaveTypeId', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      AttendanceCorrection.find({ status: 'pending' })
        .populate('employeeId', 'name employeeCode')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    return {
      kpis: {
        headcount,
        presentToday,
        lateToday,
        onLeaveToday,
        pendingApprovals: pendingLeaves + pendingCorrections,
        pendingLeaves,
        pendingCorrections,
        attendanceRate: attendanceSummary.rate,
        latePercent: attendanceSummary.latePercent,
      },
      topLateComers,
      leaveUsage,
      pendingItems: {
        leaves: recentPendingLeaves,
        corrections: recentPendingCorrections,
      },
    };
  }

  /**
   * Admin Dashboard aggregation endpoint.
   */
  async getAdminDashboard(filters: AnalyticsFilters = {}) {
    const today = todayInCompanyTz();
    const currentMonth = today.slice(0, 7);

    const [
      headcount,
      attritionYtd,
      readiness,
      recentAuditLogs,
      activeAnnouncements,
      departments,
    ] = await Promise.all([
      this.getHeadcount(today, filters.departmentId),
      this.getAttritionYtd(),
      orgService.getReadiness(),
      AuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
      Announcement.find().sort({ isPinned: -1, createdAt: -1 }).limit(5).lean(),
      Department.find({ isActive: true }).lean(),
    ]);

    // Headcount by department
    const deptHeadcounts = await Promise.all(
      departments.map(async (d) => ({
        departmentId: d._id,
        name: d.name,
        count: await Employee.countDocuments({
          departmentId: d._id,
          status: { $in: ['active', 'probation'] },
        }),
      }))
    );

    // Latest payroll run costs
    const latestRun = await PayrollRun.findOne({ status: 'finalized' }).sort({ month: -1 });
    const draftRun = !latestRun ? await PayrollRun.findOne({ status: 'draft' }).sort({ month: -1 }) : null;
    const activeRun = latestRun || draftRun;

    const payrollCost = activeRun?.totals?.gross || 0;
    const avgSalary = activeRun?.totals?.employeeCount
      ? Math.round((activeRun.totals.gross / activeRun.totals.employeeCount) * 100) / 100
      : 0;

    // Gender split
    const genderSplitAgg = await Employee.aggregate([
      { $match: { status: { $in: ['active', 'probation'] } } },
      { $group: { _id: '$gender', count: { $sum: 1 } } },
    ]);
    const genderSplit = {
      male: genderSplitAgg.find((g) => g._id === 'male')?.count || 0,
      female: genderSplitAgg.find((g) => g._id === 'female')?.count || 0,
      other: genderSplitAgg.find((g) => g._id === 'other')?.count || 0,
    };

    return {
      kpis: {
        headcount,
        attritionYtd,
        payrollCost,
        avgSalary,
        activeEmployees: headcount,
      },
      headcountByDepartment: deptHeadcounts,
      genderSplit,
      readiness,
      recentAuditLogs,
      activeAnnouncements,
    };
  }

  /**
   * Employee Dashboard aggregation endpoint.
   */
  async getEmployeeDashboard(employeeId: string, _userId: string) {
    const today = todayInCompanyTz();
    const currentMonth = today.slice(0, 7);

    const [todayRecord, monthRecords, balances, lastPayslip, announcements] =
      await Promise.all([
        Attendance.findOne({
          employeeId: new Types.ObjectId(employeeId),
          dateKey: today,
        }).lean(),
        Attendance.find({
          employeeId: new Types.ObjectId(employeeId),
          dateKey: { $regex: new RegExp(`^${currentMonth}`) },
        }).lean(),
        leaveService.getBalances(employeeId),
        PayrollItem.findOne({
          employeeId: new Types.ObjectId(employeeId),
        })
          .populate('runId', 'month status')
          .sort({ createdAt: -1 })
          .lean(),
        Announcement.find().sort({ isPinned: -1, createdAt: -1 }).limit(3).lean(),
      ]);

    const lateCount = monthRecords.filter((r) => r.status === 'late').length;

    // Hours this week
    const todayDate = new Date();
    const dayOfWeek = todayDate.getUTCDay(); // 0 is Sunday
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayDate = new Date(todayDate);
    mondayDate.setUTCDate(todayDate.getUTCDate() + mondayOffset);
    const mondayKey = mondayDate.toISOString().slice(0, 10);

    const weekRecords = monthRecords.filter((r) => r.dateKey >= mondayKey);
    const totalMinutesThisWeek = weekRecords.reduce((sum, r) => sum + (r.workedMinutes || 0), 0);
    const hoursThisWeek = Math.round((totalMinutesThisWeek / 60) * 10) / 10;

    return {
      todayAttendance: todayRecord,
      hoursThisWeek,
      lateCountThisMonth: lateCount,
      leaveBalances: balances,
      lastPayslip: (lastPayslip?.runId as any)?.status === 'finalized' ? lastPayslip : null,
      announcements,
    };
  }
}

export const analyticsService = new AnalyticsService();

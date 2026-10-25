import { Request } from 'express';
import { Types } from 'mongoose';
import { PayrollRun, PayrollItem, IPayrollRunDocument, IPayrollItemDocument } from './payroll.model';
import { Employee } from '../employees/employee.model';
import { salaryService } from '../employees/salary.service';
import { settingsService } from '../settings/settings.service';
import { holidayService } from '../holidays/holiday.service';
import { countWorkingDays, listWorkingDays } from '../../utils/workingDays';
import { calculateMonthlyTax } from '../../utils/tax';
import { todayInCompanyTz } from '../../utils/date';
import { generatePayslipPdf } from './payslip.pdf';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { sectionProviders } from '../employees/employee360.registry';
import { IUserDocument } from '../users/user.model';
import { Attendance } from '../attendance/attendance.model';
import { Leave } from '../leave/leave.model';

export class PayrollService {
  constructor() {
    // Register Payroll as an Employee 360 section provider (HR and Admin only)
    sectionProviders.register('payroll', async (employeeId, viewer) => {
      if (viewer.role === 'employee') {
        return null; // Salary and payroll details strictly hidden from employees in 360
      }

      const recentItems = await PayrollItem.find({
        employeeId: new Types.ObjectId(employeeId),
      })
        .populate('runId', 'month status finalizedAt')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();

      return {
        payslips: recentItems,
      };
    });
  }

  /**
   * Generates or regenerates a draft payroll run for a given month (HR only).
   */
  async generateRun(
    month: string,
    creator: IUserDocument,
    req?: Request
  ): Promise<IPayrollRunDocument> {
    const today = todayInCompanyTz();
    const currentMonth = today.slice(0, 7);

    if (month > currentMonth) {
      throw AppError.badRequest('Cannot run payroll for a future month');
    }

    const existingRun = await PayrollRun.findOne({ month });
    if (existingRun && existingRun.status === 'finalized') {
      throw new AppError(
        `Payroll run for ${month} is already finalized and locked`,
        409,
        'PAYROLL_LOCKED'
      );
    }

    const rules = await settingsService.getRulesSnapshot();
    const [year, m] = month.split('-').map(Number);
    const startOfMonth = `${month}-01`;
    const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
    const endOfMonth = `${month}-${String(lastDay).padStart(2, '0')}`;

    const holidaySet = await holidayService.getHolidayDateKeys(startOfMonth, endOfMonth);
    const totalWorkingDaysInMonth = countWorkingDays(
      startOfMonth,
      endOfMonth,
      rules.weekendDays,
      holidaySet
    );

    if (totalWorkingDaysInMonth === 0) {
      throw AppError.badRequest('Month contains zero working days');
    }

    // Find all employees employed during this month
    const employees = await Employee.find({
      joiningDate: { $lte: endOfMonth },
      $or: [{ exitDate: { $exists: false } }, { exitDate: null }, { exitDate: { $gte: startOfMonth } }],
    }).lean();

    let run: IPayrollRunDocument;
    if (existingRun) {
      // Clean up previous draft items to regenerate
      await PayrollItem.deleteMany({ runId: existingRun._id });
      run = existingRun;
      run.version += 1;
    } else {
      run = new PayrollRun({
        month,
        status: 'draft',
        createdBy: creator._id,
        version: 1,
      });
      await run.save();
    }

    let sumGross = 0;
    let sumDeductions = 0;
    let sumTax = 0;
    let sumNet = 0;

    const itemsToCreate = [];

    for (const emp of employees) {
      const salary = await salaryService.getCurrent(emp._id.toString(), endOfMonth);
      if (!salary) continue; // Employee has no salary structure configured

      // Proration calculation for joiners / leavers
      const employedStart = emp.joiningDate > startOfMonth ? emp.joiningDate : startOfMonth;
      const employedEnd = emp.exitDate && emp.exitDate < endOfMonth ? emp.exitDate : endOfMonth;
      const employedWorkingDays = countWorkingDays(
        employedStart,
        employedEnd,
        rules.weekendDays,
        holidaySet
      );

      const prorationFactor = Math.min(1, Math.max(0, employedWorkingDays / totalWorkingDaysInMonth));
      const gross = Math.round(salary.gross * prorationFactor * 100) / 100;
      const basic = Math.round(salary.basic * prorationFactor * 100) / 100;
      const hra = Math.round(salary.hra * prorationFactor * 100) / 100;
      const medical = Math.round(salary.medical * prorationFactor * 100) / 100;
      const extraAllowance = Math.round(salary.extraAllowance * prorationFactor * 100) / 100;

      const perDay = Math.round((gross / totalWorkingDaysInMonth) * 100) / 100;

      // Attendance records in this month
      const attendanceRecords = await Attendance.find({
        employeeId: emp._id,
        dateKey: { $gte: startOfMonth, $lte: endOfMonth },
      }).lean();

      const halfDays = attendanceRecords.filter((r) => r.status === 'half_day').length;
      const lateCount = attendanceRecords.filter((r) => r.status === 'late').length;

      // Unpaid leave days
      const unpaidLeaves = await Leave.find({
        employeeId: emp._id,
        status: 'approved',
        startDate: { $lte: endOfMonth },
        endDate: { $gte: startOfMonth },
      })
        .populate('leaveTypeId', 'isPaid')
        .lean();

      const unpaidLeaveDays = unpaidLeaves
        .filter((l) => !(l.leaveTypeId as any)?.isPaid)
        .reduce((sum, l) => sum + l.workingDays, 0);

      // Absent days: working days during employment without attendance and without approved leave
      const presentDateKeys = new Set(attendanceRecords.map((r) => r.dateKey));
      const leaveRecords = await Leave.find({
        employeeId: emp._id,
        status: 'approved',
        startDate: { $lte: endOfMonth },
        endDate: { $gte: startOfMonth },
      }).lean();

      const leaveDateKeys = new Set<string>();
      for (const lr of leaveRecords) {
        listWorkingDays(
          lr.startDate < startOfMonth ? startOfMonth : lr.startDate,
          lr.endDate > endOfMonth ? endOfMonth : lr.endDate,
          rules.weekendDays,
          holidaySet
        ).forEach((d) => leaveDateKeys.add(d));
      }

      const allWorkingDates = listWorkingDays(
        employedStart,
        employedEnd,
        rules.weekendDays,
        holidaySet
      );

      const pastCutoff = today < endOfMonth ? today : endOfMonth;
      let absentDays = 0;
      for (const d of allWorkingDates) {
        if (d <= pastCutoff && !presentDateKeys.has(d) && !leaveDateKeys.has(d)) {
          absentDays += 1;
        }
      }

      // Deductions calculation using integer-cents
      const deductionDays = absentDays + unpaidLeaveDays + 0.5 * halfDays;
      const totalDeductions = Math.round(deductionDays * perDay * 100) / 100;

      const taxInfo = calculateMonthlyTax(gross);
      const monthlyTax = taxInfo.monthlyTax;
      const net = Math.max(0, Math.round((gross - totalDeductions - monthlyTax) * 100) / 100);

      sumGross += gross;
      sumDeductions += totalDeductions;
      sumTax += monthlyTax;
      sumNet += net;

      itemsToCreate.push({
        runId: run._id,
        employeeId: emp._id,
        basic,
        hra,
        medical,
        extraAllowance,
        gross,
        workingDays: totalWorkingDaysInMonth,
        absentDays,
        unpaidLeaveDays,
        halfDays,
        lateCount,
        joinedProrationFactor: prorationFactor,
        perDay,
        deductions: totalDeductions,
        taxableAnnual: taxInfo.annualTaxable,
        monthlyTax,
        net,
      });
    }

    await PayrollItem.insertMany(itemsToCreate);

    run.totals = {
      gross: Math.round(sumGross * 100) / 100,
      deductions: Math.round(sumDeductions * 100) / 100,
      tax: Math.round(sumTax * 100) / 100,
      net: Math.round(sumNet * 100) / 100,
      employeeCount: itemsToCreate.length,
    };
    await run.save();

    await auditService.log({
      req,
      action: 'PAYROLL_GENERATED',
      entity: 'PayrollRun',
      entityId: run._id.toString(),
      after: {
        month: run.month,
        employeeCount: run.totals.employeeCount,
        grossTotal: run.totals.gross,
        netTotal: run.totals.net,
      },
    });

    return run;
  }

  /**
   * Finalizes and locks a payroll run (Admin only).
   */
  async finalizeRun(
    runId: string,
    adminUser: IUserDocument,
    req?: Request
  ): Promise<IPayrollRunDocument> {
    const run = await PayrollRun.findById(runId);
    if (!run) {
      throw AppError.notFound('PayrollRun');
    }

    if (run.status === 'finalized') {
      throw new AppError('Payroll run is already finalized and locked', 409, 'PAYROLL_LOCKED');
    }

    run.status = 'finalized';
    run.finalizedBy = adminUser._id;
    run.finalizedAt = new Date();
    await run.save();

    // Notify employees that payslips are ready
    const items = await PayrollItem.find({ runId: run._id }).populate('employeeId', 'userId name');
    const { notificationService } = await import('../comms/notification.service');

    for (const item of items) {
      const emp = item.employeeId as any;
      if (emp?.userId) {
        await notificationService.createNotification({
          userId: emp.userId,
          type: 'payslip_available',
          title: `Payslip Available (${run.month})`,
          message: `Your payslip for ${run.month} is now finalized and available for download.`,
          link: '/payslips',
        });
      }
    }

    await auditService.log({
      req,
      action: 'PAYROLL_FINALIZED',
      entity: 'PayrollRun',
      entityId: run._id.toString(),
      after: {
        month: run.month,
        finalizedBy: adminUser.name,
        finalizedAt: run.finalizedAt,
      },
    });

    return run;
  }

  /**
   * Adds a one-off adjustment to a payslip while in draft mode (HR only).
   */
  async adjustItem(
    runId: string,
    itemId: string,
    adjustment: { amount: number; reason: string },
    req?: Request
  ): Promise<IPayrollItemDocument> {
    const run = await PayrollRun.findById(runId);
    if (!run) {
      throw AppError.notFound('PayrollRun');
    }

    if (run.status === 'finalized') {
      throw new AppError(
        'Cannot modify payslip: Payroll run is finalized and locked',
        409,
        'PAYROLL_LOCKED'
      );
    }

    const item = await PayrollItem.findOne({ _id: itemId, runId: run._id });
    if (!item) {
      throw AppError.notFound('PayrollItem');
    }

    const before = {
      adjustment: item.oneOffAdjustment,
      net: item.net,
    };

    item.oneOffAdjustment = {
      amount: adjustment.amount,
      reason: adjustment.reason.trim(),
    };

    // Recompute item net
    item.net = Math.max(
      0,
      Math.round((item.gross - item.deductions - item.monthlyTax + adjustment.amount) * 100) / 100
    );
    await item.save();

    // Recompute totals on the run
    const allItems = await PayrollItem.find({ runId: run._id });
    run.totals.net = Math.round(allItems.reduce((sum, i) => sum + i.net, 0) * 100) / 100;
    await run.save();

    await auditService.log({
      req,
      action: 'PAYROLL_ITEM_ADJUSTED',
      entity: 'PayrollItem',
      entityId: item._id.toString(),
      before,
      after: {
        adjustment: item.oneOffAdjustment,
        net: item.net,
      },
    });

    return item;
  }

  /**
   * Retrieves payslip with scoping checks.
   */
  async getPayslip(
    itemId: string,
    viewer: { role: string; employeeId?: Types.ObjectId | string }
  ): Promise<IPayrollItemDocument> {
    const item = await PayrollItem.findById(itemId)
      .populate('runId', 'month status finalizedAt')
      .populate({
        path: 'employeeId',
        select: 'employeeCode name email joiningDate',
        populate: [
          { path: 'departmentId', select: 'name' },
          { path: 'designationId', select: 'title' },
        ],
      });

    if (!item) {
      throw AppError.notFound('Payslip');
    }

    const run = item.runId as unknown as IPayrollRunDocument;

    // Scope check: Employees can only view own payslip from finalized runs
    if (viewer.role === 'employee') {
      if (item.employeeId._id.toString() !== viewer.employeeId?.toString()) {
        throw AppError.forbidden('Access denied to other employee payslips');
      }
      if (run.status !== 'finalized') {
        throw AppError.forbidden('Payslip is not yet finalized');
      }
    }

    return item;
  }

  /**
   * Generates PDF for a payslip.
   */
  async getPayslipPdf(
    itemId: string,
    viewer: { role: string; employeeId?: Types.ObjectId | string }
  ): Promise<Buffer> {
    const item = await this.getPayslip(itemId, viewer);
    const emp = item.employeeId as any;
    const run = item.runId as any;
    const settings = await settingsService.get();

    return generatePayslipPdf({
      companyName: settings.companyName,
      month: run.month,
      employee: {
        code: emp.employeeCode,
        name: emp.name,
        email: emp.email,
        department: emp.departmentId?.name || '',
        designation: emp.designationId?.title || '',
        joiningDate: emp.joiningDate,
      },
      earnings: {
        basic: item.basic,
        hra: item.hra,
        medical: item.medical,
        extraAllowance: item.extraAllowance,
        gross: item.gross,
      },
      deductions: {
        absentDays: item.absentDays,
        unpaidLeaveDays: item.unpaidLeaveDays,
        halfDays: item.halfDays,
        lateCount: item.lateCount,
        totalDeductions: item.deductions,
      },
      tax: {
        annualTaxable: item.taxableAnnual,
        monthlyTax: item.monthlyTax,
      },
      adjustments: item.oneOffAdjustment?.amount
        ? {
            amount: item.oneOffAdjustment.amount,
            reason: item.oneOffAdjustment.reason,
          }
        : undefined,
      netPay: item.net,
    });
  }

  /**
   * Lists payslips with scoping and filters.
   */
  async listPayslips(
    viewer: { role: string; employeeId?: Types.ObjectId | string },
    filters: { runId?: string; employeeId?: string; month?: string; page?: number; limit?: number }
  ) {
    const query: Record<string, any> = {};

    if (viewer.role === 'employee') {
      query.employeeId = new Types.ObjectId(viewer.employeeId);
      // Employees only see finalized payslips
      const finalizedRuns = await PayrollRun.find({ status: 'finalized' }).select('_id');
      query.runId = { $in: finalizedRuns.map((r) => r._id) };
    } else {
      if (filters.runId) query.runId = new Types.ObjectId(filters.runId);
      if (filters.employeeId) query.employeeId = new Types.ObjectId(filters.employeeId);
      if (filters.month) {
        const run = await PayrollRun.findOne({ month: filters.month }).select('_id');
        if (run) query.runId = run._id;
      }
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 50));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      PayrollItem.find(query)
        .populate('runId', 'month status finalizedAt')
        .populate('employeeId', 'employeeCode name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      PayrollItem.countDocuments(query),
    ]);

    return {
      payslips: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export const payrollService = new PayrollService();

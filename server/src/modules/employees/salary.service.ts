import { Request } from 'express';
import { Types } from 'mongoose';
import { SalaryStructure, ISalaryStructureDocument } from './salary.model';
import { Employee } from './employee.model';
import { computeSalary } from '../../utils/salary';
import { todayInCompanyTz } from '../../utils/date';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { UpdateSalaryInput } from './employee.schema';

export class SalaryService {
  /**
   * Retrieves the current salary structure on or before a given date key.
   */
  async getCurrent(
    employeeId: string,
    onDateKey?: string
  ): Promise<ISalaryStructureDocument | null> {
    const targetDate = onDateKey || todayInCompanyTz();
    return SalaryStructure.findOne({
      employeeId: new Types.ObjectId(employeeId),
      effectiveFrom: { $lte: targetDate },
    })
      .sort({ effectiveFrom: -1, createdAt: -1 })
      .exec();
  }

  /**
   * Retrieves the full salary history for an employee.
   */
  async getHistory(employeeId: string): Promise<ISalaryStructureDocument[]> {
    return SalaryStructure.find({
      employeeId: new Types.ObjectId(employeeId),
    })
      .sort({ effectiveFrom: -1, createdAt: -1 })
      .exec();
  }

  /**
   * Creates an initial salary record during employee registration.
   */
  async createInitialSalary(
    employeeId: Types.ObjectId,
    basic: number,
    extraAllowance = 0,
    effectiveFrom: string,
    createdBy?: Types.ObjectId
  ): Promise<ISalaryStructureDocument> {
    const computed = computeSalary(basic, extraAllowance);

    return SalaryStructure.create({
      employeeId,
      basic: computed.basic,
      hra: computed.hra,
      medical: computed.medical,
      extraAllowance: computed.extraAllowance,
      gross: computed.gross,
      effectiveFrom,
      createdBy,
    });
  }

  /**
   * Adds a new salary structure version. Rows with the same effectiveFrom are rejected with 409.
   */
  async updateSalary(
    employeeId: string,
    input: UpdateSalaryInput,
    req?: Request
  ): Promise<ISalaryStructureDocument> {
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      throw AppError.notFound('Employee');
    }

    const effectiveFrom = input.effectiveFrom || todayInCompanyTz();

    if (effectiveFrom < employee.joiningDate) {
      throw AppError.badRequest(
        `Effective date (${effectiveFrom}) cannot precede joining date (${employee.joiningDate})`
      );
    }

    const existingRow = await SalaryStructure.findOne({
      employeeId: employee._id,
      effectiveFrom,
    });
    if (existingRow) {
      throw AppError.conflict(
        `Salary structure already exists for effective date '${effectiveFrom}'. Salary versions are immutable.`
      );
    }

    const previousStructure = await this.getCurrent(employeeId);
    const computed = computeSalary(input.basic, input.extraAllowance ?? 0);

    const newStructure = await SalaryStructure.create({
      employeeId: employee._id,
      basic: computed.basic,
      hra: computed.hra,
      medical: computed.medical,
      extraAllowance: computed.extraAllowance,
      gross: computed.gross,
      effectiveFrom,
      createdBy: (req as any)?.user?._id,
    });

    await auditService.log({
      req,
      action: 'SALARY_CHANGED',
      entity: 'SalaryStructure',
      entityId: newStructure._id.toString(),
      before: previousStructure
        ? {
            basic: previousStructure.basic,
            hra: previousStructure.hra,
            medical: previousStructure.medical,
            extraAllowance: previousStructure.extraAllowance,
            gross: previousStructure.gross,
            effectiveFrom: previousStructure.effectiveFrom,
          }
        : undefined,
      after: {
        basic: newStructure.basic,
        hra: newStructure.hra,
        medical: newStructure.medical,
        extraAllowance: newStructure.extraAllowance,
        gross: newStructure.gross,
        effectiveFrom: newStructure.effectiveFrom,
      },
    });

    return newStructure;
  }
}

export const salaryService = new SalaryService();

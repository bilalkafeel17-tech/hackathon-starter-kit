import { Request } from 'express';
import { LeaveType, ILeaveType } from './leave-type.model';
import { CreateLeaveTypeInput, UpdateLeaveTypeInput } from './leave-type.schema';
import { AppError } from '../../utils/AppError';
import { auditService, computeDiff } from '../audit/audit.service';

export const SUGGESTED_LEAVE_TYPES = [
  { name: 'Annual Leave', code: 'annual', yearlyQuota: 14, isPaid: true },
  { name: 'Casual Leave', code: 'casual', yearlyQuota: 10, isPaid: true },
  { name: 'Sick Leave', code: 'sick', yearlyQuota: 8, isPaid: true },
  { name: 'Unpaid Leave', code: 'unpaid', yearlyQuota: null, isPaid: false },
] as const;

export class LeaveTypeService {
  async create(data: CreateLeaveTypeInput, req?: Request): Promise<ILeaveType> {
    const code = data.code.toLowerCase().trim();

    const existing = await LeaveType.findOne({ code });
    if (existing) {
      throw AppError.conflict(`Leave type with code '${code}' already exists`);
    }

    const leaveType = await LeaveType.create({
      name: data.name.trim(),
      code,
      yearlyQuota: data.yearlyQuota,
      isPaid: data.isPaid,
      isActive: true,
    });

    await auditService.log({
      req,
      action: 'LEAVE_TYPE_CREATED',
      entity: 'LeaveType',
      entityId: leaveType._id.toString(),
      after: {
        name: leaveType.name,
        code: leaveType.code,
        yearlyQuota: leaveType.yearlyQuota,
        isPaid: leaveType.isPaid,
      },
    });

    return leaveType;
  }

  async list(isActive?: boolean): Promise<ILeaveType[]> {
    const query: Record<string, any> = {};
    if (isActive !== undefined) {
      query.isActive = isActive;
    }
    return LeaveType.find(query).sort({ name: 1 });
  }

  async getById(id: string): Promise<ILeaveType> {
    const leaveType = await LeaveType.findById(id);
    if (!leaveType) {
      throw AppError.notFound('LeaveType');
    }
    return leaveType;
  }

  async update(id: string, data: UpdateLeaveTypeInput, req?: Request): Promise<ILeaveType> {
    const leaveType = await this.getById(id);

    const beforeState = {
      name: leaveType.name,
      yearlyQuota: leaveType.yearlyQuota,
      isPaid: leaveType.isPaid,
    };

    if (data.name !== undefined) {
      leaveType.name = data.name.trim();
    }
    if (data.yearlyQuota !== undefined) {
      // Note: Changing a quota applies to current and future allocation cycles
      leaveType.yearlyQuota = data.yearlyQuota;
    }
    if (data.isPaid !== undefined) {
      leaveType.isPaid = data.isPaid;
    }

    await leaveType.save();

    const afterState = {
      name: leaveType.name,
      yearlyQuota: leaveType.yearlyQuota,
      isPaid: leaveType.isPaid,
    };

    const { before, after } = computeDiff(beforeState, afterState);

    await auditService.log({
      req,
      action: 'LEAVE_TYPE_UPDATED',
      entity: 'LeaveType',
      entityId: leaveType._id.toString(),
      before,
      after,
    });

    return leaveType;
  }

  async setActive(id: string, isActive: boolean, req?: Request): Promise<ILeaveType> {
    const leaveType = await this.getById(id);

    const before = { isActive: leaveType.isActive };
    leaveType.isActive = isActive;
    await leaveType.save();

    await auditService.log({
      req,
      action: isActive ? 'LEAVE_TYPE_ACTIVATED' : 'LEAVE_TYPE_DEACTIVATED',
      entity: 'LeaveType',
      entityId: leaveType._id.toString(),
      before,
      after: { isActive: leaveType.isActive },
    });

    return leaveType;
  }

  getSuggestions() {
    return SUGGESTED_LEAVE_TYPES;
  }

  async applySuggestions(req?: Request): Promise<{
    created: ILeaveType[];
    skipped: string[];
  }> {
    const created: ILeaveType[] = [];
    const skipped: string[] = [];

    for (const item of SUGGESTED_LEAVE_TYPES) {
      const exists = await LeaveType.findOne({ code: item.code });
      if (exists) {
        skipped.push(item.code);
      } else {
        const doc = await LeaveType.create({
          name: item.name,
          code: item.code,
          yearlyQuota: item.yearlyQuota,
          isPaid: item.isPaid,
          isActive: true,
        });
        created.push(doc);
      }
    }

    if (created.length > 0) {
      await auditService.log({
        req,
        action: 'LEAVE_TYPES_SEEDED_BY_ADMIN',
        entity: 'LeaveType',
        after: {
          createdCount: created.length,
          createdCodes: created.map((c) => c.code),
          skippedCodes: skipped,
        },
      });
    }

    return { created, skipped };
  }
}

export const leaveTypeService = new LeaveTypeService();

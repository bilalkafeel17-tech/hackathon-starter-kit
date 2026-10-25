import { Request } from 'express';
import { Types } from 'mongoose';
import { Designation, IDesignation } from './designation.model';
import { Department } from '../departments/department.model';
import { CreateDesignationInput, UpdateDesignationInput } from './designation.schema';
import { AppError } from '../../utils/AppError';
import { auditService, computeDiff } from '../audit/audit.service';

export interface DesignationFilterQuery {
  departmentId?: string;
  isActive?: string | boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export class DesignationService {
  private async validateDepartment(departmentId?: string | null): Promise<Types.ObjectId | null> {
    if (!departmentId) {
      return null;
    }

    const dept = await Department.findById(departmentId);
    if (!dept) {
      throw AppError.badRequest('Referenced department does not exist');
    }
    if (!dept.isActive) {
      throw AppError.badRequest('Cannot assign designation to an inactive department');
    }

    return dept._id;
  }

  async create(data: CreateDesignationInput, req?: Request): Promise<IDesignation> {
    const titleKey = data.title.toLowerCase().trim();
    const departmentId = await this.validateDepartment(data.departmentId);

    const existing = await Designation.findOne({ titleKey, departmentId });
    if (existing) {
      throw AppError.conflict(
        `Designation with title '${data.title}' already exists in this department`
      );
    }

    const designation = await Designation.create({
      title: data.title.trim(),
      titleKey,
      departmentId,
      level: data.level?.trim() || undefined,
      isActive: true,
    });

    await auditService.log({
      req,
      action: 'DESIGNATION_CREATED',
      entity: 'Designation',
      entityId: designation._id.toString(),
      after: {
        title: designation.title,
        departmentId: designation.departmentId?.toString(),
        level: designation.level,
      },
    });

    return designation;
  }

  async list(filters: DesignationFilterQuery): Promise<{
    designations: IDesignation[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 50));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (filters.departmentId && Types.ObjectId.isValid(filters.departmentId)) {
      query.departmentId = new Types.ObjectId(filters.departmentId);
    }

    if (filters.isActive !== undefined && filters.isActive !== '') {
      query.isActive = filters.isActive === 'true' || filters.isActive === true;
    }

    if (filters.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [{ title: regex }, { level: regex }];
    }

    const [designations, total] = await Promise.all([
      Designation.find(query).populate('departmentId', 'name code').sort({ title: 1 }).skip(skip).limit(limit),
      Designation.countDocuments(query),
    ]);

    return {
      designations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getById(id: string): Promise<IDesignation> {
    const designation = await Designation.findById(id).populate('departmentId', 'name code');
    if (!designation) {
      throw AppError.notFound('Designation');
    }
    return designation;
  }

  async update(id: string, data: UpdateDesignationInput, req?: Request): Promise<IDesignation> {
    const designation = await Designation.findById(id);
    if (!designation) {
      throw AppError.notFound('Designation');
    }

    const beforeState = {
      title: designation.title,
      departmentId: designation.departmentId?.toString(),
      level: designation.level,
    };

    let nextTitleKey = designation.titleKey;
    if (data.title !== undefined) {
      nextTitleKey = data.title.toLowerCase().trim();
      designation.title = data.title.trim();
      designation.titleKey = nextTitleKey;
    }

    let nextDepartmentId = designation.departmentId;
    if (data.departmentId !== undefined) {
      nextDepartmentId = await this.validateDepartment(data.departmentId);
      designation.departmentId = nextDepartmentId;
    }

    // Check unique constraint on titleKey + departmentId
    if (data.title !== undefined || data.departmentId !== undefined) {
      const conflict = await Designation.findOne({
        titleKey: nextTitleKey,
        departmentId: nextDepartmentId,
        _id: { $ne: designation._id },
      });
      if (conflict) {
        throw AppError.conflict(
          `Designation with title '${designation.title}' already exists in this department`
        );
      }
    }

    if (data.level !== undefined) {
      designation.level = data.level ? data.level.trim() : undefined;
    }

    await designation.save();

    const afterState = {
      title: designation.title,
      departmentId: designation.departmentId?.toString(),
      level: designation.level,
    };

    const { before, after } = computeDiff(beforeState, afterState);

    await auditService.log({
      req,
      action: 'DESIGNATION_UPDATED',
      entity: 'Designation',
      entityId: designation._id.toString(),
      before,
      after,
    });

    return designation;
  }

  /**
   * Deactivation guard checking for non-exited employees.
   */
  async canDeactivateDesignation(id: string): Promise<{ canDeactivate: boolean; count: number }> {
    const { Employee } = await import('../employees/employee.model');
    const count = await Employee.countDocuments({
      designationId: id,
      status: { $ne: 'exited' },
    });
    return { canDeactivate: count === 0, count };
  }

  async setActive(id: string, isActive: boolean, req?: Request): Promise<IDesignation> {
    const designation = await Designation.findById(id);
    if (!designation) {
      throw AppError.notFound('Designation');
    }

    if (!isActive) {
      const { canDeactivate, count } = await this.canDeactivateDesignation(id);
      if (!canDeactivate) {
        throw AppError.conflict(
          `Cannot deactivate designation with ${count} active employee(s)`
        );
      }
    }

    const before = { isActive: designation.isActive };
    designation.isActive = isActive;
    await designation.save();

    await auditService.log({
      req,
      action: isActive ? 'DESIGNATION_ACTIVATED' : 'DESIGNATION_DEACTIVATED',
      entity: 'Designation',
      entityId: designation._id.toString(),
      before,
      after: { isActive: designation.isActive },
    });

    return designation;
  }
}

export const designationService = new DesignationService();

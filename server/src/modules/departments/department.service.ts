import { Request } from 'express';
import { Department, IDepartment } from './department.model';
import { CreateDepartmentInput, UpdateDepartmentInput } from './department.schema';
import { AppError } from '../../utils/AppError';
import { auditService, computeDiff } from '../audit/audit.service';

export interface DepartmentFilterQuery {
  isActive?: string | boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export class DepartmentService {
  async create(data: CreateDepartmentInput, req?: Request): Promise<IDepartment> {
    const nameKey = data.name.toLowerCase().trim();

    const existing = await Department.findOne({ nameKey });
    if (existing) {
      throw AppError.conflict(`Department with name '${data.name}' already exists`);
    }

    if (data.code) {
      const codeExisting = await Department.findOne({ code: data.code.toUpperCase().trim() });
      if (codeExisting) {
        throw AppError.conflict(`Department with code '${data.code}' already exists`);
      }
    }

    const department = await Department.create({
      name: data.name.trim(),
      nameKey,
      code: data.code ? data.code.toUpperCase().trim() : undefined,
      description: data.description?.trim(),
      isActive: true,
    });

    await auditService.log({
      req,
      action: 'DEPARTMENT_CREATED',
      entity: 'Department',
      entityId: department._id.toString(),
      after: {
        name: department.name,
        code: department.code,
      },
    });

    return department;
  }

  async list(filters: DepartmentFilterQuery): Promise<{
    departments: IDepartment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 50));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (filters.isActive !== undefined && filters.isActive !== '') {
      query.isActive = filters.isActive === 'true' || filters.isActive === true;
    }

    if (filters.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [{ name: regex }, { code: regex }];
    }

    const [departments, total] = await Promise.all([
      Department.find(query).sort({ name: 1 }).skip(skip).limit(limit),
      Department.countDocuments(query),
    ]);

    return {
      departments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getById(id: string): Promise<IDepartment> {
    const department = await Department.findById(id);
    if (!department) {
      throw AppError.notFound('Department');
    }
    return department;
  }

  async update(id: string, data: UpdateDepartmentInput, req?: Request): Promise<IDepartment> {
    const department = await this.getById(id);

    const beforeState = {
      name: department.name,
      code: department.code,
      description: department.description,
    };

    if (data.name !== undefined) {
      const nameKey = data.name.toLowerCase().trim();
      const conflict = await Department.findOne({ nameKey, _id: { $ne: department._id } });
      if (conflict) {
        throw AppError.conflict(`Department with name '${data.name}' already exists`);
      }
      department.name = data.name.trim();
      department.nameKey = nameKey;
    }

    if (data.code !== undefined) {
      if (data.code) {
        const code = data.code.toUpperCase().trim();
        const codeConflict = await Department.findOne({ code, _id: { $ne: department._id } });
        if (codeConflict) {
          throw AppError.conflict(`Department with code '${data.code}' already exists`);
        }
        department.code = code;
      } else {
        department.code = undefined;
      }
    }

    if (data.description !== undefined) {
      department.description = data.description ? data.description.trim() : undefined;
    }

    await department.save();

    const afterState = {
      name: department.name,
      code: department.code,
      description: department.description,
    };

    const { before, after } = computeDiff(beforeState, afterState);

    await auditService.log({
      req,
      action: 'DEPARTMENT_UPDATED',
      entity: 'Department',
      entityId: department._id.toString(),
      before,
      after,
    });

    return department;
  }

  /**
   * Deactivation guard checking for non-exited employees.
   */
  async canDeactivateDepartment(id: string): Promise<{ canDeactivate: boolean; count: number }> {
    const { Employee } = await import('../employees/employee.model');
    const count = await Employee.countDocuments({
      departmentId: id,
      status: { $ne: 'exited' },
    });
    return { canDeactivate: count === 0, count };
  }

  async setActive(id: string, isActive: boolean, req?: Request): Promise<IDepartment> {
    const department = await this.getById(id);

    if (!isActive) {
      const { canDeactivate, count } = await this.canDeactivateDepartment(id);
      if (!canDeactivate) {
        throw AppError.conflict(
          `Cannot deactivate department with ${count} active employee(s)`
        );
      }
    }

    const before = { isActive: department.isActive };
    department.isActive = isActive;
    await department.save();

    await auditService.log({
      req,
      action: isActive ? 'DEPARTMENT_ACTIVATED' : 'DEPARTMENT_DEACTIVATED',
      entity: 'Department',
      entityId: department._id.toString(),
      before,
      after: { isActive: department.isActive },
    });

    return department;
  }
}

export const departmentService = new DepartmentService();

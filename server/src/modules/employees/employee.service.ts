import { Request } from 'express';
import mongoose, { Types } from 'mongoose';
import { Employee, IEmployeeDocument } from './employee.model';
import { getNextEmployeeCode } from './counter.model';
import { SalaryStructure, ISalaryStructureDocument } from './salary.model';
import { User, IUserDocument } from '../users/user.model';
import { Department } from '../departments/department.model';
import { Designation } from '../designations/designation.model';
import { LeaveType } from '../leave-types/leave-type.model';
import { computeSalary } from '../../utils/salary';
import { computeTenure, sectionProviders } from './employee360.registry';
import { AppError } from '../../utils/AppError';
import { hashPassword, generateTempPassword } from '../../utils/password';
import { auditService, computeDiff } from '../audit/audit.service';
import {
  RegisterEmployeeInput,
  UpdateEmployeeInput,
  UpdateSelfContactInput,
  ExitEmployeeInput,
} from './employee.schema';
import { assertCanAccessEmployee } from '../../middleware/auth';

export interface EmployeeListQuery {
  q?: string;
  departmentId?: string;
  designationId?: string;
  status?: string;
  employmentType?: string;
  gender?: string;
  joinedFrom?: string;
  joinedTo?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number | string;
  limit?: number | string;
}

export class EmployeeService {
  /**
   * Registers a new employee, creates their initial salary structure and user login.
   */
  async registerEmployee(
    data: RegisterEmployeeInput,
    req?: Request
  ): Promise<{ employee: IEmployeeDocument; tempPassword: string }> {
    // 1. Verify organization readiness: at least one department and one leave type
    const [activeDeptCount, activeLeaveCount] = await Promise.all([
      Department.countDocuments({ isActive: true }),
      LeaveType.countDocuments({ isActive: true }),
    ]);

    if (activeDeptCount === 0 || activeLeaveCount === 0) {
      throw new AppError(
        'Organization setup is incomplete. Ask an administrator to configure departments and leave types before registering employees.',
        409,
        'ORG_NOT_READY'
      );
    }

    // 2. Validate department exists and is active
    const department = await Department.findOne({
      _id: data.departmentId,
      isActive: true,
    });
    if (!department) {
      throw AppError.unprocessable('Department does not exist or is inactive', [
        { field: 'departmentId', message: 'Department must exist and be active' },
      ]);
    }

    // 3. Validate designation exists, is active, and matches department
    const designation = await Designation.findOne({
      _id: data.designationId,
      isActive: true,
      $or: [
        { departmentId: department._id },
        { departmentId: { $exists: false } },
        { departmentId: null },
      ],
    });
    if (!designation) {
      throw AppError.unprocessable(
        'Designation does not exist, is inactive, or does not belong to the selected department',
        [{ field: 'designationId', message: 'Invalid designation for this department' }]
      );
    }

    // 4. Validate email uniqueness across Employees and Users
    const email = data.email.toLowerCase().trim();
    const [existingEmpEmail, existingUserEmail] = await Promise.all([
      Employee.findOne({ email }),
      User.findOne({ email }),
    ]);

    if (existingEmpEmail || existingUserEmail) {
      throw AppError.conflict('An employee or user with this email already exists', {
        field: 'email',
      });
    }

    // 5. Generate or validate employee code
    let employeeCode: string;
    if (data.employeeCode) {
      employeeCode = data.employeeCode.toUpperCase().trim();
      const existingCode = await Employee.findOne({ employeeCode });
      if (existingCode) {
        throw AppError.conflict(`Employee code '${employeeCode}' already exists`, {
          field: 'employeeCode',
        });
      }
    } else {
      employeeCode = await getNextEmployeeCode();
    }

    // 6. Generate temporary login password
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    let createdUser: IUserDocument | null = null;
    let createdEmployee: IEmployeeDocument | null = null;
    let createdSalary: ISalaryStructureDocument | null = null;

    let session: mongoose.ClientSession | null = null;
    let isTxActive = false;

    try {
      const desc = (mongoose.connection.getClient() as any)?.topology?.description;
      const isReplicaSet = Boolean(desc?.setName);

      if (isReplicaSet) {
        session = await mongoose.startSession();
        session.startTransaction();
        isTxActive = true;
      }
    } catch {
      session = null;
      isTxActive = false;
    }

    try {
      // Create user login with role "employee"
      const userDoc = new User({
        name: data.name.trim(),
        email,
        passwordHash,
        role: 'employee',
        isActive: true,
        mustChangePassword: true,
        tokenVersion: 0,
        failedLoginAttempts: 0,
      });

      if (isTxActive && session) {
        await userDoc.save({ session });
      } else {
        await userDoc.save();
      }
      createdUser = userDoc;

      // Create employee profile
      const employeeDoc = new Employee({
        employeeCode,
        name: data.name.trim(),
        email,
        phone: data.phone.trim(),
        address: data.address?.trim(),
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
        joiningDate: data.joiningDate,
        departmentId: department._id,
        designationId: designation._id,
        employmentType: data.employmentType || 'full_time',
        status: data.status || 'probation',
        probationEndDate: data.probationEndDate,
        emergencyContact: data.emergencyContact,
        userId: userDoc._id,
      });

      if (isTxActive && session) {
        await employeeDoc.save({ session });
      } else {
        await employeeDoc.save();
      }
      createdEmployee = employeeDoc;

      // Link User to Employee
      userDoc.employeeId = employeeDoc._id;
      if (isTxActive && session) {
        await userDoc.save({ session });
      } else {
        await userDoc.save();
      }

      // Create initial salary record
      const computed = computeSalary(data.salary.basic, data.salary.extraAllowance || 0);
      const salaryDoc = new SalaryStructure({
        employeeId: employeeDoc._id,
        basic: computed.basic,
        hra: computed.hra,
        medical: computed.medical,
        extraAllowance: computed.extraAllowance,
        gross: computed.gross,
        effectiveFrom: data.joiningDate,
        createdBy: (req as any)?.user?._id,
      });

      if (isTxActive && session) {
        await salaryDoc.save({ session });
        await session.commitTransaction();
      } else {
        await salaryDoc.save();
      }
      createdSalary = salaryDoc;
    } catch (err) {
      if (isTxActive && session) {
        try {
          await session.abortTransaction();
        } catch {}
      } else {
        // Compensating rollback for environments without replica set support
        if (createdSalary) await SalaryStructure.deleteOne({ _id: createdSalary._id });
        if (createdEmployee) await Employee.deleteOne({ _id: createdEmployee._id });
        if (createdUser) await User.deleteOne({ _id: createdUser._id });
      }
      throw err;
    } finally {
      if (session) {
        try {
          await session.endSession();
        } catch {}
      }
    }

    // Populate department & designation for clean response
    await createdEmployee.populate([
      { path: 'departmentId', select: 'name code' },
      { path: 'designationId', select: 'title level' },
    ]);

    await auditService.log({
      req,
      action: 'EMPLOYEE_REGISTERED',
      entity: 'Employee',
      entityId: createdEmployee._id.toString(),
      after: {
        employeeCode: createdEmployee.employeeCode,
        name: createdEmployee.name,
        email: createdEmployee.email,
        departmentId: createdEmployee.departmentId,
        designationId: createdEmployee.designationId,
        joiningDate: createdEmployee.joiningDate,
      },
    });

    return {
      employee: createdEmployee,
      tempPassword,
    };
  }

  /**
   * Lists employees with filtering, searching, whitelist sorting, and role-based scoping.
   */
  async list(
    query: EmployeeListQuery,
    viewer: { _id: string; role: string; employeeId?: Types.ObjectId | string }
  ): Promise<{
    employees: IEmployeeDocument[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const filter: Record<string, any> = {};

    // Scope enforcement: employees only see their own profile
    if (viewer.role === 'employee') {
      if (!viewer.employeeId) {
        return {
          employees: [],
          meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
        };
      }
      filter._id = new Types.ObjectId(viewer.employeeId);
    } else {
      // HR and Admin can filter
      if (query.departmentId) filter.departmentId = new Types.ObjectId(query.departmentId);
      if (query.designationId) filter.designationId = new Types.ObjectId(query.designationId);
      if (query.status) filter.status = query.status;
      if (query.employmentType) filter.employmentType = query.employmentType;
      if (query.gender) filter.gender = query.gender;
      if (query.joinedFrom || query.joinedTo) {
        filter.joiningDate = {};
        if (query.joinedFrom) filter.joiningDate.$gte = query.joinedFrom;
        if (query.joinedTo) filter.joiningDate.$lte = query.joinedTo;
      }

      if (query.q && query.q.trim().length > 0) {
        const escaped = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        filter.$or = [
          { name: regex },
          { email: regex },
          { employeeCode: regex },
        ];
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    // Sorting whitelist
    const sortFieldWhitelist = ['name', 'employeeCode', 'joiningDate', 'createdAt'];
    let sortField = 'createdAt';
    if (query.sort && sortFieldWhitelist.includes(query.sort)) {
      sortField = query.sort;
    }
    const sortOrder = query.order === 'asc' ? 1 : -1;
    const sortOption: Record<string, 1 | -1> = { [sortField]: sortOrder };

    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .populate('departmentId', 'name code')
        .populate('designationId', 'title level')
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .exec(),
      Employee.countDocuments(filter),
    ]);

    return {
      employees,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves an employee profile by ID with strict scope verification.
   */
  async getById(
    id: string,
    viewer: { _id: string; role: string; employeeId?: Types.ObjectId | string }
  ): Promise<IEmployeeDocument> {
    assertCanAccessEmployee(viewer as any, id);

    const employee = await Employee.findById(id)
      .populate('departmentId', 'name code')
      .populate('designationId', 'title level');

    if (!employee) {
      throw AppError.notFound('Employee');
    }

    return employee;
  }

  /**
   * Allows an employee to update only their own phone and address.
   */
  async updateSelfContact(
    employeeId: string,
    input: UpdateSelfContactInput,
    req?: Request
  ): Promise<IEmployeeDocument> {
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      throw AppError.notFound('Employee');
    }

    if (employee.status === 'exited') {
      throw AppError.badRequest('Exited employees cannot update contact information');
    }

    const before = {
      phone: employee.phone,
      address: employee.address,
    };

    if (input.phone !== undefined) employee.phone = input.phone.trim();
    if (input.address !== undefined) employee.address = input.address.trim();

    await employee.save();

    const after = {
      phone: employee.phone,
      address: employee.address,
    };

    const diff = computeDiff(before, after);

    await auditService.log({
      req,
      action: 'EMPLOYEE_CONTACT_UPDATED',
      entity: 'Employee',
      entityId: employee._id.toString(),
      before: diff.before,
      after: diff.after,
    });

    return employee;
  }

  /**
   * Updates employee details (HR only).
   */
  async update(
    id: string,
    input: UpdateEmployeeInput,
    req?: Request
  ): Promise<IEmployeeDocument> {
    const employee = await Employee.findById(id);
    if (!employee) {
      throw AppError.notFound('Employee');
    }

    if (employee.status === 'exited') {
      throw AppError.badRequest('Exited employees cannot be modified');
    }

    // Validate department change
    if (input.departmentId && input.departmentId !== employee.departmentId.toString()) {
      const dept = await Department.findOne({ _id: input.departmentId, isActive: true });
      if (!dept) {
        throw AppError.unprocessable('Department does not exist or is inactive', [
          { field: 'departmentId', message: 'Department must exist and be active' },
        ]);
      }
      employee.departmentId = dept._id;
    }

    // Validate designation change
    if (input.designationId && input.designationId !== employee.designationId.toString()) {
      const desig = await Designation.findOne({
        _id: input.designationId,
        isActive: true,
        $or: [
          { departmentId: employee.departmentId },
          { departmentId: { $exists: false } },
          { departmentId: null },
        ],
      });
      if (!desig) {
        throw AppError.unprocessable('Invalid designation for this department', [
          { field: 'designationId', message: 'Designation does not exist or is inactive' },
        ]);
      }
      employee.designationId = desig._id;
    }

    const beforeState: Record<string, unknown> = {
      name: employee.name,
      phone: employee.phone,
      address: employee.address,
      gender: employee.gender,
      dateOfBirth: employee.dateOfBirth,
      departmentId: employee.departmentId.toString(),
      designationId: employee.designationId.toString(),
      employmentType: employee.employmentType,
      status: employee.status,
      probationEndDate: employee.probationEndDate,
      emergencyContact: employee.emergencyContact,
    };

    if (input.name !== undefined) {
      employee.name = input.name.trim();
      // Sync user account name
      await User.findByIdAndUpdate(employee.userId, { name: employee.name });
    }
    if (input.phone !== undefined) employee.phone = input.phone.trim();
    if (input.address !== undefined) employee.address = input.address.trim();
    if (input.gender !== undefined) employee.gender = input.gender;
    if (input.dateOfBirth !== undefined) employee.dateOfBirth = input.dateOfBirth;
    if (input.employmentType !== undefined) employee.employmentType = input.employmentType;
    if (input.status !== undefined) employee.status = input.status;
    if (input.probationEndDate !== undefined) employee.probationEndDate = input.probationEndDate;
    if (input.emergencyContact !== undefined) employee.emergencyContact = input.emergencyContact;

    // TODO: Task 5 will enforce that joiningDate corrections are allowed only if no attendance exists yet.

    await employee.save();

    const afterState: Record<string, unknown> = {
      name: employee.name,
      phone: employee.phone,
      address: employee.address,
      gender: employee.gender,
      dateOfBirth: employee.dateOfBirth,
      departmentId: employee.departmentId.toString(),
      designationId: employee.designationId.toString(),
      employmentType: employee.employmentType,
      status: employee.status,
      probationEndDate: employee.probationEndDate,
      emergencyContact: employee.emergencyContact,
    };

    const { before, after } = computeDiff(beforeState, afterState);

    await auditService.log({
      req,
      action: 'EMPLOYEE_UPDATED',
      entity: 'Employee',
      entityId: employee._id.toString(),
      before,
      after,
    });

    return employee;
  }

  /**
   * Sets employee status to exited, revokes active session tokens, and deactivates linked user account.
   */
  async exitEmployee(
    id: string,
    input: ExitEmployeeInput,
    req?: Request
  ): Promise<IEmployeeDocument> {
    const employee = await Employee.findById(id);
    if (!employee) {
      throw AppError.notFound('Employee');
    }

    if (employee.status === 'exited') {
      throw AppError.badRequest('Employee is already marked as exited');
    }

    if (input.exitDate < employee.joiningDate) {
      throw AppError.badRequest(
        `Exit date (${input.exitDate}) cannot be before joining date (${employee.joiningDate})`
      );
    }

    const before = {
      status: employee.status,
      exitDate: employee.exitDate,
      exitReason: employee.exitReason,
    };

    employee.status = 'exited';
    employee.exitDate = input.exitDate;
    employee.exitReason = input.reason.trim();
    await employee.save();

    // Deactivate linked user login and increment tokenVersion so existing tokens are immediately invalidated
    const user = await User.findById(employee.userId);
    if (user) {
      user.isActive = false;
      user.tokenVersion += 1;
      await user.save();
    }

    await auditService.log({
      req,
      action: 'EMPLOYEE_EXITED',
      entity: 'Employee',
      entityId: employee._id.toString(),
      before,
      after: {
        status: employee.status,
        exitDate: employee.exitDate,
        exitReason: employee.exitReason,
      },
    });

    return employee;
  }

  /**
   * Builds the Employee 360 overview.
   */
  async getEmployee360(
    id: string,
    viewer: { _id: string; role: string; employeeId?: Types.ObjectId | string }
  ) {
    const employee = await this.getById(id, viewer);
    const tenure = computeTenure(employee.joiningDate, employee.exitDate);

    // Salary is visible only to HR and Admin
    let salaryData = null;
    if (viewer.role === 'hr' || viewer.role === 'admin') {
      const { salaryService } = await import('./salary.service');
      const current = await salaryService.getCurrent(employee._id.toString());
      const history = await salaryService.getHistory(employee._id.toString());
      salaryData = { current, history };
    }

    const sections = await sectionProviders.buildSections(employee._id.toString(), {
      _id: viewer._id,
      role: viewer.role,
    });

    return {
      profile: employee,
      department: employee.departmentId,
      designation: employee.designationId,
      tenure,
      salary: salaryData,
      sections,
    };
  }
}

export const employeeService = new EmployeeService();

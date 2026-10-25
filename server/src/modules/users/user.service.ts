import { Request } from 'express';
import { Types } from 'mongoose';
import { User, IUserDocument } from './user.model';
import { Role } from '../../constants/roles';
import { AppError } from '../../utils/AppError';
import { hashPassword, generateTempPassword } from '../../utils/password';
import { auditService, computeDiff } from '../audit/audit.service';
import { CreateHrUserInput, UpdateUserInput } from './user.schema';

export interface CreateUserData {
  name: string;
  email: string;
  password?: string;
  role: Role;
  employeeId?: Types.ObjectId | string;
  mustChangePassword?: boolean;
}

export interface UserFilterQuery {
  role?: string;
  isActive?: string | boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export class UserService {
  async createUser(data: CreateUserData, req?: Request): Promise<{ user: IUserDocument; tempPassword?: string }> {
    if (data.role === 'admin') {
      throw AppError.forbidden('Admin accounts cannot be created via standard user registration');
    }

    const email = data.email.toLowerCase().trim();
    const existing = await User.findOne({ email });
    if (existing) {
      throw AppError.conflict('A user with this email already exists');
    }

    let initialPassword = data.password;
    let generated = false;
    if (!initialPassword) {
      initialPassword = generateTempPassword();
      generated = true;
    }

    const passwordHash = await hashPassword(initialPassword);

    const user = await User.create({
      name: data.name.trim(),
      email,
      passwordHash,
      role: data.role,
      employeeId: data.employeeId ? new Types.ObjectId(data.employeeId) : undefined,
      mustChangePassword: data.mustChangePassword !== undefined ? data.mustChangePassword : generated,
      isActive: true,
      tokenVersion: 0,
      failedLoginAttempts: 0,
    });

    await auditService.log({
      req,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: user._id.toString(),
      after: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    return {
      user,
      tempPassword: generated ? initialPassword : undefined,
    };
  }

  async createHrUser(
    data: CreateHrUserInput,
    req?: Request
  ): Promise<{ user: IUserDocument; tempPassword: string }> {
    const result = await this.createUser(
      {
        name: data.name,
        email: data.email,
        role: 'hr',
        mustChangePassword: true,
      },
      req
    );

    return {
      user: result.user,
      tempPassword: result.tempPassword!,
    };
  }

  async list(filters: UserFilterQuery): Promise<{
    users: IUserDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (filters.role) {
      query.role = filters.role;
    }

    if (filters.isActive !== undefined && filters.isActive !== '') {
      query.isActive = filters.isActive === 'true' || filters.isActive === true;
    }

    if (filters.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [{ name: regex }, { email: regex }];
    }

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(query),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(id: string | Types.ObjectId): Promise<IUserDocument | null> {
    return User.findById(id);
  }

  async getById(id: string): Promise<IUserDocument> {
    const user = await User.findById(id);
    if (!user) {
      throw AppError.notFound('User');
    }
    return user;
  }

  async findByEmail(email: string): Promise<IUserDocument | null> {
    return User.findOne({ email: email.toLowerCase().trim() });
  }

  async updateUser(id: string, data: UpdateUserInput, req?: Request): Promise<IUserDocument> {
    const user = await this.getById(id);

    const beforeState = { name: user.name };
    user.name = data.name.trim();
    await user.save();

    const afterState = { name: user.name };
    const { before, after } = computeDiff(beforeState, afterState);

    await auditService.log({
      req,
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: user._id.toString(),
      before,
      after,
    });

    return user;
  }

  async setUserActive(
    targetUserId: string,
    isActive: boolean,
    currentAdmin: IUserDocument,
    req?: Request
  ): Promise<IUserDocument> {
    const targetUser = await this.getById(targetUserId);

    if (!isActive) {
      // 1. Admin cannot deactivate their own account
      if (currentAdmin._id.toString() === targetUser._id.toString()) {
        throw AppError.badRequest('You cannot deactivate your own administrative account');
      }

      // 2. The last active admin can never be deactivated
      if (targetUser.role === 'admin') {
        const activeAdminCount = await User.countDocuments({
          role: 'admin',
          isActive: true,
        });
        if (activeAdminCount <= 1) {
          throw AppError.badRequest('Cannot deactivate the last active administrator account');
        }
      }
    }

    const before = { isActive: targetUser.isActive };
    targetUser.isActive = isActive;
    if (!isActive) {
      // Invalidate existing sessions immediately upon deactivation
      targetUser.tokenVersion += 1;
    }
    await targetUser.save();

    await auditService.log({
      req,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entity: 'User',
      entityId: targetUser._id.toString(),
      before,
      after: { isActive: targetUser.isActive },
    });

    return targetUser;
  }

  async resetPasswordByAdmin(
    targetUserId: string,
    req?: Request
  ): Promise<{ tempPassword: string }> {
    const user = await this.getById(targetUserId);

    if (user.role === 'admin') {
      throw AppError.forbidden(
        'Administrator accounts cannot be reset via this endpoint; administrators must use change-password'
      );
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    user.passwordHash = passwordHash;
    user.mustChangePassword = true;
    user.tokenVersion += 1;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.passwordChangedAt = new Date();
    await user.save();

    await auditService.log({
      req,
      action: 'PASSWORD_RESET_BY_ADMIN',
      entity: 'User',
      entityId: user._id.toString(),
      after: {
        mustChangePassword: true,
        tokenVersion: user.tokenVersion,
      },
    });

    return { tempPassword };
  }
}

export const userService = new UserService();

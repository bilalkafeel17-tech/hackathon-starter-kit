import { Request } from 'express';
import { Types } from 'mongoose';
import { User, IUserDocument } from '../users/user.model';
import { LoginInput, ChangePasswordInput } from './auth.schema';
import { AppError } from '../../utils/AppError';
import {
  comparePassword,
  dummyCompare,
  hashPassword,
} from '../../utils/password';
import { signToken } from '../../utils/jwt';
import { auditService } from '../audit/audit.service';

export class AuthService {
  async login(
    credentials: LoginInput,
    req?: Request
  ): Promise<{ token: string; user: IUserDocument; mustChangePassword: boolean }> {
    const email = credentials.email.toLowerCase().trim();

    const user = await User.findOne({ email }).select(
      '+passwordHash +failedLoginAttempts +lockUntil +isActive +tokenVersion +mustChangePassword'
    );

    // Check account lockout
    if (user?.lockUntil && user.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockUntil.getTime() - Date.now()) / (60 * 1000)
      );
      throw new AppError(
        `Account is temporarily locked due to consecutive failed attempts. Try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
        423,
        'ACCOUNT_LOCKED',
        { remainingMinutes }
      );
    }

    // Generic error on missing user or inactive account — perform dummy compare to prevent timing enumeration
    if (!user || !user.isActive) {
      await dummyCompare(credentials.password);
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await comparePassword(credentials.password, user.passwordHash);

    if (!isMatch) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        await auditService.log({
          req,
          actor: { id: user._id, name: user.name, role: user.role },
          action: 'ACCOUNT_LOCKED',
          entity: 'User',
          entityId: user._id.toString(),
          after: {
            lockUntil: user.lockUntil,
            consecutiveFailures: user.failedLoginAttempts,
          },
        });

        throw new AppError(
          'Account is temporarily locked due to consecutive failed attempts. Try again in 15 minutes.',
          423,
          'ACCOUNT_LOCKED',
          { remainingMinutes: 15 }
        );
      }

      await user.save();
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Login successful — reset counters
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken({
      sub: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    return {
      token,
      user,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async changePassword(
    userId: string | Types.ObjectId,
    input: ChangePasswordInput,
    req?: Request
  ): Promise<{ token: string; user: IUserDocument }> {
    const user = await User.findById(userId).select('+passwordHash +tokenVersion');
    if (!user) {
      throw AppError.notFound('User');
    }

    const isCurrentValid = await comparePassword(input.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
    }

    const newHash = await hashPassword(input.newPassword);
    user.passwordHash = newHash;
    user.mustChangePassword = false;
    user.tokenVersion += 1;
    user.passwordChangedAt = new Date();
    await user.save();

    await auditService.log({
      req,
      actor: { id: user._id, name: user.name, role: user.role },
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entityId: user._id.toString(),
      after: {
        passwordChangedAt: user.passwordChangedAt,
      },
    });

    const token = signToken({
      sub: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    return { token, user };
  }

  async logoutAll(userId: string | Types.ObjectId, req?: Request): Promise<{ message: string }> {
    const user = await User.findById(userId);
    if (!user) {
      throw AppError.notFound('User');
    }

    user.tokenVersion += 1;
    await user.save();

    await auditService.log({
      req,
      actor: { id: user._id, name: user.name, role: user.role },
      action: 'LOGOUT_ALL',
      entity: 'User',
      entityId: user._id.toString(),
    });

    return { message: 'All active sessions have been invalidated' };
  }
}

export const authService = new AuthService();

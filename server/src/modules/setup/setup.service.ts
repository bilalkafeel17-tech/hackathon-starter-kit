import mongoose from 'mongoose';
import { Request } from 'express';
import { User, IUserDocument } from '../users/user.model';
import { Settings, ISettings } from '../settings/settings.model';
import { SetupCompanyInput } from './setup.schema';
import { AppError } from '../../utils/AppError';
import { hashPassword } from '../../utils/password';
import { signToken } from '../../utils/jwt';
import { auditService } from '../audit/audit.service';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export class SetupService {
  async getStatus(): Promise<{ initialized: boolean; dbConnected: boolean }> {
    if (mongoose.connection.readyState !== 1) {
      return { initialized: false, dbConnected: false };
    }
    const adminExists = await User.exists({ role: 'admin' });
    return { initialized: Boolean(adminExists), dbConnected: true };
  }

  async setupCompany(
    data: SetupCompanyInput,
    req?: Request
  ): Promise<{ token: string; user: IUserDocument; settings: ISettings }> {
    if (mongoose.connection.readyState !== 1) {
      throw new AppError('Database is connecting to MongoDB Atlas. Please try again in a moment.', 503, 'DB_CONNECTING');
    }
    // 1. Initial existence check
    const adminExists = await User.exists({ role: 'admin' });
    if (adminExists) {
      throw new AppError('Company setup has already been completed', 409, 'SETUP_ALREADY_DONE');
    }

    // 2. Race-safe setup using transaction where supported, with atomic unique fallback
    const session = await mongoose.startSession().catch(() => null);
    const client = (mongoose.connection as any).client;
    const hasTransactions = Boolean(session && client?.topology?.description?.type !== 'Single');

    const executeSetup = async (currentSession?: mongoose.ClientSession): Promise<{
      token: string;
      user: IUserDocument;
      settings: ISettings;
    }> => {
      // Check again inside transaction if active
      if (currentSession) {
        const adminCheck = await User.exists({ role: 'admin' }).session(currentSession);
        if (adminCheck) {
          throw new AppError('Company setup has already been completed', 409, 'SETUP_ALREADY_DONE');
        }
      }

      // Create singleton settings doc — unique index on key='company' blocks race condition
      let settings: ISettings;
      try {
        const settingsDocs = await Settings.create(
          [
            {
              key: 'company',
              companyName: data.companyName.trim(),
              setupCompletedAt: new Date(),
            },
          ],
          currentSession ? { session: currentSession } : {}
        );
        settings = settingsDocs[0];
      } catch (err: any) {
        if (err.code === 11000) {
          throw new AppError('Company setup has already been completed', 409, 'SETUP_ALREADY_DONE');
        }
        throw err;
      }

      const passwordHash = await hashPassword(data.adminPassword);

      const userDocs = await User.create(
        [
          {
            name: data.adminName.trim(),
            email: data.adminEmail.toLowerCase().trim(),
            passwordHash,
            role: 'admin',
            isActive: true,
            mustChangePassword: false,
            tokenVersion: 0,
            failedLoginAttempts: 0,
          },
        ],
        currentSession ? { session: currentSession } : {}
      );
      const user = userDocs[0];

      return {
        token: signToken({
          sub: user._id.toString(),
          role: user.role,
          tokenVersion: user.tokenVersion,
        }),
        user,
        settings,
      };
    };

    let result: { token: string; user: IUserDocument; settings: ISettings };

    if (hasTransactions && session) {
      try {
        session.startTransaction();
        result = await executeSetup(session);
        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        await session.endSession();
      }
    } else {
      if (session) {
        await session.endSession().catch(() => {});
      }
      result = await executeSetup();
    }

    // Record audit entry
    await auditService.log({
      req,
      actor: {
        id: result.user._id,
        name: result.user.name,
        role: result.user.role,
      },
      action: 'SETUP_COMPLETED',
      entity: 'Company',
      entityId: result.settings._id.toString(),
      after: {
        companyName: result.settings.companyName,
        adminEmail: result.user.email,
        adminName: result.user.name,
      },
    });

    return result;
  }

  async autoSetupFromEnv(): Promise<void> {
    if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
      return;
    }

    const adminExists = await User.exists({ role: 'admin' });
    if (adminExists) {
      return;
    }

    const companyName = env.COMPANY_NAME || 'My Company';

    logger.info(`Auto-provisioning initial admin account from environment (${env.ADMIN_EMAIL})`);

    try {
      await this.setupCompany({
        companyName,
        adminName: 'Administrator',
        adminEmail: env.ADMIN_EMAIL,
        adminPassword: env.ADMIN_PASSWORD,
      });
      logger.info('Initial admin account successfully provisioned');
    } catch (err: any) {
      if (err.code !== 'SETUP_ALREADY_DONE') {
        logger.error({ err: err.message }, 'Failed to provision admin account from environment');
      }
    }
  }
}

export const setupService = new SetupService();

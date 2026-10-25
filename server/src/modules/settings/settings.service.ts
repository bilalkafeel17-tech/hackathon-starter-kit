import { Request } from 'express';
import { Settings, ISettings } from './settings.model';
import { UpdateSettingsInput } from './settings.schema';
import { AppError } from '../../utils/AppError';
import { auditService, computeDiff } from '../audit/audit.service';

export interface PublicSettings {
  companyName: string;
  officeStart: string;
  graceMinutes: number;
  halfDayHours: number;
  weekendDays: number[];
  timezone: string;
}

export interface RulesSnapshot {
  officeStart: string;
  graceMinutes: number;
  halfDayHours: number;
  weekendDays: number[];
  timezone: string;
  version: number;
}

export class SettingsService {
  async get(): Promise<ISettings> {
    const settings = await Settings.findOne({ key: 'company' });
    if (!settings) {
      throw AppError.notFound('Company settings not found — initial setup required');
    }
    return settings;
  }

  async getPublic(): Promise<PublicSettings> {
    const settings = await this.get();
    return {
      companyName: settings.companyName,
      officeStart: settings.officeStart,
      graceMinutes: settings.graceMinutes,
      halfDayHours: settings.halfDayHours,
      weekendDays: settings.weekendDays,
      timezone: settings.timezone,
    };
  }

  /**
   * Attendance records store this rules snapshot upon creation so subsequent
   * organization setting updates do not retroactively alter historical attendance records.
   */
  async getRulesSnapshot(): Promise<RulesSnapshot> {
    const settings = await this.get();
    return {
      officeStart: settings.officeStart,
      graceMinutes: settings.graceMinutes,
      halfDayHours: settings.halfDayHours,
      weekendDays: settings.weekendDays,
      timezone: settings.timezone,
      version: settings.version,
    };
  }

  async update(input: UpdateSettingsInput, req?: Request): Promise<ISettings> {
    const settings = await Settings.findOne({ key: 'company' });
    if (!settings) {
      throw AppError.notFound('Company settings not found — initial setup required');
    }

    const beforeState: Record<string, unknown> = {
      companyName: settings.companyName,
      officeStart: settings.officeStart,
      graceMinutes: settings.graceMinutes,
      halfDayHours: settings.halfDayHours,
      weekendDays: settings.weekendDays,
      timezone: settings.timezone,
      office: settings.office,
    };

    if (input.companyName !== undefined) settings.companyName = input.companyName;
    if (input.officeStart !== undefined) settings.officeStart = input.officeStart;
    if (input.graceMinutes !== undefined) settings.graceMinutes = input.graceMinutes;
    if (input.halfDayHours !== undefined) settings.halfDayHours = input.halfDayHours;
    if (input.weekendDays !== undefined) settings.weekendDays = input.weekendDays;
    if (input.timezone !== undefined) settings.timezone = input.timezone;
    if (input.office !== undefined) {
      settings.office = {
        lat: input.office.lat,
        lng: input.office.lng,
        radiusMeters: input.office.radiusMeters,
      };
    }

    // Increment version tracking
    settings.version = (settings.version || 1) + 1;
    if ((req as any)?.user?._id) {
      settings.updatedBy = (req as any).user._id;
    }

    await settings.save();

    const afterState: Record<string, unknown> = {
      companyName: settings.companyName,
      officeStart: settings.officeStart,
      graceMinutes: settings.graceMinutes,
      halfDayHours: settings.halfDayHours,
      weekendDays: settings.weekendDays,
      timezone: settings.timezone,
      office: settings.office,
    };

    const { before, after } = computeDiff(beforeState, afterState);

    await auditService.log({
      req,
      action: 'SETTINGS_UPDATED',
      entity: 'Settings',
      entityId: settings._id.toString(),
      before,
      after,
    });

    return settings;
  }
}

export const settingsService = new SettingsService();

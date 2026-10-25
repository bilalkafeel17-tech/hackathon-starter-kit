import { Request } from 'express';
import { Holiday, IHoliday } from './holiday.model';
import {
  CreateHolidayInput,
  BulkHolidaysInput,
  UpdateHolidayInput,
} from './holiday.schema';
import { AppError } from '../../utils/AppError';
import { auditService, computeDiff } from '../audit/audit.service';
import { isValidDateKey } from '../../utils/date';

export interface HolidayFilterQuery {
  year?: string | number;
  from?: string;
  to?: string;
  isActive?: string | boolean;
}

export class HolidayService {
  async create(data: CreateHolidayInput, req?: Request): Promise<IHoliday> {
    const existing = await Holiday.findOne({ date: data.date });
    if (existing) {
      throw AppError.conflict(`A holiday on date '${data.date}' already exists`);
    }

    const holiday = await Holiday.create({
      name: data.name.trim(),
      date: data.date,
      isActive: true,
    });

    await auditService.log({
      req,
      action: 'HOLIDAY_CREATED',
      entity: 'Holiday',
      entityId: holiday._id.toString(),
      after: {
        name: holiday.name,
        date: holiday.date,
      },
    });

    return holiday;
  }

  async bulkCreate(
    data: BulkHolidaysInput,
    req?: Request
  ): Promise<{ created: IHoliday[]; count: number }> {
    const rowErrors: Array<{ row: number; field: string; message: string }> = [];
    const seenDates = new Set<string>();

    data.holidays.forEach((item, index) => {
      const row = index + 1;
      if (!isValidDateKey(item.date)) {
        rowErrors.push({ row, field: 'date', message: `Invalid date: ${item.date}` });
      }
      if (!item.name || item.name.trim().length === 0) {
        rowErrors.push({ row, field: 'name', message: 'Holiday name cannot be empty' });
      }
      if (seenDates.has(item.date)) {
        rowErrors.push({
          row,
          field: 'date',
          message: `Duplicate date '${item.date}' within bulk request`,
        });
      }
      seenDates.add(item.date);
    });

    if (rowErrors.length > 0) {
      throw AppError.unprocessable('Bulk holiday validation failed', rowErrors);
    }

    // Check existing dates in database
    const existingDates = await Holiday.find({ date: { $in: Array.from(seenDates) } }).select('date');
    if (existingDates.length > 0) {
      const conflicts = existingDates.map((h) => h.date);
      throw AppError.conflict(
        `One or more dates already exist as holidays: ${conflicts.join(', ')}`
      );
    }

    const created = await Holiday.insertMany(
      data.holidays.map((h) => ({
        name: h.name.trim(),
        date: h.date,
        isActive: true,
      }))
    );

    await auditService.log({
      req,
      action: 'HOLIDAYS_BULK_CREATED',
      entity: 'Holiday',
      after: {
        count: created.length,
        dates: created.map((h) => h.date),
      },
    });

    return { created, count: created.length };
  }

  async list(filters: HolidayFilterQuery): Promise<IHoliday[]> {
    const query: Record<string, any> = {};

    if (filters.isActive !== undefined && filters.isActive !== '') {
      query.isActive = filters.isActive === 'true' || filters.isActive === true;
    }

    if (filters.year) {
      const yearStr = String(filters.year);
      query.date = {
        $gte: `${yearStr}-01-01`,
        $lte: `${yearStr}-12-31`,
      };
    } else if (filters.from || filters.to) {
      query.date = {};
      if (filters.from) query.date.$gte = filters.from;
      if (filters.to) query.date.$lte = filters.to;
    }

    return Holiday.find(query).sort({ date: 1 });
  }

  async getById(id: string): Promise<IHoliday> {
    const holiday = await Holiday.findById(id);
    if (!holiday) {
      throw AppError.notFound('Holiday');
    }
    return holiday;
  }

  async update(id: string, data: UpdateHolidayInput, req?: Request): Promise<IHoliday> {
    const holiday = await this.getById(id);

    const beforeState = {
      name: holiday.name,
      date: holiday.date,
      isActive: holiday.isActive,
    };

    if (data.date !== undefined && data.date !== holiday.date) {
      const conflict = await Holiday.findOne({ date: data.date, _id: { $ne: holiday._id } });
      if (conflict) {
        throw AppError.conflict(`A holiday on date '${data.date}' already exists`);
      }
      holiday.date = data.date;
    }

    if (data.name !== undefined) {
      holiday.name = data.name.trim();
    }

    if (data.isActive !== undefined) {
      holiday.isActive = data.isActive;
    }

    await holiday.save();

    const afterState = {
      name: holiday.name,
      date: holiday.date,
      isActive: holiday.isActive,
    };

    const { before, after } = computeDiff(beforeState, afterState);

    await auditService.log({
      req,
      action: 'HOLIDAY_UPDATED',
      entity: 'Holiday',
      entityId: holiday._id.toString(),
      before,
      after,
    });

    return holiday;
  }

  async delete(id: string, req?: Request): Promise<{ message: string }> {
    const holiday = await this.getById(id);

    await Holiday.deleteOne({ _id: holiday._id });

    await auditService.log({
      req,
      action: 'HOLIDAY_DELETED',
      entity: 'Holiday',
      entityId: holiday._id.toString(),
      before: {
        name: holiday.name,
        date: holiday.date,
      },
    });

    return { message: 'Holiday deleted successfully' };
  }

  /**
   * Returns a Set of date strings (YYYY-MM-DD) for active holidays in the given range.
   */
  async getHolidayDateKeys(from: string, to: string): Promise<Set<string>> {
    const holidays = await Holiday.find({
      date: { $gte: from, $lte: to },
      isActive: true,
    }).select('date');

    return new Set(holidays.map((h) => h.date));
  }
}

export const holidayService = new HolidayService();

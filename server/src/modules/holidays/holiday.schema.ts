import { z } from 'zod';
import { isValidDateKey } from '../../utils/date';

export const createHolidaySchema = z.object({
  name: z.string().trim().min(1, 'Holiday name is required').max(100),
  date: z
    .string()
    .trim()
    .refine(isValidDateKey, 'Date must be a valid calendar date in YYYY-MM-DD format'),
});

export const bulkHolidaysSchema = z.object({
  holidays: z
    .array(createHolidaySchema)
    .min(1, 'At least one holiday must be provided')
    .max(50, 'Cannot exceed 50 holidays in a single bulk request'),
});

export const updateHolidaySchema = z.object({
  name: z.string().trim().min(1, 'Holiday name is required').max(100).optional(),
  date: z
    .string()
    .trim()
    .refine(isValidDateKey, 'Date must be a valid calendar date in YYYY-MM-DD format')
    .optional(),
  isActive: z.boolean().optional(),
});

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type BulkHolidaysInput = z.infer<typeof bulkHolidaysSchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;

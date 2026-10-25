import { z } from 'zod';
import { isValidTimeZone } from '../../utils/date';

export const updateSettingsSchema = z
  .object({
    companyName: z
      .string()
      .trim()
      .min(2, 'Company name must be at least 2 characters')
      .max(100, 'Company name must not exceed 100 characters')
      .optional(),
    officeStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'officeStart must be in 24-hour HH:mm format')
      .optional(),
    graceMinutes: z
      .number()
      .int()
      .min(0, 'graceMinutes must be between 0 and 120')
      .max(120, 'graceMinutes must be between 0 and 120')
      .optional(),
    halfDayHours: z
      .number()
      .min(1, 'halfDayHours must be between 1 and 12')
      .max(12, 'halfDayHours must be between 1 and 12')
      .optional(),
    weekendDays: z
      .array(z.number().int().min(0).max(6))
      .min(0, 'At least 0 weekend days')
      .max(3, 'At most 3 weekend days allowed')
      .refine(
        (days) => new Set(days).size === days.length,
        'weekendDays must contain unique values'
      )
      .optional(),
    timezone: z
      .string()
      .refine(isValidTimeZone, 'Invalid IANA timezone identifier')
      .optional(),
    office: z
      .object({
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        radiusMeters: z.number().min(20).max(5000).default(150),
      })
      .refine(
        (data) =>
          (data.lat === undefined && data.lng === undefined) ||
          (data.lat !== undefined && data.lng !== undefined),
        {
          message: 'Latitude and longitude must be provided together',
          path: ['lat'],
        }
      )
      .optional(),
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

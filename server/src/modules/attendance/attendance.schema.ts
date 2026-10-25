import { z } from 'zod';
import { isValidDateKey, todayInCompanyTz } from '../../utils/date';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const checkInSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).optional(),
  faceCount: z.number().int().min(0).optional(),
  source: z.enum(['web', 'camera']).optional().default('web'),
});

export const checkOutSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).optional(),
  faceCount: z.number().int().min(0).optional(),
  source: z.enum(['web', 'camera']).optional().default('web'),
});

export const createCorrectionSchema = z.object({
  dateKey: z
    .string()
    .trim()
    .refine(isValidDateKey, { message: 'Must be a valid calendar date in YYYY-MM-DD format' })
    .refine((val) => val <= todayInCompanyTz(), { message: 'Cannot request corrections for future dates' }),
  requestedCheckIn: z.string().trim().regex(timeRegex, 'Must be in HH:mm 24-hour format'),
  requestedCheckOut: z.string().trim().regex(timeRegex, 'Must be in HH:mm 24-hour format').optional(),
  reason: z
    .string()
    .trim()
    .min(10, 'Reason must be at least 10 characters long')
    .max(500, 'Reason cannot exceed 500 characters'),
});

export const approveCorrectionSchema = z.object({
  comment: z.string().trim().max(500).optional(),
});

export const rejectCorrectionSchema = z.object({
  comment: z.string().trim().min(2, 'A rejection reason comment is required').max(500),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type CreateCorrectionInput = z.infer<typeof createCorrectionSchema>;
export type ApproveCorrectionInput = z.infer<typeof approveCorrectionSchema>;
export type RejectCorrectionInput = z.infer<typeof rejectCorrectionSchema>;

import { z } from 'zod';

export const generateRunSchema = z.object({
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format'),
});

export const adjustItemSchema = z.object({
  amount: z.number().refine((val) => val !== 0, { message: 'Adjustment amount cannot be zero' }),
  reason: z.string().trim().min(2, 'Reason must be provided').max(500),
});

export type GenerateRunInput = z.infer<typeof generateRunSchema>;
export type AdjustItemInput = z.infer<typeof adjustItemSchema>;

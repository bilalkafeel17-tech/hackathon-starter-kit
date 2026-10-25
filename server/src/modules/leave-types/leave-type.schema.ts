import { z } from 'zod';

const codeSlugRegex = /^[a-z0-9_-]+$/;

export const createLeaveTypeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'Code must be at least 2 characters')
    .max(50, 'Code must not exceed 50 characters')
    .regex(codeSlugRegex, 'Code must be a lowercase slug containing only letters, numbers, hyphens or underscores'),
  yearlyQuota: z
    .number()
    .min(0, 'Yearly quota must be 0 or greater')
    .nullable()
    .optional()
    .transform((val) => (val === undefined ? null : val)),
  isPaid: z.boolean().default(true),
});

export const updateLeaveTypeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100).optional(),
  yearlyQuota: z.number().min(0, 'Yearly quota must be 0 or greater').nullable().optional(),
  isPaid: z.boolean().optional(),
});

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;

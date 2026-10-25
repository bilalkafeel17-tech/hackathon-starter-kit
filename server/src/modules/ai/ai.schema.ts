import { z } from 'zod';

export const chatBodySchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1),
      })
    )
    .max(6, 'History can contain at most 6 turns')
    .optional()
    .default([]),
});

export const dashboardSummaryBodySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  departmentId: z.string().optional(),
});

export const smartLeaveBodySchema = z.object({
  text: z.string().trim().min(3, 'Text must be at least 3 characters'),
});


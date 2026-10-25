import { z } from 'zod';
import { isValidDateKey } from '../../utils/date';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const applyLeaveSchema = z
  .object({
    leaveTypeId: z.string().trim().regex(objectIdRegex, 'Invalid leave type ID'),
    startDate: z.string().trim().refine(isValidDateKey, { message: 'Start date must be a valid YYYY-MM-DD date' }),
    endDate: z.string().trim().refine(isValidDateKey, { message: 'End date must be a valid YYYY-MM-DD date' }),
    reason: z.string().trim().min(3, 'Reason must be at least 3 characters long').max(500),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: 'Start date cannot be after end date',
    path: ['endDate'],
  });

export const approveLeaveSchema = z.object({
  comment: z.string().trim().max(500).optional(),
});

export const rejectLeaveSchema = z.object({
  comment: z.string().trim().min(2, 'Rejection reason comment is required').max(500),
});

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>;
export type RejectLeaveInput = z.infer<typeof rejectLeaveSchema>;

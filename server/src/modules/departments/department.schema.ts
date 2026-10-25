import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, 'Department name is required').max(100),
  code: z.string().trim().min(1).max(20).toUpperCase().optional(),
  description: z.string().trim().max(500).optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1, 'Department name is required').max(100).optional(),
  code: z.string().trim().min(1).max(20).toUpperCase().optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

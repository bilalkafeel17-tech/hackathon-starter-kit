import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createDesignationSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100),
  departmentId: z
    .string()
    .trim()
    .regex(objectIdRegex, 'Invalid departmentId')
    .optional()
    .nullable(),
  level: z.string().trim().max(50).optional().nullable(),
});

export const updateDesignationSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100).optional(),
  departmentId: z
    .string()
    .trim()
    .regex(objectIdRegex, 'Invalid departmentId')
    .optional()
    .nullable(),
  level: z.string().trim().max(50).optional().nullable(),
});

export type CreateDesignationInput = z.infer<typeof createDesignationSchema>;
export type UpdateDesignationInput = z.infer<typeof updateDesignationSchema>;

import { z } from 'zod';

export const createHrUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Valid email is required').toLowerCase(),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    email: z.string().optional(),
  })
  .refine((data) => data.email === undefined, {
    message: 'Email address cannot be changed in this version',
    path: ['email'],
  });

export type CreateHrUserInput = z.infer<typeof createHrUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

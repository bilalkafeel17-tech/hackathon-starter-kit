import { z } from 'zod';
import { passwordSchema } from '../../utils/password';

export const setupCompanySchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(100),
  adminName: z.string().trim().min(1, 'Admin name is required').max(100),
  adminEmail: z.string().trim().email('Valid email is required').toLowerCase(),
  adminPassword: passwordSchema,
});

export type SetupCompanyInput = z.infer<typeof setupCompanySchema>;

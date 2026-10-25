import { z } from 'zod';
import { isValidDateKey, todayInCompanyTz } from '../../utils/date';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const phoneRegex = /^[\d\s+\-]{7,20}$/;

const phoneSchema = z
  .string()
  .trim()
  .refine((val) => {
    if (!phoneRegex.test(val)) return false;
    const digitsOnly = val.replace(/\D/g, '');
    return digitsOnly.length >= 7 && digitsOnly.length <= 15;
  }, {
    message: 'Phone number must contain between 7 and 15 digits',
  });

const pastDateSchema = z
  .string()
  .trim()
  .refine(isValidDateKey, { message: 'Must be a valid calendar date in YYYY-MM-DD format' })
  .refine((val) => val < todayInCompanyTz(), { message: 'Date of birth must be in the past' });

const joiningDateSchema = z
  .string()
  .trim()
  .refine(isValidDateKey, { message: 'Must be a valid calendar date in YYYY-MM-DD format' })
  .refine(
    (val) => {
      const today = todayInCompanyTz();
      const [yearStr, monthStr, dayStr] = today.split('-');
      const maxYear = Number(yearStr) + 1;
      const maxJoiningDate = `${maxYear}-${monthStr}-${dayStr}`;
      return val <= maxJoiningDate;
    },
    { message: 'Joining date cannot be more than 1 year in the future' }
  );

export const salaryInputSchema = z.object({
  basic: z.number().positive('Basic salary must be greater than 0').max(99999999.99, 'Basic salary exceeds limit'),
  extraAllowance: z.number().min(0, 'Extra allowance cannot be negative').optional().default(0),
});

export const updateSalarySchema = z.object({
  basic: z.number().positive('Basic salary must be greater than 0').max(99999999.99, 'Basic salary exceeds limit'),
  extraAllowance: z.number().min(0, 'Extra allowance cannot be negative').optional().default(0),
  effectiveFrom: z
    .string()
    .trim()
    .refine(isValidDateKey, { message: 'Must be a valid calendar date in YYYY-MM-DD format' })
    .optional(),
});

export const registerEmployeeSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .regex(/^EMP-\d{4,}$/i, 'Employee code must follow format EMP-0001')
    .optional(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters'),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  phone: phoneSchema,
  address: z.string().trim().max(500).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: pastDateSchema.optional(),
  joiningDate: joiningDateSchema,
  departmentId: z.string().trim().regex(objectIdRegex, 'Invalid department ID'),
  designationId: z.string().trim().regex(objectIdRegex, 'Invalid designation ID'),
  employmentType: z.enum(['full_time', 'part_time', 'contract']).default('full_time'),
  status: z.enum(['probation', 'active']).default('probation'),
  probationEndDate: z.string().trim().refine(isValidDateKey, { message: 'Invalid probation end date' }).optional(),
  emergencyContact: z
    .object({
      name: z.string().trim().max(100).optional(),
      phone: z.string().trim().max(30).optional(),
      relation: z.string().trim().max(50).optional(),
    })
    .optional(),
  salary: salaryInputSchema,
});

export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: phoneSchema.optional(),
  address: z.string().trim().max(500).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: pastDateSchema.optional(),
  departmentId: z.string().trim().regex(objectIdRegex, 'Invalid department ID').optional(),
  designationId: z.string().trim().regex(objectIdRegex, 'Invalid designation ID').optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract']).optional(),
  status: z.enum(['probation', 'active']).optional(),
  probationEndDate: z.string().trim().refine(isValidDateKey, { message: 'Invalid probation end date' }).optional(),
  emergencyContact: z
    .object({
      name: z.string().trim().max(100).optional(),
      phone: z.string().trim().max(30).optional(),
      relation: z.string().trim().max(50).optional(),
    })
    .optional(),
});

export const updateSelfContactSchema = z
  .object({
    phone: phoneSchema.optional(),
    address: z.string().trim().max(500).optional(),
  })
  .strict();

export const exitEmployeeSchema = z.object({
  exitDate: z.string().trim().refine(isValidDateKey, { message: 'Must be a valid calendar date in YYYY-MM-DD format' }),
  reason: z.string().trim().min(2, 'Exit reason must be provided').max(500),
});

export type RegisterEmployeeInput = z.infer<typeof registerEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type UpdateSelfContactInput = z.infer<typeof updateSelfContactSchema>;
export type UpdateSalaryInput = z.infer<typeof updateSalarySchema>;
export type ExitEmployeeInput = z.infer<typeof exitEmployeeSchema>;

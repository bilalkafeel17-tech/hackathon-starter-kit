import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().nonnegative().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().url('CLIENT_URL must be a valid URL').default('http://localhost:5173'),
  ADMIN_EMAIL: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
  ADMIN_PASSWORD: z.string().min(8).optional().or(z.literal('')).transform(v => v || undefined),
  COMPANY_NAME: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  AI_PROVIDER: z.enum(['openai', 'gemini', 'grok']).default('openai'),
  AI_API_KEY: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  GEMINI_API_KEY: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  GROK_API_KEY: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  AI_MODEL: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  AI_BASE_URL: z.string().optional().or(z.literal('')).transform(v => v || undefined),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error('[startup] Environment validation failed:\n' + issues);
  console.error('\nCheck server/.env against server/.env.example and fix the above variables.');
  process.exit(1);
}

export const env = result.data;

export type Env = typeof env;

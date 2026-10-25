import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(72, 'Password must not exceed 72 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Precomputed bcrypt cost-12 hash used for timing-safe dummy comparisons
const DUMMY_HASH = '$2a$12$e8sHwL7vGzE/n3rKk3s76.3u4M0L1h2e3r4e5n6o7t8r9e0a1l2h3';

export async function dummyCompare(password: string): Promise<boolean> {
  return bcrypt.compare(password, DUMMY_HASH);
}

// Character set without confusing characters: excludes 0, O, o, 1, l, I
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*';
const ALL_SAFE = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;

export function generateTempPassword(length = 12): string {
  // Ensure at least one from each required class
  const required = [
    UPPERCASE[crypto.randomInt(0, UPPERCASE.length)],
    LOWERCASE[crypto.randomInt(0, LOWERCASE.length)],
    DIGITS[crypto.randomInt(0, DIGITS.length)],
    SYMBOLS[crypto.randomInt(0, SYMBOLS.length)],
  ];

  const remainingLength = Math.max(0, length - required.length);
  const remaining: string[] = [];
  for (let i = 0; i < remainingLength; i++) {
    remaining.push(ALL_SAFE[crypto.randomInt(0, ALL_SAFE.length)]);
  }

  // Shuffle characters cryptographically
  const combined = [...required, ...remaining];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const temp = combined[i];
    combined[i] = combined[j];
    combined[j] = temp;
  }

  return combined.join('');
}

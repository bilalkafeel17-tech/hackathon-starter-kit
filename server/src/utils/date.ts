import { AppError } from './AppError';

const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Validates that a string is a strictly valid calendar date formatted as YYYY-MM-DD.
 * Rejects nonexistent dates such as 2026-02-29 or 2026-04-31.
 */
export function isValidDateKey(dateKey: string): boolean {
  if (!DATE_REGEX.test(dateKey)) {
    return false;
  }

  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Validates an IANA time zone identifier using Intl.DateTimeFormat.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a Date object to a YYYY-MM-DD string formatted in the given timezone.
 */
export function toDateKey(date: Date = new Date(), timeZone = 'Asia/Karachi'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    // Fallback to UTC if timezone is invalid
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Returns today's date key YYYY-MM-DD in the company timezone.
 */
export function todayInCompanyTz(timeZone = 'Asia/Karachi'): string {
  return toDateKey(new Date(), timeZone);
}

/**
 * Checks if a YYYY-MM-DD date falls on a weekend day.
 * weekendDays: array of 0 (Sunday) through 6 (Saturday).
 */
export function isWeekend(dateKey: string, weekendDays: number[]): boolean {
  if (!isValidDateKey(dateKey)) {
    throw AppError.badRequest(`Invalid date format: ${dateKey}`);
  }

  const [year, month, day] = dateKey.split('-').map(Number);
  // UTC date calculation preserves day-of-week without local timezone offsets
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekendDays.includes(dayOfWeek);
}

/**
 * Generates an inclusive array of YYYY-MM-DD strings from 'from' to 'to'.
 * Throws 400 if from > to or if date strings are invalid.
 */
export function listDateKeys(from: string, to: string): string[] {
  if (!isValidDateKey(from) || !isValidDateKey(to)) {
    throw AppError.badRequest('Dates must be valid YYYY-MM-DD format');
  }

  if (from > to) {
    throw AppError.badRequest(`'from' date (${from}) cannot be after 'to' date (${to})`);
  }

  const keys: string[] = [];
  const [fYear, fMonth, fDay] = from.split('-').map(Number);
  const current = new Date(Date.UTC(fYear, fMonth - 1, fDay));

  let currentKey = from;
  while (currentKey <= to) {
    keys.push(currentKey);
    current.setUTCDate(current.getUTCDate() + 1);
    currentKey = current.toISOString().slice(0, 10);
  }

  return keys;
}

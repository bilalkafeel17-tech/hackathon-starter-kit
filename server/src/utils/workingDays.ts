import { listDateKeys, isWeekend } from './date';

/**
 * Returns a list of date keys (YYYY-MM-DD) that are working days,
 * excluding both weekend days and dates in holidaySet.
 * If a holiday falls on a weekend, it is only subtracted once.
 */
export function listWorkingDays(
  from: string,
  to: string,
  weekendDays: number[],
  holidaySet: Set<string>
): string[] {
  const allDays = listDateKeys(from, to);
  return allDays.filter((day) => !isWeekend(day, weekendDays) && !holidaySet.has(day));
}

/**
 * Counts the number of working days between two dates inclusive.
 */
export function countWorkingDays(
  from: string,
  to: string,
  weekendDays: number[],
  holidaySet: Set<string>
): number {
  return listWorkingDays(from, to, weekendDays, holidaySet).length;
}

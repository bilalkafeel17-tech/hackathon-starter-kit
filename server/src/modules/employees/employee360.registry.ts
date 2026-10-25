import { todayInCompanyTz } from '../../utils/date';

export type SectionProviderFn = (
  employeeId: string,
  viewer: { _id: string; role: string }
) => Promise<unknown> | unknown;

class SectionProviderRegistry {
  private providers = new Map<string, SectionProviderFn>();

  register(name: string, fn: SectionProviderFn): void {
    this.providers.set(name, fn);
  }

  async buildSections(
    employeeId: string,
    viewer: { _id: string; role: string }
  ): Promise<Record<string, unknown>> {
    const sections: Record<string, unknown> = {};
    for (const [name, fn] of this.providers.entries()) {
      try {
        sections[name] = await fn(employeeId, viewer);
      } catch {
        sections[name] = null;
      }
    }
    return sections;
  }
}

export const sectionProviders = new SectionProviderRegistry();

/**
 * Computes tenure (years, months, days) between joiningDate and endDate (or today in company timezone).
 */
export function computeTenure(
  joiningDateStr: string,
  endDateStr?: string
): { years: number; months: number; days: number } {
  const end = endDateStr || todayInCompanyTz();
  const [jYear, jMonth, jDay] = joiningDateStr.split('-').map(Number);
  const [eYear, eMonth, eDay] = end.split('-').map(Number);

  let years = eYear - jYear;
  let months = eMonth - jMonth;
  let days = eDay - jDay;

  if (days < 0) {
    months -= 1;
    // Days in previous month
    const prevMonthDate = new Date(Date.UTC(eYear, eMonth - 1, 0));
    days += prevMonthDate.getUTCDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
  };
}

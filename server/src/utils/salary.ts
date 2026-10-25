export const HRA_PERCENT = 0.4;
export const MEDICAL_PERCENT = 0.1;

export interface ComputedSalary {
  basic: number;
  hra: number;
  medical: number;
  extraAllowance: number;
  gross: number;
}

/**
 * Computes salary breakdown based on basic pay and optional extra allowance.
 * HRA = 40% of basic, Medical = 10% of basic, Gross = basic + hra + medical + extraAllowance.
 * Integer-cent arithmetic is used to prevent floating point drift.
 */
export function computeSalary(basic: number, extraAllowance: number = 0): ComputedSalary {
  const toCents = (val: number): number => Math.round(val * 100);
  const fromCents = (cents: number): number => Math.round(cents) / 100;

  const basicCents = toCents(basic);
  const hraCents = Math.round(basicCents * HRA_PERCENT);
  const medicalCents = Math.round(basicCents * MEDICAL_PERCENT);
  const extraCents = toCents(extraAllowance);
  const grossCents = basicCents + hraCents + medicalCents + extraCents;

  return {
    basic: fromCents(basicCents),
    hra: fromCents(hraCents),
    medical: fromCents(medicalCents),
    extraAllowance: fromCents(extraCents),
    gross: fromCents(grossCents),
  };
}

/**
 * Computes annual progressive income tax based on the illustrative tax slabs:
 * 0 to 600,000: 0
 * 600,001 to 1,200,000: 5% of amount exceeding 600,000
 * 1,200,001 to 2,400,000: 30,000 + 15% of amount exceeding 1,200,000
 * 2,400,001 to 3,600,000: 210,000 + 25% of amount exceeding 2,400,000
 * Above 3,600,000: 510,000 + 35% of amount exceeding 3,600,000
 */
export function calculateAnnualTax(annualTaxableIncome: number): number {
  if (annualTaxableIncome <= 600000) {
    return 0;
  }
  if (annualTaxableIncome <= 1200000) {
    return Math.round((annualTaxableIncome - 600000) * 0.05 * 100) / 100;
  }
  if (annualTaxableIncome <= 2400000) {
    return Math.round((30000 + (annualTaxableIncome - 1200000) * 0.15) * 100) / 100;
  }
  if (annualTaxableIncome <= 3600000) {
    return Math.round((210000 + (annualTaxableIncome - 2400000) * 0.25) * 100) / 100;
  }
  return Math.round((510000 + (annualTaxableIncome - 3600000) * 0.35) * 100) / 100;
}

/**
 * Computes monthly tax from gross pay (Annual Taxable = Gross * 12).
 */
export function calculateMonthlyTax(monthlyGross: number): {
  annualTaxable: number;
  annualTax: number;
  monthlyTax: number;
} {
  const annualTaxable = Math.round(monthlyGross * 12 * 100) / 100;
  const annualTax = calculateAnnualTax(annualTaxable);
  const monthlyTax = Math.round((annualTax / 12) * 100) / 100;

  return {
    annualTaxable,
    annualTax,
    monthlyTax,
  };
}

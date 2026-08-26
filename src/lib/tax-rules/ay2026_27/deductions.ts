/** Chapter VI-A and salary standard deduction — AY 2026-27. */
export const STANDARD_DEDUCTION_NEW = 75_000;
export const STANDARD_DEDUCTION_OLD = 50_000;

export const LIMITS = {
  "80C": 150_000,
  "80CCC": 150_000,
  "80CCD(1)": 150_000,
  "80CCD(1B)": 50_000,
  "80D": 100_000,
  "80D_SELF": 25_000,
  "80D_SELF_SENIOR": 50_000,
  "80TTA": 10_000,
  "80TTB": 50_000,
  "24B_SELF_OCCUPIED": 200_000,
};

export function applyStandardDeduction(salaryGross: number, regime: "NEW" | "OLD") {
  if (salaryGross <= 0) return 0;
  const cap = regime === "NEW" ? STANDARD_DEDUCTION_NEW : STANDARD_DEDUCTION_OLD;
  return Math.min(salaryGross, cap);
}

export function capDeduction(section: string, amount: number) {
  const limit = LIMITS[section as keyof typeof LIMITS];
  if (limit == null) return Math.max(0, amount);
  return Math.min(Math.max(0, amount), limit);
}

/** New regime: most Chapter VI-A deductions are not available. */
export function deductionAllowedInRegime(section: string, regime: "NEW" | "OLD") {
  if (regime === "OLD") return true;
  return ["80CCD(2)", "STD"].includes(section);
}

/** Section 87A — AY 2026-27. Source: incometaxindia.gov.in tax-rates notes. */
export const REBATE_NEW = {
  maxIncome: 1_200_000,
  maxRebate: 60_000,
};

export const REBATE_OLD = {
  maxIncome: 500_000,
  maxRebate: 12_500,
};

export function rebate87A(opts: {
  residentIndividual: boolean;
  regime: "NEW" | "OLD";
  taxableIncome: number;
  taxBeforeRebate: number;
}) {
  if (!opts.residentIndividual) return { rebate: 0, marginalRelief: 0 };
  const rule = opts.regime === "NEW" ? REBATE_NEW : REBATE_OLD;
  if (opts.taxableIncome <= rule.maxIncome) {
    return { rebate: Math.min(opts.taxBeforeRebate, rule.maxRebate), marginalRelief: 0 };
  }
  if (opts.regime === "NEW" && opts.taxableIncome > rule.maxIncome) {
    const excess = opts.taxableIncome - rule.maxIncome;
    if (opts.taxBeforeRebate > excess) {
      const relief = opts.taxBeforeRebate - excess;
      return { rebate: 0, marginalRelief: Math.max(0, relief) };
    }
  }
  return { rebate: 0, marginalRelief: 0 };
}

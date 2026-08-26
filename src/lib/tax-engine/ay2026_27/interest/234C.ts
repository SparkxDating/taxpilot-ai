import { roundTaxAmount } from "../rounding";
import { ADVANCE_TAX_THRESHOLD } from "./234B";

/**
 * s.234C — deferment of advance tax. FY 2025-26 (AY 2026-27) non-corporate instalments:
 * 15 Jun 15%, 15 Sep 45%, 15 Dec 75%, 15 Mar 100% (31 Mar grace for last instalment).
 */
export const RATE_234C = 0.01;

export const ADVANCE_INSTALLMENTS_FY_2025_26 = [
  { due: "2025-06-15", percent: 0.15, months: 3 },
  { due: "2025-09-15", percent: 0.45, months: 3 },
  { due: "2025-12-15", percent: 0.75, months: 3 },
  { due: "2026-03-15", percent: 1, months: 1, grace: "2026-03-31" },
] as const;

export type AdvancePayment = { amount: number; paidOn?: string };

export function interest234C(opts: {
  tax: number;
  tds: number;
  tcs: number;
  payments: AdvancePayment[];
}): { amount: number; applicable: boolean; unsupported: boolean; reason?: string } {
  const assessed = roundTaxAmount(Math.max(0, opts.tax - opts.tds - opts.tcs));
  if (assessed < ADVANCE_TAX_THRESHOLD) {
    return { amount: 0, applicable: false, unsupported: false };
  }
  const dated = opts.payments.filter((p) => p.amount > 0 && p.paidOn);
  const undated = opts.payments.filter((p) => p.amount > 0 && !p.paidOn);
  const totalPaid = roundTaxAmount(opts.payments.reduce((s, p) => s + Math.max(0, p.amount), 0));

  if (undated.length && totalPaid > 0) {
    return {
      amount: 0,
      applicable: true,
      unsupported: true,
      reason: "Advance-tax payment dates are required to compute s.234C. TaxPilot will not assume instalment dates.",
    };
  }

  let interest = 0;
  for (const inst of ADVANCE_INSTALLMENTS_FY_2025_26) {
    const cutoff = "grace" in inst && inst.grace ? inst.grace : inst.due;
    const paidByDue = dated
      .filter((p) => (p.paidOn || "") <= cutoff)
      .reduce((s, p) => s + p.amount, 0);
    const required = roundTaxAmount(assessed * inst.percent);
    const shortfall = Math.max(0, required - roundTaxAmount(paidByDue));
    if (shortfall > 0) interest += shortfall * RATE_234C * inst.months;
  }
  return { amount: roundTaxAmount(interest), applicable: true, unsupported: false };
}

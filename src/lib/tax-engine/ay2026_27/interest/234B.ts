import { roundTaxAmount } from "../rounding";
import { monthsOrPartThereof } from "./months";

/** s.234B — 1% per month if advance tax paid is less than 90% of assessed tax (assessed tax ≥ ₹10,000). */
export const RATE_234B = 0.01;
export const ADVANCE_TAX_THRESHOLD = 10_000;
export const ADVANCE_TAX_SAFE_RATIO = 0.9;

export function interest234B(opts: {
  filingDate: Date;
  ayStart: Date;
  tax: number;
  tds: number;
  tcs: number;
  advanceTax: number;
}) {
  const assessed = roundTaxAmount(Math.max(0, opts.tax - opts.tds - opts.tcs));
  if (assessed < ADVANCE_TAX_THRESHOLD) {
    return { amount: 0, months: 0, assessed, shortfall: 0, applicable: false };
  }
  if (opts.advanceTax >= roundTaxAmount(assessed * ADVANCE_TAX_SAFE_RATIO)) {
    return { amount: 0, months: 0, assessed, shortfall: 0, applicable: false };
  }
  const shortfall = roundTaxAmount(Math.max(0, assessed - opts.advanceTax));
  const months = monthsOrPartThereof(opts.ayStart, opts.filingDate);
  const amount = roundTaxAmount(shortfall * RATE_234B * months);
  return { amount, months, assessed, shortfall, applicable: true };
}

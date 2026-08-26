import { roundTaxAmount } from "../rounding";
import { addDays, monthsOrPartThereof } from "./months";

/** s.234A — 1% per month or part thereof on unpaid tax after the 139(1) due date. */
export const RATE_234A = 0.01;

export function interest234A(opts: {
  filingDate: Date;
  dueDate: Date;
  tax: number;
  tds: number;
  tcs: number;
  advanceTax: number;
  selfAssessmentTax: number;
}) {
  if (opts.filingDate.getTime() <= opts.dueDate.getTime()) {
    return { amount: 0, months: 0, unpaid: 0, applicable: false };
  }
  const unpaid = roundTaxAmount(
    Math.max(0, opts.tax - opts.tds - opts.tcs - opts.advanceTax - opts.selfAssessmentTax),
  );
  if (unpaid <= 0) return { amount: 0, months: 0, unpaid: 0, applicable: false };
  const from = addDays(opts.dueDate, 1);
  const months = monthsOrPartThereof(from, opts.filingDate);
  const amount = roundTaxAmount(unpaid * RATE_234A * months);
  return { amount, months, unpaid, applicable: true };
}

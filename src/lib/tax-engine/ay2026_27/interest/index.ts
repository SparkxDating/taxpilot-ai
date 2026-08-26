import { interest234A } from "./234A";
import { interest234B } from "./234B";
import { interest234C, type AdvancePayment } from "./234C";
import { fee234F } from "./234F";
import { roundTaxAmount } from "../rounding";

/** ITR-4 AY 2026-27 due date under s.139(1) — ITD ITR-4 FAQ. */
export const ITR4_DUE_DATE_AY_2026_27 = new Date(Date.UTC(2026, 7, 31));
export const AY_2026_27_START = new Date(Date.UTC(2026, 3, 1));

export type InterestComputation = {
  interest234A: number;
  interest234B: number;
  interest234C: number;
  fee234F: number;
  totalInterest: number;
  totalInterestAndFee: number;
  unsupported: boolean;
  reason?: string;
};

export function computeInterestAndFee(opts: {
  filingDate: Date;
  tax: number;
  tds: number;
  tcs: number;
  advanceTax: number;
  selfAssessmentTax: number;
  taxableIncome: number;
  advancePayments: AdvancePayment[];
}): InterestComputation {
  const a = interest234A({
    filingDate: opts.filingDate,
    dueDate: ITR4_DUE_DATE_AY_2026_27,
    tax: opts.tax,
    tds: opts.tds,
    tcs: opts.tcs,
    advanceTax: opts.advanceTax,
    selfAssessmentTax: opts.selfAssessmentTax,
  });
  const b = interest234B({
    filingDate: opts.filingDate,
    ayStart: AY_2026_27_START,
    tax: opts.tax,
    tds: opts.tds,
    tcs: opts.tcs,
    advanceTax: opts.advanceTax,
  });
  const c = interest234C({
    tax: opts.tax,
    tds: opts.tds,
    tcs: opts.tcs,
    payments: opts.advancePayments,
  });
  const f = fee234F({
    filingDate: opts.filingDate,
    dueDate: ITR4_DUE_DATE_AY_2026_27,
    taxableIncome: opts.taxableIncome,
  });
  const totalInterest = roundTaxAmount(a.amount + b.amount + (c.unsupported ? 0 : c.amount));
  return {
    interest234A: a.amount,
    interest234B: b.amount,
    interest234C: c.unsupported ? 0 : c.amount,
    fee234F: f.amount,
    totalInterest,
    totalInterestAndFee: roundTaxAmount(totalInterest + f.amount),
    unsupported: c.unsupported,
    reason: c.reason,
  };
}

export { interest234A } from "./234A";
export { interest234B } from "./234B";
export { interest234C } from "./234C";
export { fee234F } from "./234F";

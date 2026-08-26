import { capDeduction, deductionAllowedInRegime, LIMITS } from "@/lib/tax-rules/ay2026_27/deductions";
import type { TaxRegime } from "@/lib/tax/model";
import { roundIncomeAmount } from "./rounding";

export type DeductionLine = { section: string; amount: number };

export type DeductionResult = {
  section: string;
  amount: number;
  eligibleAmount: number;
  disallowedAmount: number;
  reason: string;
};

export function evaluateDeductions(lines: DeductionLine[], regime: TaxRegime): DeductionResult[] {
  return lines.map((d) => {
    const amount = roundIncomeAmount(Math.max(0, d.amount));
    if (!deductionAllowedInRegime(d.section, regime)) {
      return {
        section: d.section,
        amount,
        eligibleAmount: 0,
        disallowedAmount: amount,
        reason: regime === "NEW" ? "Not allowed under the new tax regime (s.115BAC)." : "Not allowed.",
      };
    }
    const eligible = capDeduction(d.section, amount);
    const limit = LIMITS[d.section as keyof typeof LIMITS];
    return {
      section: d.section,
      amount,
      eligibleAmount: eligible,
      disallowedAmount: amount - eligible,
      reason: eligible < amount && limit != null ? `Capped at ₹${limit.toLocaleString("en-IN")} for ${d.section}.` : "Allowed.",
    };
  });
}

export function totalEligible(results: DeductionResult[]) {
  return results.reduce((s, r) => s + r.eligibleAmount, 0);
}

import { roundTaxAmount } from "./rounding";

export function splitPayments(payments: Array<{ kind: string; amount: number }>) {
  const advanceTax = roundTaxAmount(payments.filter((p) => p.kind === "ADVANCE").reduce((s, p) => s + Math.max(0, p.amount), 0));
  const selfAssessmentTax = roundTaxAmount(
    payments.filter((p) => p.kind === "SELF_ASSESSMENT").reduce((s, p) => s + Math.max(0, p.amount), 0),
  );
  return { advanceTax, selfAssessmentTax };
}

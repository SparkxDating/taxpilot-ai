import { roundReturnAmount, roundTaxAmount } from "./rounding";

export type SettlementStatus = "REFUND" | "TAX_PAYABLE" | "ZERO";

export function calculateRefundOrPayable(input: {
  totalTax: number;
  tds: number;
  tcs: number;
  advanceTax: number;
  selfAssessmentTax: number;
}) {
  const prepaid = roundTaxAmount(input.tds + input.tcs + input.advanceTax + input.selfAssessmentTax);
  const totalTax = roundTaxAmount(input.totalTax);
  const net = roundReturnAmount(prepaid - totalTax);
  const status: SettlementStatus = net > 0 ? "REFUND" : net < 0 ? "TAX_PAYABLE" : "ZERO";
  return {
    status,
    amount: Math.abs(net),
    signed: net,
    breakdown: {
      totalTax,
      prepaid,
      tds: roundTaxAmount(input.tds),
      tcs: roundTaxAmount(input.tcs),
      advanceTax: roundTaxAmount(input.advanceTax),
      selfAssessmentTax: roundTaxAmount(input.selfAssessmentTax),
    },
  };
}

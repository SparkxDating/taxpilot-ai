import { ITR4_112A_CAP } from "@/lib/tax-rules/ay2026_27/eligibility";
import { roundIncomeAmount, roundTaxAmount } from "./rounding";

/** AY 2026-27 s.112A LTCG on listed equity / equity-oriented MF: 12.5% after ₹1.25 lakh exemption. */
export const RATE_112A = 0.125;

export type CapitalGainLine = {
  assetType?: string;
  section: string;
  kind: string;
  saleConsideration?: number;
  acquisitionCost?: number;
  improvementCost?: number;
  transferExpenses?: number;
  amount: number;
  specialRate?: number;
};

export function computeCapitalGains(lines: CapitalGainLine[]) {
  const ltcg112ALines = lines.filter((l) => l.section === "112A" || l.kind === "LTCG_112A");
  const other = lines.filter((l) => !(l.section === "112A" || l.kind === "LTCG_112A"));
  const ltcg112A = roundIncomeAmount(
    ltcg112ALines.reduce((s, l) => {
      if (l.saleConsideration != null) {
        const gain =
          l.saleConsideration - (l.acquisitionCost || 0) - (l.improvementCost || 0) - (l.transferExpenses || 0);
        return s + Math.max(0, gain);
      }
      return s + Math.max(0, l.amount);
    }, 0),
  );
  const taxable112A = Math.max(0, ltcg112A - ITR4_112A_CAP);
  const tax112A = roundTaxAmount(taxable112A * RATE_112A);
  const unsupported = other.filter((l) => l.amount > 0);
  return {
    ltcg112A,
    taxable112A,
    tax112A,
    exemption112A: Math.min(ITR4_112A_CAP, ltcg112A),
    saleConsideration: roundIncomeAmount(ltcg112ALines.reduce((s, l) => s + (l.saleConsideration || l.amount), 0)),
    costOfAcquisition: roundIncomeAmount(ltcg112ALines.reduce((s, l) => s + (l.acquisitionCost || 0), 0)),
    unsupportedOtherGains: roundIncomeAmount(unsupported.reduce((s, l) => s + l.amount, 0)),
    needsManualReview: unsupported.length > 0,
  };
}

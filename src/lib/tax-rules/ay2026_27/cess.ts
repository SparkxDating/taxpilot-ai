import { CESS_RATE } from "./incomeTaxRules";
import { roundTaxAmount } from "@/lib/tax-engine/ay2026_27/rounding";

export function healthEducationCess(taxPlusSurcharge: number) {
  return roundTaxAmount(taxPlusSurcharge * CESS_RATE);
}

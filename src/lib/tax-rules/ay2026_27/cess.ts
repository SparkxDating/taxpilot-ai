import { CESS_RATE } from "./incomeTaxRules";

export function healthEducationCess(taxPlusSurcharge: number) {
  return Math.round(taxPlusSurcharge * CESS_RATE);
}

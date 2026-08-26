import { SURCHARGE_NEW, SURCHARGE_OLD } from "./incomeTaxRules";
import { roundTaxAmount } from "@/lib/tax-engine/ay2026_27/rounding";

export function surchargeOn(tax: number, totalIncome: number, regime: "NEW" | "OLD") {
  const table = regime === "NEW" ? SURCHARGE_NEW : SURCHARGE_OLD;
  for (const row of table) {
    if (totalIncome > row.above) return roundTaxAmount(tax * row.rate);
  }
  return 0;
}

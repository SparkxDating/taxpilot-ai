import { SURCHARGE_NEW, SURCHARGE_OLD } from "./incomeTaxRules";

export function surchargeOn(tax: number, totalIncome: number, regime: "NEW" | "OLD") {
  const table = regime === "NEW" ? SURCHARGE_NEW : SURCHARGE_OLD;
  for (const row of table) {
    if (totalIncome > row.above) return Math.round(tax * row.rate);
  }
  return 0;
}

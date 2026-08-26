export {
  presumptive44AD,
  presumptive44ADA,
  AD_RATE_CASH,
  AD_RATE_DIGITAL,
  ADA_RATE,
} from "@/lib/tax-rules/ay2026_27/presumptive";

import { roundIncomeAmount } from "./rounding";

/** s.44AE: goods carriages. Heavy vehicle ≥12 tonnes: ₹1,000/ton/month; others ₹7,500/month. Filing JSON for 44AE is blocked. */
export function presumptive44AE(vehicles: Array<{ tons: number; months: number; heavy: boolean }>) {
  const income = vehicles.reduce((s, v) => {
    const months = Math.min(12, Math.max(0, v.months || 12));
    if (v.heavy) return s + Math.max(0, v.tons) * 1000 * months;
    return s + 7500 * months;
  }, 0);
  return { income: roundIncomeAmount(income), vehicleCount: vehicles.length };
}

import { roundTaxAmount } from "@/lib/tax-engine/ay2026_27/rounding";

/**
 * AY 2026-27 (FY 2025-26) tax rates.
 * Source: Income Tax Department tax-rates page and ITD ITR-4 FAQs (reviewed Aug 2026).
 * New regime under s.115BAC(1A) is the default.
 */
export const AY = "2026-27" as const;
export const FY = "2025-26" as const;

export const NEW_REGIME_SLABS = [
  { upTo: 400_000, rate: 0 },
  { upTo: 800_000, rate: 0.05 },
  { upTo: 1_200_000, rate: 0.1 },
  { upTo: 1_600_000, rate: 0.15 },
  { upTo: 2_000_000, rate: 0.2 },
  { upTo: 2_400_000, rate: 0.25 },
  { upTo: Infinity, rate: 0.3 },
] as const;

export const OLD_REGIME_SLABS_GENERAL = [
  { upTo: 250_000, rate: 0 },
  { upTo: 500_000, rate: 0.05 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
] as const;

export const OLD_REGIME_SLABS_SENIOR = [
  { upTo: 300_000, rate: 0 },
  { upTo: 500_000, rate: 0.05 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
] as const;

export const OLD_REGIME_SLABS_SUPER_SENIOR = [
  { upTo: 500_000, rate: 0 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
] as const;

export const CESS_RATE = 0.04;

export const SURCHARGE_NEW = [
  { above: 20_000_000, rate: 0.25 },
  { above: 10_000_000, rate: 0.15 },
  { above: 5_000_000, rate: 0.1 },
] as const;

export const SURCHARGE_OLD = [
  { above: 50_000_000, rate: 0.37 },
  { above: 20_000_000, rate: 0.25 },
  { above: 10_000_000, rate: 0.15 },
  { above: 5_000_000, rate: 0.1 },
] as const;

export function taxOnSlabs(income: number, slabs: readonly { upTo: number; rate: number }[]) {
  if (income <= 0) return 0;
  let tax = 0;
  let previous = 0;
  for (const slab of slabs) {
    const slice = Math.min(income, slab.upTo) - previous;
    if (slice > 0) tax += slice * slab.rate;
    previous = slab.upTo;
    if (income <= slab.upTo) break;
  }
  return roundTaxAmount(tax);
}

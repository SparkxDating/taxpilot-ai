import type { TaxRegime } from "@/lib/tax/model";
import type { AgeCategory } from "./age";
import {
  NEW_REGIME_SLABS,
  OLD_REGIME_SLABS_GENERAL,
  OLD_REGIME_SLABS_SENIOR,
  OLD_REGIME_SLABS_SUPER_SENIOR,
  taxOnSlabs,
} from "./incomeTax";
import { rebate87A } from "./rebate";
import { surchargeOn } from "./surcharge";
import { healthEducationCess } from "./cess";
import { roundTaxAmount } from "./rounding";

const NEW_REGIME_DEDUCTIONS = ["80CCD(2)"] as const;
const OLD_REGIME_DEDUCTIONS = [
  "80C",
  "80CCC",
  "80CCD(1)",
  "80CCD(1B)",
  "80CCD(2)",
  "80D",
  "80D_SELF",
  "80D_SELF_PREVENTIVE",
  "80D_SELF_MEDICAL",
  "80D_PARENTS",
  "80D_PARENTS_PREVENTIVE",
  "80D_PARENTS_MEDICAL",
  "80DD",
  "80DDB",
  "80E",
  "80EE",
  "80EEA",
  "80EEB",
  "80G",
  "80GG",
  "80GGC",
  "80U",
  "80TTA",
  "80TTB",
  "80CCH",
] as const;

/** Single source of regime-eligible Chapter VI-A sections. */
export function getApplicableDeductions(regime: TaxRegime): readonly string[] {
  return regime === "NEW" ? NEW_REGIME_DEDUCTIONS : OLD_REGIME_DEDUCTIONS;
}

export function deductionAllowedInRegime(section: string, regime: TaxRegime) {
  const key = section === "80D" || section.startsWith("80D_") ? (section.startsWith("80D") ? section : "80D") : section;
  if (regime === "NEW") return NEW_REGIME_DEDUCTIONS.includes(key as (typeof NEW_REGIME_DEDUCTIONS)[number]);
  if (key.startsWith("80D")) return true;
  return (OLD_REGIME_DEDUCTIONS as readonly string[]).includes(key);
}

export function slabsFor(regime: TaxRegime, age: AgeCategory) {
  if (regime === "NEW") return NEW_REGIME_SLABS;
  if (age === "SUPER_SENIOR_CITIZEN") return OLD_REGIME_SLABS_SUPER_SENIOR;
  if (age === "SENIOR_CITIZEN") return OLD_REGIME_SLABS_SENIOR;
  return OLD_REGIME_SLABS_GENERAL;
}

export function calculateTaxByRegime(opts: {
  regime: TaxRegime;
  ageCategory: AgeCategory;
  residentIndividual: boolean;
  normalTaxable: number;
  specialTax: number;
  specialRateIncome?: number;
}) {
  const slabs = slabsFor(opts.regime, opts.ageCategory);
  const taxOnNormal = taxOnSlabs(opts.normalTaxable, slabs);
  const { rebate, marginalRelief } = rebate87A({
    residentIndividual: opts.residentIndividual,
    regime: opts.regime,
    taxableIncome: opts.normalTaxable + (opts.specialRateIncome || 0),
    taxBeforeRebate: taxOnNormal,
  });
  const afterRebate = roundTaxAmount(Math.max(0, taxOnNormal - rebate - marginalRelief));
  const beforeCess = afterRebate + opts.specialTax;
  const taxableForSurcharge = opts.normalTaxable + (opts.specialRateIncome || 0);
  const surchargeAmt = surchargeOn(beforeCess, taxableForSurcharge, opts.regime);
  const cess = healthEducationCess(beforeCess + surchargeAmt);
  const totalTax = roundTaxAmount(beforeCess + surchargeAmt + cess);
  return {
    slabs,
    taxOnNormal,
    rebate,
    marginalRelief,
    surcharge: surchargeAmt,
    cess,
    totalTax,
    afterRebate,
  };
}

import { taxOnSlabs, NEW_REGIME_SLABS, OLD_REGIME_SLABS_GENERAL } from "@/lib/tax-rules/ay2026_27/incomeTaxRules";
import { rebate87A } from "@/lib/tax-rules/ay2026_27/rebate";
import { surchargeOn } from "@/lib/tax-rules/ay2026_27/surcharge";
import { healthEducationCess } from "@/lib/tax-rules/ay2026_27/cess";
import { applyStandardDeduction, capDeduction, deductionAllowedInRegime } from "@/lib/tax-rules/ay2026_27/deductions";
import { presumptive44AD, presumptive44ADA } from "@/lib/tax-rules/ay2026_27/presumptive";
import type { NormalizedReturn } from "./model";

export type TaxComputation = {
  assessmentYear: string;
  regime: "NEW" | "OLD";
  salaryIncome: number;
  housePropertyIncome: number;
  businessIncome: number;
  professionIncome: number;
  capitalGains: number;
  otherSources: number;
  grossTotalIncome: number;
  deductions: number;
  taxableIncome: number;
  taxBeforeRebate: number;
  rebate: number;
  marginalRelief: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  tds: number;
  advanceTax: number;
  selfAssessmentTax: number;
  prepaid: number;
  refundOrPayable: number;
  isRefund: boolean;
};

function housePropertyIncome(hp: NormalizedReturn["houseProperties"], regime: "NEW" | "OLD") {
  return hp.reduce((sum, p) => {
    const nav = Math.max(0, p.annualLetableValue - p.municipalTaxes);
    if (p.occupancy === "SELF_OCCUPIED") {
      const interest =
        regime === "OLD" ? Math.min(p.interestOnLoan, 200_000) : 0;
      return sum - interest;
    }
    const afterStd = nav - Math.round(nav * 0.3);
    return sum + afterStd - p.interestOnLoan;
  }, 0);
}

export function TaxEngine_calculate(data: NormalizedReturn): TaxComputation {
  if (data.assessmentYear !== "2026-27") {
    throw new Error(`No tax rules registered for AY ${data.assessmentYear}`);
  }
  const regime = data.regime;
  const std = applyStandardDeduction(data.salary.gross, regime);
  const salaryIncome = Math.max(0, data.salary.gross - data.salary.exemptions - std);
  const hp = housePropertyIncome(data.houseProperties, regime);
  const biz =
    data.business.section === "BOOKS"
      ? data.business.declaredIncome
      : presumptive44AD(
          data.business.turnover,
          data.business.digitalReceipts,
          data.business.cashReceipts,
          data.business.declaredIncome,
        ).income;
  const prof =
    data.profession.section === "BOOKS"
      ? data.profession.declaredIncome
      : presumptive44ADA(data.profession.grossReceipts, data.profession.cashReceipts, data.profession.declaredIncome)
          .income;
  const cg = data.capitalGains.reduce((s, g) => s + g.amount, 0);
  const other = data.otherIncome.reduce((s, o) => s + o.amount, 0);
  const grossTotalIncome = salaryIncome + hp + biz + prof + cg + other;
  const deductions = data.deductions.reduce((s, d) => {
    if (!deductionAllowedInRegime(d.section, regime)) return s;
    return s + capDeduction(d.section, d.amount);
  }, 0);
  const taxableIncome = Math.max(0, Math.round(grossTotalIncome - deductions));
  const slabs = regime === "NEW" ? NEW_REGIME_SLABS : OLD_REGIME_SLABS_GENERAL;
  const taxBeforeRebate = taxOnSlabs(taxableIncome, slabs);
  const { rebate, marginalRelief } = rebate87A({
    residentIndividual: data.taxpayerType === "INDIVIDUAL" && data.residentialStatus === "RESIDENT",
    regime,
    taxableIncome,
    taxBeforeRebate,
  });
  const afterRebate = Math.max(0, taxBeforeRebate - rebate - marginalRelief);
  const surcharge = surchargeOn(afterRebate, taxableIncome, regime);
  const cess = healthEducationCess(afterRebate + surcharge);
  const totalTax = afterRebate + surcharge + cess;
  const tds = data.tds.reduce((s, t) => s + t.amount, 0) + data.salary.tds;
  const advanceTax = data.taxPayments.filter((p) => p.kind === "ADVANCE").reduce((s, p) => s + p.amount, 0);
  const selfAssessmentTax = data.taxPayments.filter((p) => p.kind === "SELF_ASSESSMENT").reduce((s, p) => s + p.amount, 0);
  const prepaid = tds + advanceTax + selfAssessmentTax;
  const refundOrPayable = prepaid - totalTax;
  return {
    assessmentYear: data.assessmentYear,
    regime,
    salaryIncome,
    housePropertyIncome: hp,
    businessIncome: biz,
    professionIncome: prof,
    capitalGains: cg,
    otherSources: other,
    grossTotalIncome,
    deductions,
    taxableIncome,
    taxBeforeRebate,
    rebate,
    marginalRelief,
    surcharge,
    cess,
    totalTax,
    tds,
    advanceTax,
    selfAssessmentTax,
    prepaid,
    refundOrPayable,
    isRefund: refundOrPayable > 0,
  };
}

export const TaxEngine = { calculate: TaxEngine_calculate };

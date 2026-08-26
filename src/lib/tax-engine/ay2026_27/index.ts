import type { NormalizedReturn } from "@/lib/tax/model";
import { applyStandardDeduction } from "@/lib/tax-rules/ay2026_27/deductions";
import { taxOnSlabs, NEW_REGIME_SLABS, OLD_REGIME_SLABS_GENERAL } from "./incomeTax";
import { rebate87A } from "./rebate";
import { surchargeOn } from "./surcharge";
import { healthEducationCess } from "./cess";
import { evaluateDeductions, totalEligible } from "./deductions";
import { presumptive44AD, presumptive44ADA } from "./presumptive";
import { computeCapitalGains } from "./capitalGains";
import { totalTds, totalTcs } from "./tds";
import { splitPayments } from "./taxPayments";
import { roundIncomeAmount, roundTaxAmount, roundReturnAmount } from "./rounding";

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
  grossTotalIncomeIncLtcg: number;
  deductions: number;
  deductionLines: ReturnType<typeof evaluateDeductions>;
  taxableIncome: number;
  normalRateIncome: number;
  specialRateIncome: number;
  taxBeforeRebate: number;
  taxOnSpecialRate: number;
  rebate: number;
  marginalRelief: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  tds: number;
  tcs: number;
  advanceTax: number;
  selfAssessmentTax: number;
  prepaid: number;
  refundOrPayable: number;
  isRefund: boolean;
  standardDeduction: number;
  presumptive: {
    ad: ReturnType<typeof presumptive44AD> | null;
    ada: ReturnType<typeof presumptive44ADA> | null;
  };
  capitalGainsDetail: ReturnType<typeof computeCapitalGains>;
  flags: string[];
};

function housePropertyIncome(hp: NormalizedReturn["houseProperties"], regime: "NEW" | "OLD") {
  return hp.reduce((sum, p) => {
    const nav = Math.max(0, p.annualLetableValue - p.municipalTaxes);
    if (p.occupancy === "SELF_OCCUPIED") {
      const interest = regime === "OLD" ? Math.min(p.interestOnLoan, 200_000) : 0;
      return sum - interest;
    }
    const afterStd = nav - Math.round(nav * 0.3);
    return sum + afterStd - p.interestOnLoan;
  }, 0);
}

export function calculateAy2026_27(data: NormalizedReturn): TaxComputation {
  if (data.assessmentYear !== "2026-27") {
    throw new Error(`No tax rules registered for AY ${data.assessmentYear}`);
  }
  const flags: string[] = [];
  const regime = data.regime;
  const std = applyStandardDeduction(data.salary.gross, regime);
  const salaryIncome = roundIncomeAmount(Math.max(0, data.salary.gross - data.salary.exemptions - std));
  const hp = roundIncomeAmount(housePropertyIncome(data.houseProperties, regime));
  const ad =
    data.business.turnover > 0 || data.business.digitalReceipts > 0 || data.business.cashReceipts > 0
      ? presumptive44AD(data.business.turnover, data.business.digitalReceipts, data.business.cashReceipts, data.business.declaredIncome)
      : null;
  const ada =
    data.profession.grossReceipts > 0
      ? presumptive44ADA(data.profession.grossReceipts, data.profession.cashReceipts, data.profession.declaredIncome)
      : null;
  const biz =
    data.business.section === "BOOKS"
      ? roundIncomeAmount(data.business.declaredIncome)
      : ad
        ? ad.income
        : 0;
  const prof =
    data.profession.section === "BOOKS"
      ? roundIncomeAmount(data.profession.declaredIncome)
      : ada
        ? ada.income
        : 0;
  const cg = computeCapitalGains(data.capitalGains);
  if (cg.needsManualReview) flags.push("UNSUPPORTED_CAPITAL_GAINS");
  const other = roundIncomeAmount(data.otherIncome.reduce((s, o) => s + o.amount, 0));
  const normalGTI = roundIncomeAmount(salaryIncome + hp + biz + prof + other);
  const gtiIncLtcg = roundIncomeAmount(normalGTI + cg.ltcg112A);
  const deductionLines = evaluateDeductions(data.deductions, regime);
  const deductions = roundIncomeAmount(totalEligible(deductionLines));
  const normalTaxable = roundIncomeAmount(Math.max(0, normalGTI - deductions));
  const taxableIncome = roundIncomeAmount(normalTaxable + cg.ltcg112A);
  const slabs = regime === "NEW" ? NEW_REGIME_SLABS : OLD_REGIME_SLABS_GENERAL;
  const normalTax = taxOnSlabs(normalTaxable, slabs);
  const { rebate, marginalRelief } = rebate87A({
    residentIndividual: data.taxpayerType === "INDIVIDUAL" && data.residentialStatus === "RESIDENT",
    regime,
    taxableIncome,
    taxBeforeRebate: normalTax,
  });
  const afterRebate = roundTaxAmount(Math.max(0, normalTax - rebate - marginalRelief));
  const specialTax = cg.tax112A;
  const taxBeforeCess = afterRebate + specialTax;
  const surcharge = surchargeOn(taxBeforeCess, taxableIncome, regime);
  const cess = healthEducationCess(taxBeforeCess + surcharge);
  const totalTax = roundTaxAmount(taxBeforeCess + surcharge + cess);
  const tds = totalTds(data.salary.tds, data.tds);
  const tcs = totalTcs(data.tds);
  const { advanceTax, selfAssessmentTax } = splitPayments(data.taxPayments);
  const prepaid = roundTaxAmount(tds + tcs + advanceTax + selfAssessmentTax);
  const refundOrPayable = roundReturnAmount(prepaid - totalTax);
  return {
    assessmentYear: data.assessmentYear,
    regime,
    salaryIncome,
    housePropertyIncome: hp,
    businessIncome: biz,
    professionIncome: prof,
    capitalGains: cg.ltcg112A,
    otherSources: other,
    grossTotalIncome: normalGTI,
    grossTotalIncomeIncLtcg: gtiIncLtcg,
    deductions,
    deductionLines,
    taxableIncome,
    normalRateIncome: normalTaxable,
    specialRateIncome: cg.ltcg112A,
    taxBeforeRebate: normalTax,
    taxOnSpecialRate: specialTax,
    rebate,
    marginalRelief,
    surcharge,
    cess,
    totalTax,
    tds,
    tcs,
    advanceTax,
    selfAssessmentTax,
    prepaid,
    refundOrPayable,
    isRefund: refundOrPayable > 0,
    standardDeduction: std,
    presumptive: { ad, ada },
    capitalGainsDetail: cg,
    flags,
  };
}

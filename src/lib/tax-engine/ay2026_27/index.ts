import type { NormalizedReturn } from "@/lib/tax/model";
import { applyStandardDeduction } from "@/lib/tax-rules/ay2026_27/deductions";
import { calculateTaxByRegime } from "./regime";
import { rebate87A } from "./rebate";
import { evaluateDeductions, totalEligible } from "./deductions";
import { presumptive44AD, presumptive44ADA } from "./presumptive";
import { computeCapitalGains } from "./capitalGains";
import { totalTds, totalTcs } from "./tds";
import { splitPayments } from "./taxPayments";
import { roundIncomeAmount, roundTaxAmount } from "./rounding";
import { calculateRefundOrPayable } from "./refund";
import { ageCategoryFromDob, isSeniorCitizen } from "./age";
import { computeInterestAndFee } from "./interest";

export type TaxComputation = {
  assessmentYear: string;
  regime: "NEW" | "OLD";
  ageCategory: ReturnType<typeof ageCategoryFromDob>;
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
  interest234A: number;
  interest234B: number;
  interest234C: number;
  fee234F: number;
  totalInterestAndFee: number;
  totalLiability: number;
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
  settlement: ReturnType<typeof calculateRefundOrPayable>;
};

function housePropertyIncome(hp: NormalizedReturn["houseProperties"], regime: "NEW" | "OLD") {
  return hp.reduce((sum, p) => {
    const nav = Math.max(0, p.annualLetableValue - p.municipalTaxes);
    if (p.occupancy === "SELF_OCCUPIED") {
      const interest = regime === "OLD" ? Math.min(p.interestOnLoan, 200_000) : 0;
      return sum - interest;
    }
    const afterStd = nav - roundIncomeAmount(nav * 0.3);
    return sum + afterStd - p.interestOnLoan;
  }, 0);
}

export function calculateAy2026_27(data: NormalizedReturn, asOfDate = new Date()): TaxComputation {
  if (data.assessmentYear !== "2026-27") {
    throw new Error(`No tax rules registered for AY ${data.assessmentYear}`);
  }
  const flags: string[] = [];
  const regime = data.regime;
  const ageCategory = ageCategoryFromDob(data.dateOfBirth);
  const selfSenior = isSeniorCitizen(data.dateOfBirth);
  const std = applyStandardDeduction(data.salary.gross, regime);
  const salaryIncome = roundIncomeAmount(Math.max(0, data.salary.gross - data.salary.exemptions - std));
  let hp = roundIncomeAmount(housePropertyIncome(data.houseProperties, regime));
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
  for (const f of cg.flags || []) flags.push(f);
  const other = roundIncomeAmount(data.otherIncome.reduce((s, o) => s + o.amount, 0));
  if (hp < 0) {
    flags.push("HP_LOSS_SETOFF");
    const otherPositive = Math.max(0, salaryIncome + biz + prof + other);
    const setOff = Math.min(-hp, 200_000, otherPositive);
    const remaining = -hp - setOff;
    if (remaining > 0) flags.push("UNSUPPORTED_LOSS_CARRY_FORWARD");
    hp = -setOff;
  }
  const normalGTI = roundIncomeAmount(salaryIncome + hp + biz + prof + other);
  if (normalGTI < 0) flags.push("UNSUPPORTED_LOSS_CARRY_FORWARD");
  const gtiIncLtcg = roundIncomeAmount(normalGTI + cg.ltcg112A);
  const deductionLines = evaluateDeductions(data.deductions, regime, {
    selfSenior,
    salaryGross: data.salary.gross,
  });
  const deductions = roundIncomeAmount(totalEligible(deductionLines));
  const normalTaxable = roundIncomeAmount(Math.max(0, normalGTI - deductions));
  const taxableIncome = roundIncomeAmount(normalTaxable + cg.ltcg112A);
  const residentIndividual = data.taxpayerType === "INDIVIDUAL" && data.residentialStatus === "RESIDENT";
  const specialTax = cg.tax112A;
  const byRegime = calculateTaxByRegime({
    regime,
    ageCategory,
    residentIndividual,
    normalTaxable,
    specialTax,
    specialRateIncome: cg.ltcg112A,
  });
  const rebateIfNormalOnly = rebate87A({
    residentIndividual,
    regime,
    taxableIncome: normalTaxable,
    taxBeforeRebate: byRegime.taxOnNormal,
  });
  if (cg.ltcg112A > 0 && rebateIfNormalOnly.rebate !== byRegime.rebate) {
    flags.push("REBATE_112A_THRESHOLD_INTERACTION");
  }
  const tds = totalTds(data.salary.tds, data.tds);
  const tcs = totalTcs(data.tds);
  const { advanceTax, selfAssessmentTax } = splitPayments(data.taxPayments);
  const prepaid = roundTaxAmount(tds + tcs + advanceTax + selfAssessmentTax);
  const interest = computeInterestAndFee({
    filingDate: asOfDate,
    tax: byRegime.totalTax,
    tds,
    tcs,
    advanceTax,
    selfAssessmentTax,
    taxableIncome,
    advancePayments: data.taxPayments.filter((p) => p.kind === "ADVANCE").map((p) => ({ amount: p.amount, paidOn: p.paidOn })),
  });
  if (interest.unsupported) flags.push("UNSUPPORTED_INTEREST_CALCULATION");
  const totalLiability = roundTaxAmount(byRegime.totalTax + interest.totalInterestAndFee);
  const settlement = calculateRefundOrPayable({
    totalTax: totalLiability,
    tds,
    tcs,
    advanceTax,
    selfAssessmentTax,
  });
  return {
    assessmentYear: data.assessmentYear,
    regime,
    ageCategory,
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
    taxBeforeRebate: byRegime.taxOnNormal,
    taxOnSpecialRate: specialTax,
    rebate: byRegime.rebate,
    marginalRelief: byRegime.marginalRelief,
    surcharge: byRegime.surcharge,
    cess: byRegime.cess,
    totalTax: byRegime.totalTax,
    interest234A: interest.interest234A,
    interest234B: interest.interest234B,
    interest234C: interest.interest234C,
    fee234F: interest.fee234F,
    totalInterestAndFee: interest.totalInterestAndFee,
    totalLiability,
    tds,
    tcs,
    advanceTax,
    selfAssessmentTax,
    prepaid,
    refundOrPayable: settlement.signed,
    isRefund: settlement.status === "REFUND",
    settlement,
    standardDeduction: std,
    presumptive: { ad, ada },
    capitalGainsDetail: cg,
    flags,
  };
}

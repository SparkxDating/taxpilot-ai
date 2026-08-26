import { ADA_RECEIPTS_CASH_LIMIT, ADA_RECEIPTS_DIGITAL_LIMIT, AD_TURNOVER_CASH_LIMIT, AD_TURNOVER_DIGITAL_LIMIT, cashWithinDigitalThreshold } from "./presumptive";

export const ITR4_INCOME_CAP = 5_000_000;
export const ITR4_112A_CAP = 125_000;
export const ITR4_AGRI_CAP = 5_000;
export const ITR4_HOUSE_PROPERTY_CAP = 2;

export type EligibilityInput = {
  taxpayerType: "INDIVIDUAL" | "HUF" | "FIRM";
  residentialStatus: "RESIDENT" | "RNOR" | "NRI";
  isLlp: boolean;
  isDirector: boolean;
  sources: string[];
  totalIncome: number;
  housePropertyCount: number;
  ltcg112A: number;
  stcg: number;
  otherLtcg: number;
  agriculturalIncome: number;
  lotteryOrRacehorse: boolean;
  foreignAssets: boolean;
  unlistedShares: boolean;
  businessTurnover: number;
  businessCash: number;
  professionReceipts: number;
  professionCash: number;
  usesPresumptive: boolean;
  detailedBooks: boolean;
  fnoTrading: boolean;
};

export type EligibilityResult = {
  recommended: "ITR-4" | "ITR-3" | "UNSUPPORTED";
  itr4Eligible: boolean;
  reasons: string[];
  warnings: string[];
};

export function determineItrType(input: EligibilityInput): EligibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (input.taxpayerType === "FIRM" && input.isLlp) {
    reasons.push("LLPs cannot file ITR-4. Use ITR-3 or ITR-5 as applicable.");
  }
  if (input.residentialStatus !== "RESIDENT") {
    reasons.push("ITR-4 is only for resident taxpayers. RNOR/NRI filers are routed to ITR-3.");
  }
  if (input.isDirector) {
    reasons.push("A company director cannot file ITR-4.");
  }
  if (input.totalIncome > ITR4_INCOME_CAP) {
    reasons.push("Total income exceeds ₹50 lakh, the ITR-4 ceiling.");
  }
  if (input.housePropertyCount > ITR4_HOUSE_PROPERTY_CAP) {
    reasons.push("ITR-4 allows income from at most two house properties for AY 2026-27.");
  }
  if (input.stcg > 0) {
    reasons.push("Short-term capital gains are not permitted in ITR-4.");
  }
  if (input.otherLtcg > 0) {
    reasons.push("Capital gains other than s.112A LTCG (within the ITR-4 cap) require ITR-3.");
  }
  if (input.ltcg112A > ITR4_112A_CAP) {
    reasons.push("Long-term capital gain u/s 112A exceeds ₹1.25 lakh.");
  }
  if (input.agriculturalIncome > ITR4_AGRI_CAP) {
    reasons.push("Agricultural income above ₹5,000 is not permitted in ITR-4.");
  }
  if (input.lotteryOrRacehorse) {
    reasons.push("Lottery / racehorse income is not permitted in ITR-4.");
  }
  if (input.foreignAssets) {
    reasons.push("Foreign assets/income cannot be reported in ITR-4.");
  }
  if (input.unlistedShares) {
    reasons.push("Holding unlisted equity shares is not permitted in ITR-4.");
  }
  if (input.fnoTrading) {
    reasons.push("F&O / speculative trading is reported in ITR-3, not ITR-4.");
  }
  if (input.detailedBooks) {
    reasons.push("Detailed books / P&L (non-presumptive) require ITR-3.");
  }
  if (input.sources.includes("BUSINESS") || input.sources.includes("FREELANCING")) {
    const digitalOk = cashWithinDigitalThreshold(input.businessCash, input.businessTurnover);
    const limit = digitalOk ? AD_TURNOVER_DIGITAL_LIMIT : AD_TURNOVER_CASH_LIMIT;
    if (input.businessTurnover > limit) {
      reasons.push(`Business turnover exceeds the s.44AD limit of ₹${(limit / 100_000).toFixed(0)} lakh.`);
    }
  }
  if (input.sources.includes("PROFESSION")) {
    const digitalOk = cashWithinDigitalThreshold(input.professionCash, input.professionReceipts);
    const limit = digitalOk ? ADA_RECEIPTS_DIGITAL_LIMIT : ADA_RECEIPTS_CASH_LIMIT;
    if (input.professionReceipts > limit) {
      reasons.push(`Professional receipts exceed the s.44ADA limit of ₹${(limit / 100_000).toFixed(0)} lakh.`);
    }
  }

  const hasBusinessLike =
    input.sources.includes("BUSINESS") ||
    input.sources.includes("PROFESSION") ||
    input.sources.includes("FREELANCING");
  if (!hasBusinessLike && !input.usesPresumptive) {
    warnings.push("ITR-4 is for presumptive business/profession. Salary-only filers typically use ITR-1, which is not in this product yet.");
  }

  const itr4Eligible = reasons.length === 0 && (input.taxpayerType === "INDIVIDUAL" || input.taxpayerType === "HUF" || (input.taxpayerType === "FIRM" && !input.isLlp));
  if (itr4Eligible && hasBusinessLike) {
    return { recommended: "ITR-4", itr4Eligible: true, reasons, warnings };
  }
  if (itr4Eligible && !hasBusinessLike) {
    warnings.push("No presumptive business/profession selected. ITR-4 may still be used only if you have 44AD/44ADA/44AE income.");
    return { recommended: "ITR-4", itr4Eligible: true, reasons, warnings };
  }
  return { recommended: "ITR-3", itr4Eligible: false, reasons, warnings };
}

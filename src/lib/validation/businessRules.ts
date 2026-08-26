import type { NormalizedReturn } from "@/lib/tax/model";
import { TaxEngine } from "@/lib/tax/engine";
import { determineItrType } from "@/lib/tax-rules/ay2026_27/eligibility";
import { presumptive44AD, presumptive44ADA } from "@/lib/tax-rules/ay2026_27/presumptive";
import { evaluateDeductions } from "@/lib/tax-engine/ay2026_27/deductions";

export type BusinessIssue = {
  id: string;
  severity: "ERROR" | "WARNING" | "INFO";
  field: string;
  section: string;
  message: string;
  explanation: string;
  fixRoute: string;
};

export function businessValidate(data: NormalizedReturn, returnId = ""): BusinessIssue[] {
  const id = returnId || "new";
  const issues: BusinessIssue[] = [];
  const push = (row: Omit<BusinessIssue, "fixRoute"> & { fixRoute?: string }) => {
    issues.push({
      ...row,
      fixRoute: (row.fixRoute || `/returns/${id}/income`).replace("{id}", id),
    });
  };

  if (data.itrType === "ITR-3") {
    push({
      id: "ITR3_DISABLED",
      severity: "ERROR",
      field: "itrType",
      section: "Eligibility",
      message: "ITR-3 preparation is currently in development. Filing JSON generation is not available yet.",
      explanation: "Phase 2 supports filing-grade ITR-4 only.",
      fixRoute: `/returns/${id}/interview`,
    });
  }

  if (data.business.turnover < 0 || data.business.cashReceipts < 0 || data.business.digitalReceipts < 0) {
    push({ id: "ITR4_BP_001", severity: "ERROR", field: "turnover", section: "Business", message: "Turnover and receipts cannot be negative.", explanation: "Replace negative figures with zero or the correct amount." });
  }
  if (data.profession.grossReceipts < 0) {
    push({ id: "ITR4_BP_002", severity: "ERROR", field: "grossReceipts", section: "Profession", message: "Professional receipts cannot be negative.", explanation: "Gross receipts must be zero or positive." });
  }
  if (data.business.turnover > 0) {
    const p = presumptive44AD(data.business.turnover, data.business.digitalReceipts, data.business.cashReceipts, data.business.declaredIncome);
    if (!p.withinLimit) {
      push({ id: "ITR4_BP_003", severity: "ERROR", field: "turnover", section: "Business", message: "Turnover exceeds s.44AD limits for the cash/digital mix.", explanation: "ITR-4 cannot be used. ITR-3 JSON is not available in this release." });
    }
    if (data.business.declaredIncome > 0 && data.business.declaredIncome < p.minimum) {
      push({
        id: "ITR4_BP_004",
        severity: "ERROR",
        field: "declaredIncome",
        section: "Business",
        message: `Declared 44AD income is below the prescribed ₹${p.minimum.toLocaleString("en-IN")}.`,
        explanation: "Declare at least 6% of digital plus 8% of cash receipts, or maintain books (ITR-3, not yet filing-ready).",
      });
    }
  }
  if (data.profession.grossReceipts > 0) {
    const p = presumptive44ADA(data.profession.grossReceipts, data.profession.cashReceipts, data.profession.declaredIncome);
    if (!p.withinLimit) {
      push({ id: "ITR4_PR_001", severity: "ERROR", field: "grossReceipts", section: "Profession", message: "Professional receipts exceed s.44ADA limits.", explanation: "ITR-4 cannot be used for this turnover." });
    }
  }

  const calc = TaxEngine.calculate(data);
  const elig = determineItrType({
    taxpayerType: data.taxpayerType,
    residentialStatus: data.residentialStatus,
    isLlp: false,
    isDirector: false,
    sources: [
      data.salary.gross ? "SALARY" : "",
      data.business.turnover ? "BUSINESS" : "",
      data.profession.grossReceipts ? "PROFESSION" : "",
      calc.capitalGains ? "CAPITAL_GAINS" : "",
    ].filter(Boolean),
    totalIncome: calc.grossTotalIncomeIncLtcg,
    housePropertyCount: data.houseProperties.length,
    ltcg112A: calc.capitalGains,
    stcg: data.capitalGains.filter((g) => g.kind === "STCG").reduce((s, g) => s + g.amount, 0),
    otherLtcg: data.capitalGains.filter((g) => g.section !== "112A").reduce((s, g) => s + g.amount, 0),
    agriculturalIncome: 0,
    lotteryOrRacehorse: false,
    foreignAssets: false,
    unlistedShares: false,
    businessTurnover: data.business.turnover,
    businessCash: data.business.cashReceipts,
    professionReceipts: data.profession.grossReceipts,
    professionCash: data.profession.cashReceipts,
    usesPresumptive: true,
    detailedBooks: data.business.section === "BOOKS",
    fnoTrading: false,
  });
  if (data.itrType === "ITR-4" && !elig.itr4Eligible) {
    for (const r of elig.reasons) {
      push({ id: "ITR4_ELIG_001", severity: "ERROR", field: "itrType", section: "Eligibility", message: r, explanation: "Selected ITR does not match eligibility.", fixRoute: `/returns/${id}/interview` });
    }
  }

  const panRe = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (!panRe.test(data.pan)) {
    push({ id: "ITR4_PI_001", severity: "ERROR", field: "pan", section: "Personal information", message: "PAN is missing or invalid.", explanation: "Enter PAN as AAAAA9999A.", fixRoute: `/returns/${id}/profile` });
  }
  if (!data.name.trim()) {
    push({ id: "ITR4_PI_002", severity: "ERROR", field: "name", section: "Personal information", message: "Taxpayer name is required.", explanation: "Name as per PAN is required for Verification.", fixRoute: `/returns/${id}/profile` });
  }
  if (!data.bankAccounts.length) {
    push({ id: "ITR4_BA_001", severity: "ERROR", field: "bankAccounts", section: "Bank details", message: "At least one bank account is required.", explanation: "The official schema requires bank details for refund credit.", fixRoute: `/returns/${id}/tds` });
  }
  const ifscRe = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  for (const b of data.bankAccounts) {
    if (!ifscRe.test(b.ifsc)) {
      push({ id: "ITR4_BA_002", severity: "ERROR", field: "ifsc", section: "Bank details", message: "IFSC is not valid.", explanation: "Use an 11-character IFSC.", fixRoute: `/returns/${id}/tds` });
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/-]{8,19}$/.test(b.accountNumber)) {
      push({ id: "ITR4_BA_003", severity: "ERROR", field: "accountNumber", section: "Bank details", message: "Bank account number format is invalid.", explanation: "Account number must be 9–20 alphanumeric characters.", fixRoute: `/returns/${id}/tds` });
    }
  }

  for (const d of evaluateDeductions(data.deductions, data.regime)) {
    if (d.disallowedAmount > 0) {
      push({
        id: "ITR4_DED_001",
        severity: data.regime === "NEW" ? "INFO" : "WARNING",
        field: d.section,
        section: "Deductions",
        message: `${d.section}: ₹${d.disallowedAmount.toLocaleString("en-IN")} not eligible.`,
        explanation: d.reason,
        fixRoute: `/returns/${id}/deductions`,
      });
    }
  }

  if (calc.tds > calc.totalTax + 100_000 && calc.totalTax === 0) {
    push({
      id: "ITR4_TDS_001",
      severity: "WARNING",
      field: "tds",
      section: "TDS",
      message: "TDS is high relative to computed tax.",
      explanation: "Reconcile with AIS / 26AS. AIS is not assumed to be correct.",
      fixRoute: `/returns/${id}/reconcile`,
    });
  }
  if (calc.flags.includes("UNSUPPORTED_CAPITAL_GAINS")) {
    push({
      id: "ITR4_CG_001",
      severity: "ERROR",
      field: "capitalGains",
      section: "Capital gains",
      message: "Capital gains other than s.112A (within ₹1.25 lakh) cannot be filed in ITR-4.",
      explanation: "Do not mix special-rate / STCG into slab income. ITR-3 JSON is disabled.",
      fixRoute: `/returns/${id}/income`,
    });
  }
  if (!data.fatherName && !data.name) {
    push({ id: "ITR4_VF_001", severity: "ERROR", field: "fatherName", section: "Verification", message: "Father's name is required for verification.", explanation: "Official Verification.Declaration.FatherName is required.", fixRoute: `/returns/${id}/profile` });
  }
  return issues;
}

export function canGenerateJson(issues: BusinessIssue[]) {
  return issues.every((i) => i.severity !== "ERROR");
}

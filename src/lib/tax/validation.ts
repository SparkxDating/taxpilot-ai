import { z } from "zod";
import type { NormalizedReturn } from "./model";
import { TaxEngine } from "./engine";
import { presumptive44AD, presumptive44ADA } from "@/lib/tax-rules/ay2026_27/presumptive";
import { ITR4_112A_CAP, ITR4_INCOME_CAP } from "@/lib/tax-rules/ay2026_27/eligibility";
import officialItr4 from "@/lib/itr-json/schemas/ay2026_27/ITR-4.schema.json";

export type Issue = {
  level: 1 | 2 | 3;
  severity: "ERROR" | "WARNING" | "INFO";
  section: string;
  field: string;
  message: string;
  suggestion: string;
  href: string;
};

const panRe = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const ifscRe = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const tanRe = /^[A-Z]{4}[0-9]{5}[A-Z]$/;

export function fieldValidation(data: NormalizedReturn): Issue[] {
  const issues: Issue[] = [];
  if (!panRe.test(data.pan)) {
    issues.push({
      level: 1,
      severity: "ERROR",
      section: "Personal information",
      field: "pan",
      message: "PAN must be in the format AAAAA9999A.",
      suggestion: "Enter the PAN exactly as on the PAN card.",
      href: "/returns/ID/profile",
    });
  }
  if (!data.name.trim()) {
    issues.push({
      level: 1,
      severity: "ERROR",
      section: "Personal information",
      field: "name",
      message: "Taxpayer name is required.",
      suggestion: "Enter the name as per PAN.",
      href: "/returns/ID/profile",
    });
  }
  if (!data.bankAccounts.length) {
    issues.push({
      level: 1,
      severity: "ERROR",
      section: "Bank details",
      field: "bankAccounts",
      message: "At least one bank account is required for refund credit.",
      suggestion: "Add a savings or current account with IFSC.",
      href: "/returns/ID/bank",
    });
  }
  for (const b of data.bankAccounts) {
    if (!ifscRe.test(b.ifsc)) {
      issues.push({
        level: 1,
        severity: "ERROR",
        section: "Bank details",
        field: "ifsc",
        message: `IFSC ${b.ifsc || "(empty)"} is not valid.`,
        suggestion: "Use an 11-character IFSC (e.g. HDFC0001234).",
        href: "/returns/ID/bank",
      });
    }
    if (!/^\d{9,18}$/.test(b.accountNumber)) {
      issues.push({
        level: 1,
        severity: "ERROR",
        section: "Bank details",
        field: "accountNumber",
        message: "Bank account number must be 9–18 digits.",
        suggestion: "Re-enter the account number without spaces.",
        href: "/returns/ID/bank",
      });
    }
  }
  for (const t of data.tds) {
    if (t.tan && !tanRe.test(t.tan)) {
      issues.push({
        level: 1,
        severity: "ERROR",
        section: "TDS",
        field: "tan",
        message: `TAN ${t.tan} is not valid.`,
        suggestion: "TAN format is AAAA99999A. Do not enter PAN in the TAN field.",
        href: "/returns/ID/tds",
      });
    }
  }
  return issues;
}

export function taxConsistencyValidation(data: NormalizedReturn): Issue[] {
  const issues: Issue[] = [];
  const calc = TaxEngine.calculate(data);
  if (data.itrType === "ITR-4" && calc.grossTotalIncome > ITR4_INCOME_CAP) {
    issues.push({
      level: 2,
      severity: "ERROR",
      section: "Income",
      field: "grossTotalIncome",
      message: "Gross total income exceeds the ₹50 lakh ITR-4 limit.",
      suggestion: "Switch this return to ITR-3.",
      href: "/returns/ID/summary",
    });
  }
  if (data.business.turnover > 0) {
    const p = presumptive44AD(data.business.turnover, data.business.digitalReceipts, data.business.cashReceipts, data.business.declaredIncome);
    if (!p.withinLimit) {
      issues.push({
        level: 2,
        severity: "ERROR",
        section: "Business",
        field: "turnover",
        message: "Turnover exceeds s.44AD limits for the cash/digital mix.",
        suggestion: "Use ITR-3 with books of account.",
        href: "/returns/ID/income",
      });
    }
    if (data.business.declaredIncome > 0 && data.business.declaredIncome < p.minimum) {
      issues.push({
        level: 2,
        severity: "ERROR",
        section: "Business",
        field: "declaredIncome",
        message: `Declared 44AD income is below the minimum of ₹${p.minimum.toLocaleString("en-IN")}.`,
        suggestion: "Declare at least 6% of digital receipts plus 8% of cash receipts, or maintain books and file ITR-3.",
        href: "/returns/ID/income",
      });
    }
  }
  if (data.profession.grossReceipts > 0) {
    const p = presumptive44ADA(data.profession.grossReceipts, data.profession.cashReceipts, data.profession.declaredIncome);
    if (!p.withinLimit) {
      issues.push({
        level: 2,
        severity: "ERROR",
        section: "Profession",
        field: "grossReceipts",
        message: "Professional receipts exceed s.44ADA limits.",
        suggestion: "Use ITR-3.",
        href: "/returns/ID/income",
      });
    }
  }
  const ltcg = data.capitalGains.filter((g) => g.section === "112A").reduce((s, g) => s + g.amount, 0);
  if (data.itrType === "ITR-4" && ltcg > ITR4_112A_CAP) {
    issues.push({
      level: 2,
      severity: "ERROR",
      section: "Capital gains",
      field: "112A",
      message: "s.112A LTCG exceeds ₹1.25 lakh allowed in ITR-4.",
      suggestion: "File ITR-3.",
      href: "/returns/ID/income",
    });
  }
  const tdsTotal = data.tds.reduce((s, t) => s + t.amount, 0) + data.salary.tds;
  if (tdsTotal > calc.totalTax + 50_000 && calc.totalTax === 0 && tdsTotal > 0) {
    issues.push({
      level: 2,
      severity: "WARNING",
      section: "TDS",
      field: "tds",
      message: "TDS claimed is high relative to computed tax. Reconcile with AIS / 26AS.",
      suggestion: "Open the reconciliation screen and confirm each TDS line.",
      href: "/returns/ID/reconcile",
    });
  }
  return issues;
}

type JsonSchema = {
  required?: string[];
  properties?: Record<string, unknown>;
};

export function validateAgainstOfficialSchema(
  json: unknown,
  assessmentYear: string,
  itrType: string,
): { valid: boolean; errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  if (assessmentYear !== "2026-27") {
    errors.push({
      level: 3,
      severity: "ERROR",
      section: "Official JSON schema",
      field: "assessmentYear",
      message: `No official schema bundled for AY ${assessmentYear}.`,
      suggestion: "Drop the ITD schema JSON into src/lib/itr-json/schemas.",
      href: "/returns/ID/validate",
    });
    return { valid: false, errors, warnings };
  }
  if (itrType !== "ITR-4" && itrType !== "ITR-3") {
    errors.push({
      level: 3,
      severity: "ERROR",
      section: "Official JSON schema",
      field: "itrType",
      message: "JSON generation is implemented for ITR-4 (full) and ITR-3 (architecture).",
      suggestion: "Complete eligibility first.",
      href: "/returns/ID/validate",
    });
    return { valid: false, errors, warnings };
  }
  const schema = officialItr4 as JsonSchema;
  const root = json as Record<string, unknown>;
  if (!root?.ITR || typeof root.ITR !== "object") {
    errors.push({
      level: 3,
      severity: "ERROR",
      section: "Official JSON schema",
      field: "ITR",
      message: "Root ITR object is missing.",
      suggestion: "Regenerate JSON from the mapper.",
      href: "/returns/ID/validate",
    });
  }
  const formKey = itrType === "ITR-4" ? "ITR4" : "ITR3";
  const form = (root?.ITR as Record<string, unknown> | undefined)?.[formKey];
  if (!form || typeof form !== "object") {
    errors.push({
      level: 3,
      severity: "ERROR",
      section: "Official JSON schema",
      field: formKey,
      message: `${formKey} node is missing.`,
      suggestion: "Regenerate JSON.",
      href: "/returns/ID/validate",
    });
  }
  for (const key of schema.required || []) {
    if (form && typeof form === "object" && !(key in (form as object))) {
      errors.push({
        level: 3,
        severity: "ERROR",
        section: "Official JSON schema",
        field: key,
        message: `Required schema node ${key} is missing.`,
        suggestion: "Complete the corresponding return section and regenerate.",
        href: "/returns/ID/validate",
      });
    }
  }
  if (itrType === "ITR-3") {
    warnings.push({
      level: 3,
      severity: "WARNING",
      section: "Official JSON schema",
      field: "ITR3",
      message: "ITR-3 JSON is architectural in this release. Do not upload it to the e-filing portal.",
      suggestion: "Complete ITR-3 schedules in a later phase.",
      href: "/returns/ID/summary",
    });
  }
  warnings.push({
    level: 3,
    severity: "INFO",
    section: "Official JSON schema",
    field: "schemaSource",
    message: "Validation uses the bundled AY 2026-27 adapter schema. Replace with the ITD-published schema file when you download it from the e-filing portal.",
    suggestion: "Keep src/lib/itr-json/schemas/ay2026_27/ITR-4.schema.json in sync with ITD releases.",
    href: "/returns/ID/validate",
  });
  return { valid: errors.length === 0, errors, warnings };
}

export function validateReturn(data: NormalizedReturn) {
  const level1 = fieldValidation(data);
  const level2 = taxConsistencyValidation(data);
  return { level1, level2, issues: [...level1, ...level2] };
}

export const panSchema = z.string().regex(panRe, "Invalid PAN");
export const ifscSchema = z.string().regex(ifscRe, "Invalid IFSC");

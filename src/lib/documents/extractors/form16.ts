import { findOnPages } from "../pages";
import { parseAmount } from "../rupees";
import { normalizedTaxField } from "../mapping";
import type { ExtractedField, ExtractionMethod, PdfPage } from "../types";

const AMT = String.raw`[₹Rs.\s]*[0-9][0-9,]*(?:\.\d{1,2})?`;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
const SEP = String.raw`[^0-9₹]{0,48}`;

export function isValidPanFormat(value: string) {
  return PAN_RE.test(value.trim().toUpperCase());
}

export function isValidTanFormat(value: string) {
  return TAN_RE.test(value.trim().toUpperCase());
}

function amtPatterns(labels: string[]) {
  return labels.flatMap((label) => [
    new RegExp(`${label}[:\\s.|]+(${AMT})`, "i"),
    new RegExp(`${label}${SEP}(${AMT})`, "i"),
  ]);
}

function pick(
  field: string,
  pages: PdfPage[],
  patterns: RegExp[],
  confs: number[],
  method: ExtractionMethod = "DETERMINISTIC",
): ExtractedField {
  const hit = findOnPages(pages, patterns);
  let confidence = 0;
  let value = hit.value;
  let warning: string | undefined;
  if (value) {
    const idx = hit.patternIndex >= 0 ? hit.patternIndex : 0;
    confidence = confs[Math.min(idx, confs.length - 1)] ?? 0.7;
    if (field === "employeePan") {
      value = value.toUpperCase();
      if (!isValidPanFormat(value)) {
        confidence = Math.min(confidence, 0.4);
        warning = "REVIEW_REQUIRED";
      } else {
        confidence = Math.max(confidence, 0.92);
      }
    }
    if (field === "employerTan") {
      value = value.toUpperCase();
      if (!isValidTanFormat(value)) {
        confidence = Math.min(confidence, 0.4);
        warning = "REVIEW_REQUIRED";
      } else {
        confidence = Math.max(confidence, 0.92);
      }
    }
    const numeric = parseAmount(value);
    const numericField = [
      "grossSalary",
      "exemptAllowances",
      "salaryDeductions",
      "standardDeduction",
      "professionalTax",
      "taxableSalary",
      "tds",
      "chapterVia",
    ].includes(field);
    if (numericField) {
      if (numeric == null) {
        confidence = Math.min(confidence, 0.35);
        warning = "REVIEW_REQUIRED";
      } else if (idx === 0) {
        confidence = Math.max(confidence, 0.9);
      }
    }
  }
  return {
    field,
    normalizedTaxField: normalizedTaxField("FORM_16", field),
    documentType: "FORM_16",
    value,
    numericValue: parseAmount(value),
    confidence: value ? confidence : 0,
    sourcePage: hit.sourcePage,
    sourceText: hit.sourceText,
    extractionMethod: method,
    warning,
  };
}

export function extractForm16(pages: PdfPage[], method: ExtractionMethod = "DETERMINISTIC"): ExtractedField[] {
  const fields = [
    pick("employeeName", pages, [
      /Employee\s*Name[:\s]+([A-Za-z .]{3,80}?)(?=\s+PAN\b|\s+TAN\b|\s+Permanent|\s+Employer|$)/i,
      /Name of the Employee[:\s]+([A-Za-z .]{3,80}?)(?=\s+PAN\b|\s+TAN\b|\s+Permanent|\s+Employer|$)/i,
    ], [0.9, 0.86], method),
    pick("employeePan", pages, [
      /(?:Permanent Account Number|\bPAN)[:\s]+([A-Z]{5}[0-9]{4}[A-Z])/i,
      /\bPAN[:\s]+([A-Za-z]{5}[0-9]{4}[A-Za-z])/i,
      /\bPAN[:\s]+([A-Z0-9]{10})\b/i,
    ], [0.96, 0.9, 0.5], method),
    pick("employerName", pages, [
      /(?:Name of (?:the )?Employer|Employer Name)[:\s]+([A-Za-z0-9 .,&-]{3,80}?)(?=\s+TAN\b|\s+PAN\b|\s+Tax Deduction|$)/i,
    ], [0.86], method),
    pick("employerTan", pages, [
      /(?:Tax Deduction(?: and Collection)? Account Number|\bTAN)[:\s]+([A-Z]{4}[0-9]{5}[A-Z])/i,
      /\bTAN[:\s]+([A-Za-z]{4}[0-9]{5}[A-Za-z])/i,
    ], [0.96, 0.9], method),
    pick("assessmentYear", pages, [/Assessment Year[:\s]+(20\d{2}\s*-?\s*\d{2})/i], [0.9], method),
    pick("financialYear", pages, [/Financial Year[:\s]+(20\d{2}\s*-?\s*\d{2})/i], [0.88], method),
    pick("grossSalary", pages, amtPatterns(["Gross(?:\\s+Total)?\\s*Salary", "Total Salary", "(?<!(?:Taxable|Chargeable|Net)\\s)Salary"]), [0.94, 0.9, 0.82, 0.78, 0.7, 0.62], method),
    pick("exemptAllowances", pages, amtPatterns(["Exempt(?:ions| allowances)?", "Allowances exempt"]), [0.82, 0.76, 0.72, 0.68], method),
    pick("salaryDeductions", pages, amtPatterns(["Salary Deductions?", "Deductions under salary"]), [0.8, 0.74, 0.7, 0.66], method),
    pick("standardDeduction", pages, amtPatterns(["Standard Deduction"]), [0.9, 0.82], method),
    pick("professionalTax", pages, amtPatterns(["Professional Tax"]), [0.86, 0.78], method),
    pick("taxableSalary", pages, amtPatterns(["Income chargeable under the head Salaries", "Taxable(?: Income| Salary)"]), [0.88, 0.82, 0.8, 0.74], method),
    pick("tds", pages, amtPatterns(["(?:Total )?Tax deducted(?: at source)?", "\\bTDS"]), [0.94, 0.88, 0.9, 0.8], method),
    pick("chapterVia", pages, amtPatterns(["Deduction under Chapter VI-A", "Chapter VI-A"]), [0.8, 0.74, 0.76, 0.7], method),
  ];
  if (form16Reconciliation(fields)) {
    for (const f of fields) {
      if ((f.field === "grossSalary" || f.field === "taxableSalary") && f.value) {
        f.confidence = Math.min(f.confidence, 0.75);
        f.warning = f.warning || "FORM16_RECONCILIATION_WARNING";
      }
    }
  }
  return fields;
}

export function form16Reconciliation(fields: ExtractedField[]): string | null {
  const n = (k: string) => fields.find((f) => f.field === k)?.numericValue;
  const gross = n("grossSalary");
  const taxable = n("taxableSalary");
  if (gross == null || taxable == null) return null;
  const exempt = n("exemptAllowances") ?? 0;
  const salaryDed = n("salaryDeductions") ?? 0;
  const std = n("standardDeduction") ?? 0;
  const pt = n("professionalTax") ?? 0;
  const expected = gross - exempt - salaryDed - std - pt;
  if (Math.abs(expected - taxable) > 2) return "FORM16_RECONCILIATION_WARNING";
  return null;
}

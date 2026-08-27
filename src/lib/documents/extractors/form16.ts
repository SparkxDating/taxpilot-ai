import { findOnPages } from "../pages";
import { parseAmount } from "../rupees";
import { normalizedTaxField } from "../mapping";
import type { ExtractedField, PdfPage } from "../types";

const AMT = String.raw`[₹Rs.\s]*[0-9][0-9,]*(?:\.\d{1,2})?`;

function pick(field: string, pages: PdfPage[], patterns: RegExp[], conf: number): ExtractedField {
  const hit = findOnPages(pages, patterns);
  return {
    field,
    normalizedTaxField: normalizedTaxField("FORM_16", field),
    documentType: "FORM_16",
    value: hit.value,
    numericValue: parseAmount(hit.value),
    confidence: hit.value ? conf : 0,
    sourcePage: hit.sourcePage,
    sourceText: hit.sourceText,
    extractionMethod: "local",
  };
}

export function extractForm16(pages: PdfPage[]): ExtractedField[] {
  return [
    pick("employeeName", pages, [
      /Employee\s*Name[:\s]+([A-Za-z .]{3,80}?)(?=\s+PAN\b|\s+TAN\b|$)/i,
      /Name of the Employee[:\s]+([A-Za-z .]{3,80}?)(?=\s+PAN\b|\s+TAN\b|$)/i,
    ], 0.86),
    pick("employeePan", pages, [/\bPAN[:\s]+([A-Z]{5}[0-9]{4}[A-Z])\b/i], 0.95),
    pick("employerName", pages, [
      /(?:Name of (?:the )?Employer|Employer Name)[:\s]+([A-Za-z0-9 .,&-]{3,80}?)(?=\s+TAN\b|\s+PAN\b|$)/i,
    ], 0.84),
    pick("employerTan", pages, [/\bTAN[:\s]+([A-Z]{4}[0-9]{5}[A-Z])\b/i], 0.95),
    pick("assessmentYear", pages, [/Assessment Year[:\s]+(20\d{2}\s*-?\s*\d{2})/i], 0.9),
    pick("grossSalary", pages, [
      new RegExp(`Gross(?:\\s+total)?\\s*Salary[:\\s]+(${AMT})`, "i"),
      new RegExp(`Total Salary[:\\s]+(${AMT})`, "i"),
      new RegExp(`(?<!(?:Taxable|Chargeable|Net)\\s)Salary[:\\s]+(${AMT})`, "i"),
    ], 0.88),
    pick("exemptAllowances", pages, [
      new RegExp(`Exempt(?:ions| allowances)?[:\\s]+(${AMT})`, "i"),
      new RegExp(`Allowances exempt[:\\s]+(${AMT})`, "i"),
    ], 0.75),
    pick("standardDeduction", pages, [new RegExp(`Standard Deduction[:\\s]+(${AMT})`, "i")], 0.85),
    pick("professionalTax", pages, [new RegExp(`Professional Tax[:\\s]+(${AMT})`, "i")], 0.8),
    pick("taxableSalary", pages, [
      new RegExp(`Income chargeable under the head Salaries[:\\s]+(${AMT})`, "i"),
      new RegExp(`Taxable(?: Income| Salary)[:\\s]+(${AMT})`, "i"),
    ], 0.82),
    pick("tds", pages, [
      new RegExp(`(?:Total )?Tax deducted(?: at source)?[:\\s]+(${AMT})`, "i"),
      new RegExp(`\\bTDS[:\\s]+(${AMT})`, "i"),
    ], 0.9),
    pick("chapterVia", pages, [
      new RegExp(`Chapter VI-A[:\\s]+(${AMT})`, "i"),
      new RegExp(`Deduction under Chapter VI-A[:\\s]+(${AMT})`, "i"),
    ], 0.7),
  ];
}

export function form16Reconciliation(fields: ExtractedField[]): string | null {
  const n = (k: string) => fields.find((f) => f.field === k)?.numericValue;
  const gross = n("grossSalary");
  const taxable = n("taxableSalary");
  if (gross == null || taxable == null) return null;
  const exempt = n("exemptAllowances") ?? 0;
  const std = n("standardDeduction") ?? 0;
  const pt = n("professionalTax") ?? 0;
  const expected = gross - exempt - std - pt;
  if (Math.abs(expected - taxable) > 2) return "FORM16_RECONCILIATION_WARNING";
  return null;
}

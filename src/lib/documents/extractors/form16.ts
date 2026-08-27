import type { ExtractedField } from "../types";
import { parseAmount } from "../rupees";

function field(name: string, re: RegExp, text: string, conf: number): ExtractedField {
  const m = text.match(re);
  const value = m?.[1]?.trim() || null;
  return {
    field: name,
    value,
    numericValue: parseAmount(value),
    confidence: value ? conf : 0,
    sourcePage: "1",
    sourceText: m?.[0]?.slice(0, 180) || "",
    extractionMethod: "local",
  };
}

export function extractForm16(text: string): ExtractedField[] {
  const t = text.replace(/\s+/g, " ");
  return [
    field("employeeName", /Employee\s*Name[:\s]+([A-Za-z .]{3,80})/i, t, 0.86),
    field("employeePan", /\bPAN[:\s]+([A-Z]{5}[0-9]{4}[A-Z])\b/i, t, 0.95),
    field("employerName", /(?:Name of Employer|Employer)[:\s]+([A-Za-z0-9 .,&-]{3,80})/i, t, 0.84),
    field("employerTan", /\bTAN[:\s]+([A-Z]{4}[0-9]{5}[A-Z])\b/i, t, 0.95),
    field("assessmentYear", /Assessment Year[:\s]+(20\d{2}\s*-\s*\d{2})/i, t, 0.9),
    field("grossSalary", /Gross Salary[:\s]+([₹0-9,]+)/i, t, 0.88),
    field("exemptAllowances", /Exempt(?:ions| allowances)?[:\s]+([₹0-9,]+)/i, t, 0.75),
    field("standardDeduction", /Standard Deduction[:\s]+([₹0-9,]+)/i, t, 0.85),
    field("professionalTax", /Professional Tax[:\s]+([₹0-9,]+)/i, t, 0.8),
    field("taxableSalary", /(?:Taxable Income|Income chargeable under the head Salaries)[:\s]+([₹0-9,]+)/i, t, 0.82),
    field("tds", /(?:Tax Deducted|Total tax deducted)[:\s]+([₹0-9,]+)/i, t, 0.9),
    field("chapterVia", /Chapter VI-A[:\s]+([₹0-9,]+)/i, t, 0.7),
  ];
}

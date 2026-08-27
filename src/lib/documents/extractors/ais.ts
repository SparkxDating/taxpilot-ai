import type { ExtractedField } from "../types";
import { parseAmount } from "../rupees";

function grab(label: string, field: string, text: string, conf: number): ExtractedField {
  const re = new RegExp(`${label}[:\\s]+([₹0-9,]+)`, "i");
  const m = text.match(re);
  const value = m?.[1]?.trim() || null;
  return {
    field,
    value,
    numericValue: parseAmount(value),
    confidence: value ? conf : 0,
    sourcePage: "1",
    sourceText: m?.[0]?.slice(0, 180) || "",
    extractionMethod: "local",
  };
}

export function extractAis(text: string): ExtractedField[] {
  const t = text.replace(/\s+/g, " ");
  return [
    grab("Salary", "ais.salary", t, 0.8),
    grab("Interest", "ais.interest", t, 0.8),
    grab("Dividend", "ais.dividend", t, 0.8),
    grab("TDS", "ais.tds", t, 0.82),
    grab("TCS", "ais.tcs", t, 0.82),
    grab("Securities", "ais.securities", t, 0.7),
    grab("Mutual Fund", "ais.mutualFunds", t, 0.7),
  ];
}

export function extractTis(text: string): ExtractedField[] {
  const t = text.replace(/\s+/g, " ");
  return [
    grab("Reported Income", "tis.reportedIncome", t, 0.78),
    grab("Processed Information", "tis.processed", t, 0.7),
    grab("TDS", "tis.tds", t, 0.82),
    grab("TCS", "tis.tcs", t, 0.82),
  ];
}

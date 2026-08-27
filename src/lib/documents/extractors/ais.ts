import { findOnPages } from "../pages";
import { parseAmount } from "../rupees";
import { normalizedTaxField } from "../mapping";
import type { DocumentType, ExtractedField, PdfPage } from "../types";

const AMT = String.raw`[₹Rs.\s]*[0-9][0-9,]*(?:\.\d{1,2})?`;

const AIS_CATS: Array<{ field: string; patterns: RegExp[]; original: string }> = [
  { field: "salary", original: "SALARY", patterns: [new RegExp(`(?:Income from\\s+)?Salary[:\\s]+(${AMT})`, "i")] },
  { field: "interest", original: "INTEREST", patterns: [new RegExp(`Interest(?: income)?[:\\s]+(${AMT})`, "i"), new RegExp(`Income from Interest[:\\s]+(${AMT})`, "i")] },
  { field: "dividend", original: "DIVIDEND", patterns: [new RegExp(`Dividend(?: income)?[:\\s]+(${AMT})`, "i")] },
  { field: "securities", original: "SECURITIES", patterns: [new RegExp(`Securities(?: transactions?)?[:\\s]+(${AMT})`, "i")] },
  { field: "mutualFund", original: "MUTUAL_FUND", patterns: [new RegExp(`Mutual Funds?[:\\s]+(${AMT})`, "i")] },
  { field: "tds", original: "TDS", patterns: [new RegExp(`\\bTDS[:\\s]+(${AMT})`, "i")] },
  { field: "tcs", original: "TCS", patterns: [new RegExp(`\\bTCS[:\\s]+(${AMT})`, "i")] },
  { field: "other", original: "OTHER", patterns: [new RegExp(`Other(?: reported)?(?: information)?[:\\s]+(${AMT})`, "i")] },
];

function grab(
  kind: DocumentType,
  field: string,
  pages: PdfPage[],
  patterns: RegExp[],
  conf: number,
  original?: string,
): ExtractedField {
  const hit = findOnPages(pages, patterns);
  return {
    field,
    normalizedTaxField: normalizedTaxField(kind, field),
    documentType: kind,
    value: hit.value,
    numericValue: parseAmount(hit.value),
    confidence: hit.value ? conf : 0,
    sourcePage: hit.sourcePage,
    sourceText: hit.sourceText,
    extractionMethod: "local",
    originalCategory: original,
  };
}

export function extractAis(pages: PdfPage[]): ExtractedField[] {
  return AIS_CATS.map((c) => grab("AIS", c.field, pages, c.patterns, 0.8, c.original));
}

export function extractTis(pages: PdfPage[]): ExtractedField[] {
  return [
    grab("TIS", "reportedIncome", pages, [new RegExp(`Reported Income[:\\s]+(${AMT})`, "i"), new RegExp(`Information processed[:\\s]+(${AMT})`, "i")], 0.78),
    grab("TIS", "processed", pages, [new RegExp(`Processed Information[:\\s]+(${AMT})`, "i")], 0.7),
    grab("TIS", "tds", pages, [new RegExp(`\\bTDS[:\\s]+(${AMT})`, "i")], 0.82),
    grab("TIS", "tcs", pages, [new RegExp(`\\bTCS[:\\s]+(${AMT})`, "i")], 0.82),
  ];
}

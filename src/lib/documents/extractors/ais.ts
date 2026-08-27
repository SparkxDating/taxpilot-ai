import { findOnPages } from "../pages";
import { parseAmount } from "../rupees";
import { normalizedTaxField } from "../mapping";
import type { AisTransaction, DocumentType, ExtractedField, ExtractionMethod, PdfPage } from "../types";

const AMT = String.raw`[₹Rs.\s]*[0-9][0-9,]*(?:\.\d{1,2})?`;

const AIS_CATS: Array<{ field: string; patterns: RegExp[]; original: string; confs: number[] }> = [
  { field: "salary", original: "SALARY", confs: [0.88, 0.8], patterns: [new RegExp(`(?:Income from\\s+)?Salary[:\\s.|]+(${AMT})`, "i"), new RegExp(`(?:Income from\\s+)?Salary[^0-9₹]{0,40}(${AMT})`, "i")] },
  { field: "interest", original: "INTEREST", confs: [0.88, 0.82, 0.78], patterns: [new RegExp(`Interest(?: income)?[:\\s.|]+(${AMT})`, "i"), new RegExp(`Income from Interest[:\\s.|]+(${AMT})`, "i"), new RegExp(`Interest[^0-9₹]{0,40}(${AMT})`, "i")] },
  { field: "dividend", original: "DIVIDEND", confs: [0.86, 0.78], patterns: [new RegExp(`Dividend(?: income)?[:\\s.|]+(${AMT})`, "i"), new RegExp(`Dividend[^0-9₹]{0,40}(${AMT})`, "i")] },
  { field: "securities", original: "SECURITIES", confs: [0.82, 0.74], patterns: [new RegExp(`Securities(?: transactions?)?[:\\s.|]+(${AMT})`, "i"), new RegExp(`Securities[^0-9₹]{0,40}(${AMT})`, "i")] },
  { field: "mutualFund", original: "MUTUAL_FUND", confs: [0.82, 0.74], patterns: [new RegExp(`Mutual Funds?[:\\s.|]+(${AMT})`, "i"), new RegExp(`Mutual Funds?[^0-9₹]{0,40}(${AMT})`, "i")] },
  { field: "tds", original: "TDS", confs: [0.9, 0.8], patterns: [new RegExp(`\\bTDS[:\\s.|]+(${AMT})`, "i"), new RegExp(`\\bTDS[^0-9₹]{0,40}(${AMT})`, "i")] },
  { field: "tcs", original: "TCS", confs: [0.9, 0.8], patterns: [new RegExp(`\\bTCS[:\\s.|]+(${AMT})`, "i"), new RegExp(`\\bTCS[^0-9₹]{0,40}(${AMT})`, "i")] },
  { field: "other", original: "OTHER", confs: [0.7, 0.62], patterns: [new RegExp(`Other(?: reported)?(?: information)?[:\\s.|]+(${AMT})`, "i"), new RegExp(`Other(?: reported)?(?: information)?[^0-9₹]{0,40}(${AMT})`, "i")] },
];

export function normalizeAisCategory(raw: string) {
  const n = raw.toLowerCase();
  if (/salary|\bpayroll\b/.test(n)) return "SALARY";
  if (/interest/.test(n)) return "INTEREST";
  if (/dividend/.test(n)) return "DIVIDEND";
  if (/securit/.test(n)) return "SECURITIES";
  if (/mutual|mf\b/.test(n)) return "MUTUAL_FUND";
  if (/\btds\b/.test(n)) return "TDS";
  if (/\btcs\b/.test(n)) return "TCS";
  return "OTHER";
}

function grab(
  kind: DocumentType,
  field: string,
  pages: PdfPage[],
  patterns: RegExp[],
  confs: number[],
  original: string | undefined,
  method: ExtractionMethod,
): ExtractedField {
  const hit = findOnPages(pages, patterns);
  let confidence = 0;
  if (hit.value) {
    const idx = hit.patternIndex >= 0 ? hit.patternIndex : 0;
    confidence = confs[Math.min(idx, confs.length - 1)] ?? 0.7;
    if (parseAmount(hit.value) == null) confidence = Math.min(confidence, 0.35);
  }
  return {
    field,
    normalizedTaxField: normalizedTaxField(kind, field),
    documentType: kind,
    value: hit.value,
    numericValue: parseAmount(hit.value),
    confidence: hit.value ? confidence : 0,
    sourcePage: hit.sourcePage,
    sourceText: hit.sourceText,
    extractionMethod: method,
    originalCategory: original,
  };
}

export function extractAis(pages: PdfPage[], method: ExtractionMethod = "DETERMINISTIC"): ExtractedField[] {
  return AIS_CATS.map((c) => grab("AIS", c.field, pages, c.patterns, c.confs, c.original, method));
}

export function extractAisTransactions(pages: PdfPage[]): AisTransaction[] {
  const rows: AisTransaction[] = [];
  for (const page of pages) {
    const lines = page.text.split(/\n|;|\r/);
    for (const line of lines) {
      const compact = line.replace(/\s+/g, " ").trim();
      const m = compact.match(
        /^(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|20\d{2}-\d{2}-\d{2})\s+(.+?)\s+(₹?\s*[0-9][0-9,]*(?:\.\d{1,2})?)\s*$/,
      );
      if (!m) continue;
      const amount = parseAmount(m[3]);
      if (amount == null) continue;
      const description = m[2].trim();
      const category = normalizeAisCategory(description);
      rows.push({
        date: m[1],
        description,
        amount,
        reportedValue: amount,
        source: "AIS",
        category,
        originalCategory: description.slice(0, 80),
        sourcePage: page.pageNumber,
        sourceText: compact.slice(0, 180),
      });
    }
  }
  return rows;
}

export function extractTis(pages: PdfPage[], method: ExtractionMethod = "DETERMINISTIC"): ExtractedField[] {
  return [
    grab("TIS", "reportedIncome", pages, [new RegExp(`Reported Income[:\\s]+(${AMT})`, "i"), new RegExp(`Information processed[:\\s]+(${AMT})`, "i")], [0.78, 0.7], undefined, method),
    grab("TIS", "processed", pages, [new RegExp(`Processed Information[:\\s]+(${AMT})`, "i")], [0.7], undefined, method),
    grab("TIS", "tds", pages, [new RegExp(`\\bTDS[:\\s]+(${AMT})`, "i")], [0.82], undefined, method),
    grab("TIS", "tcs", pages, [new RegExp(`\\bTCS[:\\s]+(${AMT})`, "i")], [0.82], undefined, method),
  ];
}

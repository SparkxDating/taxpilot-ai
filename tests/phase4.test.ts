import { describe, expect, it } from "vitest";
import { extractForm16, form16Reconciliation, isValidPanFormat } from "@/lib/documents/extractors/form16";
import { extractAis, extractAisTransactions, normalizeAisCategory } from "@/lib/documents/extractors/ais";
import { pagesFromText } from "@/lib/documents/pages";
import { parseAmount } from "@/lib/documents/rupees";
import { parseAiExtraction, shouldReuseExtraction, shouldUseAiFallback } from "@/lib/documents/fallback";
import { runExtraction } from "@/lib/documents/pipeline";
import type { DocumentAIProvider } from "@/lib/providers/documentAi";
import type { PdfPage } from "@/lib/documents/types";

const MULTI: PdfPage[] = [
  { pageNumber: 1, text: "Form 16 Name of the Employee: ANITA SHARMA Permanent Account Number: AAAPA1234A Name of Employer: Demo Tech Pvt Ltd TAN: DELD12345E Assessment Year: 2026-27 Financial Year: 2025-26" },
  { pageNumber: 2, text: "Gross Total Salary 12,50,000 Exempt allowances 50,000 Standard Deduction 75,000 Professional Tax 2,500 Taxable Salary 11,22,500" },
  { pageNumber: 3, text: "Chapter VI-A 1,50,000 Tax deducted at source ₹1,10,000" },
];

describe("Form 16 phase 4", () => {
  it("handles label variation, Indian amounts, and multi-page provenance", () => {
    const fields = extractForm16(MULTI);
    expect(fields.find((f) => f.field === "employeePan")?.value).toBe("AAAPA1234A");
    expect(fields.find((f) => f.field === "financialYear")?.value).toMatch(/2025/);
    expect(fields.find((f) => f.field === "grossSalary")?.numericValue).toBe(1_250_000);
    expect(fields.find((f) => f.field === "grossSalary")?.sourcePage).toBe(2);
    expect(fields.find((f) => f.field === "tds")?.sourcePage).toBe(3);
    expect(fields.find((f) => f.field === "tds")?.numericValue).toBe(110_000);
    expect(parseAmount("₹12,50,000.50")).toBe(1_250_001);
    expect(isValidPanFormat("AAAPA1234A")).toBe(true);
    expect(isValidPanFormat("AAAPA12345")).toBe(false);
  });

  it("emits reconciliation warning without changing values", () => {
    const fields = extractForm16(pagesFromText("Gross Salary: 12,50,000 Standard Deduction: 75,000 Taxable Salary: 10,00,000"));
    expect(form16Reconciliation(fields)).toBe("FORM16_RECONCILIATION_WARNING");
    expect(fields.find((f) => f.field === "grossSalary")?.numericValue).toBe(1_250_000);
  });
});

describe("AIS phase 4", () => {
  it("normalizes categories and parses amounts without merging", () => {
    expect(normalizeAisCategory("Interest from SBI savings")).toBe("INTEREST");
    const ais = extractAis(pagesFromText("AIS Interest: ₹12,50,000 Dividend: 5,000 TDS: 50,000"));
    expect(ais.find((f) => f.field === "interest")?.numericValue).toBe(1_250_000);
    expect(ais.find((f) => f.field === "dividend")?.numericValue).toBe(5_000);
    expect(ais.find((f) => f.field === "interest")?.originalCategory).toBe("INTEREST");
  });

  it("extracts transaction-level AIS rows with page provenance", () => {
    const tx = extractAisTransactions([
      { pageNumber: 2, text: "01-04-2025 Interest from SBI 12,000\n02-04-2025 Dividend payout 5,000" },
    ]);
    expect(tx).toHaveLength(2);
    expect(tx[0].category).toBe("INTEREST");
    expect(tx[0].amount).toBe(12_000);
    expect(tx[0].sourcePage).toBe(2);
    expect(tx[1].category).toBe("DIVIDEND");
  });
});

describe("fallback and cost control", () => {
  it("requests fallback for low confidence and skips AI when deterministic confidence is high", async () => {
    const weak = [{ field: "grossSalary", normalizedTaxField: "salary.grossSalary", documentType: "FORM_16" as const, value: "1", numericValue: 1, confidence: 0.4, sourcePage: 1, sourceText: "x", extractionMethod: "DETERMINISTIC" as const }];
    expect(shouldUseAiFallback("FORM_16", weak, true)).toBe(true);
    let calls = 0;
    const ai: DocumentAIProvider = {
      name: "mock",
      model: "mock-1",
      configured: true,
      async extractDocument() {
        calls += 1;
        return { ok: true, payload: { documentType: "FORM_16", fields: [] } };
      },
    };
    const bytes = Buffer.from("Form 16 PAN: BBBBB1234B Gross Salary: 100000 Tax Deducted: 5000");
    const r = await runExtraction({ bytes, fileName: "form16.txt", mimeType: "text/plain", declaredKind: "FORM_16" }, { ai });
    expect(r.usedAi).toBe(false);
    expect(calls).toBe(0);
    expect(r.fields.find((f) => f.field === "grossSalary")?.extractionMethod).toBe("DETERMINISTIC");
  });

  it("rejects malformed AI output and keeps AI fields unverified", () => {
    expect(parseAiExtraction("not-json", "FORM_16").ok).toBe(false);
    const ok = parseAiExtraction(
      { documentType: "FORM_16", fields: [{ field: "grossSalary", value: 1250000, confidence: 0.95, sourcePage: 2, sourceText: "Gross Salary 1250000" }] },
      "FORM_16",
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.fields[0].extractionMethod).toBe("AI");
      expect(ok.fields[0].numericValue).toBe(1_250_000);
    }
  });

  it("reuses cached extraction unless force reprocess", () => {
    expect(
      shouldReuseExtraction({
        storedVersion: "form16-v1+ais-v1",
        storedConfig: "det+no-ocr+no-ai",
        currentVersion: "form16-v1+ais-v1",
        currentConfig: "det+no-ocr+no-ai",
        hasSuccessfulResult: true,
      }),
    ).toBe(true);
    expect(
      shouldReuseExtraction({
        force: true,
        storedVersion: "form16-v1+ais-v1",
        storedConfig: "det+no-ocr+no-ai",
        currentVersion: "form16-v1+ais-v1",
        currentConfig: "det+no-ocr+no-ai",
        hasSuccessfulResult: true,
      }),
    ).toBe(false);
  });
});

import { z } from "zod";
import { HIGH, MEDIUM, type DocumentType, type ExtractedField } from "./types";
import { normalizedTaxField } from "./mapping";
import { parseAmount } from "./rupees";

const AiField = z.object({
  field: z.string().min(1),
  value: z.union([z.string(), z.number(), z.null()]),
  confidence: z.number().min(0).max(1),
  sourcePage: z.number().int().positive().nullable().optional(),
  sourceText: z.string().optional(),
});

const AiContract = z.object({
  documentType: z.enum(["FORM_16", "AIS"]),
  fields: z.array(AiField),
});

const ALLOWED: Record<string, Set<string>> = {
  FORM_16: new Set([
    "employeeName",
    "employeePan",
    "employerName",
    "employerTan",
    "assessmentYear",
    "financialYear",
    "grossSalary",
    "exemptAllowances",
    "salaryDeductions",
    "standardDeduction",
    "professionalTax",
    "chapterVia",
    "taxableSalary",
    "tds",
  ]),
  AIS: new Set(["salary", "interest", "dividend", "securities", "mutualFund", "tds", "tcs", "other"]),
};

export function shouldUseAiFallback(kind: DocumentType, fields: ExtractedField[], hasText: boolean) {
  if (!hasText) return true;
  const present = fields.filter((f) => f.value);
  if (!present.length) return true;
  if (kind === "FORM_16") {
    const core = ["employeePan", "grossSalary", "tds"];
    const strong = core.filter((k) => {
      const f = present.find((x) => x.field === k);
      return f && f.confidence >= HIGH;
    });
    if (strong.length >= 2) return false;
    return strong.length < 2;
  }
  if (kind === "AIS") {
    const avg = present.reduce((s, f) => s + f.confidence, 0) / present.length;
    return avg < MEDIUM;
  }
  return present.every((f) => f.confidence < MEDIUM);
}

export function parseAiExtraction(raw: unknown, kind: DocumentType): { ok: true; fields: ExtractedField[] } | { ok: false; error: string } {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: "AI_EXTRACTION_FAILED" };
    }
  }
  const parsed = AiContract.safeParse(data);
  if (!parsed.success) return { ok: false, error: "AI_EXTRACTION_FAILED" };
  if (parsed.data.documentType !== kind && kind !== "OTHER") {
    if (parsed.data.documentType !== "FORM_16" && parsed.data.documentType !== "AIS") {
      return { ok: false, error: "AI_EXTRACTION_FAILED" };
    }
  }
  const allowed = ALLOWED[kind] || ALLOWED[parsed.data.documentType];
  const fields: ExtractedField[] = [];
  for (const f of parsed.data.fields) {
    if (!allowed.has(f.field)) continue;
    const value = f.value == null ? null : String(f.value);
    fields.push({
      field: f.field,
      normalizedTaxField: normalizedTaxField(kind === "TIS" ? "AIS" : kind, f.field) || normalizedTaxField(parsed.data.documentType, f.field),
      documentType: kind === "AIS" || kind === "FORM_16" ? kind : parsed.data.documentType,
      value,
      numericValue: parseAmount(value),
      confidence: f.confidence,
      sourcePage: f.sourcePage ?? null,
      sourceText: (f.sourceText || "").slice(0, 180),
      extractionMethod: "AI",
    });
  }
  return { ok: true, fields };
}

export function mergeFallbackFields(base: ExtractedField[], incoming: ExtractedField[]) {
  const byField = new Map(base.map((f) => [f.field, f]));
  for (const f of incoming) {
    const current = byField.get(f.field);
    if (!current || current.value == null || current.confidence < MEDIUM) {
      byField.set(f.field, { ...f, extractionMethod: f.extractionMethod });
    }
  }
  return [...byField.values()];
}

export function extractionConfigKey(ocr: boolean, ai: boolean) {
  return `det+${ocr ? "ocr" : "no-ocr"}+${ai ? "ai" : "no-ai"}`;
}

export function shouldReuseExtraction(opts: {
  force?: boolean;
  storedVersion: string;
  storedConfig: string;
  currentVersion: string;
  currentConfig: string;
  hasSuccessfulResult: boolean;
}) {
  if (opts.force) return false;
  return (
    opts.hasSuccessfulResult &&
    opts.storedVersion === opts.currentVersion &&
    opts.storedConfig === opts.currentConfig &&
    Boolean(opts.storedVersion)
  );
}

export type DocumentAIExtractInput = {
  documentType: DocumentType;
  pages: { pageNumber: number; text: string }[];
  promptVersion: string;
};

export type DocumentAIResult = { ok: true; payload: unknown } | { ok: false; error: string };

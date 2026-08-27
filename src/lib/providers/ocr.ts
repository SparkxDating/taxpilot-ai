import type { PdfPage } from "@/lib/documents/types";

export type ExtractionCandidate = {
  fieldKey: string;
  extractedValue: string;
  numericValue?: number;
  confidence: number;
  pageRef?: string;
};

export type OcrTextResult = { pages: PdfPage[]; error?: string };

export interface DocumentExtractionProvider {
  name: string;
  configured: boolean;
  extractText(input: { fileName: string; mimeType: string; bytes: Buffer }): Promise<OcrTextResult>;
  extract(input: { fileName: string; mimeType: string; bytes: Buffer }): Promise<ExtractionCandidate[]>;
}

/** Isolated development adapter — does not pretend to read documents. */
export class UnconfiguredOcrProvider implements DocumentExtractionProvider {
  name = "unconfigured";
  configured = false;
  async extractText(): Promise<OcrTextResult> {
    return { pages: [], error: "OCR_PROVIDER is not configured" };
  }
  async extract(): Promise<ExtractionCandidate[]> {
    return [];
  }
}

export function getOcrProvider(): DocumentExtractionProvider {
  const name = (process.env.OCR_PROVIDER || "").trim().toLowerCase();
  if (!name || name === "off" || name === "none") return new UnconfiguredOcrProvider();
  return new UnconfiguredOcrProvider();
}

export const MIN_AUTO_INSERT_CONFIDENCE = 0.92;

export type ExtractionStatus = "UPLOADED" | "PROCESSING" | "EXTRACTED" | "NEEDS_REVIEW" | "CONFIRMED" | "FAILED";

export type ExtractionField = {
  field: string;
  value: string;
  confidence: number;
  sourceDocument: string;
  sourceLocation: string;
  confirmed: boolean;
  confirmedAt?: string;
};

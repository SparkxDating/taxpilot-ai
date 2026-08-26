export type ExtractionCandidate = {
  fieldKey: string;
  extractedValue: string;
  numericValue?: number;
  confidence: number;
  pageRef?: string;
};

export interface DocumentExtractionProvider {
  name: string;
  configured: boolean;
  extract(input: { fileName: string; mimeType: string; bytes: Buffer }): Promise<ExtractionCandidate[]>;
}

/** Isolated development adapter — does not pretend to read documents. */
export class UnconfiguredOcrProvider implements DocumentExtractionProvider {
  name = "unconfigured";
  configured = false;
  async extract(): Promise<ExtractionCandidate[]> {
    return [];
  }
}

export function getOcrProvider(): DocumentExtractionProvider {
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

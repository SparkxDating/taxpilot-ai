export const DOCUMENT_TYPES = [
  "FORM_16",
  "AIS",
  "TIS",
  "BANK_STATEMENT",
  "SALARY_SLIP",
  "INVESTMENT_PROOF",
  "INSURANCE_PROOF",
  "HOME_LOAN_CERTIFICATE",
  "DONATION_RECEIPT",
  "CAPITAL_GAINS_STATEMENT",
  "FORM_26AS",
  "OTHER",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const HIGH = Number(process.env.DOCUMENT_CONFIDENCE_HIGH || 0.9);
export const MEDIUM = Number(process.env.DOCUMENT_CONFIDENCE_MEDIUM || 0.7);

export function confidenceLevel(n: number): "HIGH" | "MEDIUM" | "LOW" {
  if (n >= HIGH) return "HIGH";
  if (n >= MEDIUM) return "MEDIUM";
  return "LOW";
}

export type PdfPage = { pageNumber: number; text: string };

export type ExtractionMethod = "DETERMINISTIC" | "OCR" | "AI" | "local" | "csv" | "xlsx" | "filename" | "placeholder";

export type ExtractedField = {
  field: string;
  normalizedTaxField: string;
  documentType: DocumentType;
  value: string | null;
  numericValue?: number | null;
  confidence: number;
  sourcePage: number | null;
  sourceText: string;
  extractionMethod: ExtractionMethod;
  originalCategory?: string;
  warning?: string;
};

export type AisTransaction = {
  date: string;
  description: string;
  amount: number | null;
  reportedValue: number | null;
  source: string;
  category: string;
  originalCategory: string;
  sourcePage: number | null;
  sourceText: string;
};

export type BankRow = {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference: string;
  sourcePage: number | null;
  rawCategory: string;
  suggestedCategory: string;
  verifiedCategory: string | null;
};

export type ExtractionResult = {
  kind: DocumentType;
  pages: PdfPage[];
  fields: ExtractedField[];
  transactions: BankRow[];
  aisTransactions: AisTransaction[];
  warnings: string[];
  errorCode?: string;
  errorMessage?: string;
  cached?: boolean;
  usedAi?: boolean;
  usedOcr?: boolean;
  promptVersion?: string;
  extractorVersion?: string;
};

export const EXTRACTION_BUNDLE_VERSION = "form16-v1+ais-v1";
export const PROMPT_VERSION = { FORM_16: "form16-v1", AIS: "ais-v1" } as const;

export function displayExtractionMethod(method: string) {
  if (method === "AI") return "AI";
  if (method === "OCR") return "OCR";
  return "DETERMINISTIC";
}

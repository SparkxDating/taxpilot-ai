import { classifyDocument } from "./classify";
import { extractAis, extractTis } from "./extractors/ais";
import { extractBankText } from "./extractors/bank";
import { extractForm16 } from "./extractors/form16";
import { sniffMime } from "./magic";
import { extractText } from "./text";
import type { DocumentType, ExtractionResult } from "./types";

const PRIORITY: DocumentType[] = ["FORM_16", "AIS", "TIS", "BANK_STATEMENT"];

export function runExtraction(input: {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  declaredKind?: string;
}): ExtractionResult {
  const mime = sniffMime(input.bytes, input.fileName, input.mimeType);
  const text = extractText(input.bytes, mime, input.fileName);
  const kind = classifyDocument(input.fileName, text, input.declaredKind);

  if ((mime.startsWith("image/") || mime.includes("spreadsheet")) && !text) {
    return {
      kind,
      fields: [],
      transactions: [],
      errorCode: PRIORITY.includes(kind) ? "MANUAL_REVIEW_REQUIRED" : "PLACEHOLDER",
      errorMessage: mime.startsWith("image/")
        ? "Image OCR is not configured. Enter values manually."
        : "XLSX parsing is not enabled. Upload CSV.",
    };
  }

  if (kind === "FORM_16") return { kind, fields: extractForm16(text), transactions: [] };
  if (kind === "AIS") return { kind, fields: extractAis(text), transactions: [] };
  if (kind === "TIS") return { kind, fields: extractTis(text), transactions: [] };
  if (kind === "BANK_STATEMENT") return { kind, fields: [], transactions: extractBankText(text) };

  return {
    kind,
    fields: [],
    transactions: [],
    errorCode: "PLACEHOLDER",
    errorMessage: `Extractor for ${kind} is not implemented. Use manual entry.`,
  };
}

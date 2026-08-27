import { getOcrProvider } from "@/lib/providers/ocr";
import { classifyDocument } from "./classify";
import { extractAis, extractTis } from "./extractors/ais";
import { extractBankCsv, extractBankXlsx } from "./extractors/bank";
import { extractForm16, form16Reconciliation } from "./extractors/form16";
import { sniffMime } from "./magic";
import { extractPages } from "./text";
import type { DocumentType, ExtractionResult } from "./types";

const PRIORITY: DocumentType[] = ["FORM_16", "AIS", "TIS", "BANK_STATEMENT"];

export async function runExtraction(input: {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  declaredKind?: string;
}): Promise<ExtractionResult> {
  const mime = sniffMime(input.bytes, input.fileName, input.mimeType);
  const pages = await extractPages(input.bytes, mime, input.fileName);
  const text = pages.map((p) => p.text).join(" ");
  const kind = classifyDocument(input.fileName, text, input.declaredKind);

  if (mime.startsWith("image/") && !text) {
    const ocr = getOcrProvider();
    if (!ocr.configured) {
      return {
        kind,
        pages,
        fields: [],
        transactions: [],
        warnings: [],
        errorCode: "MANUAL_REVIEW_REQUIRED",
        errorMessage: "Image OCR is not configured. Enter values manually.",
      };
    }
    const candidates = await ocr.extract({ fileName: input.fileName, mimeType: mime, bytes: input.bytes });
    if (!candidates.length) {
      return {
        kind,
        pages,
        fields: [],
        transactions: [],
        warnings: [],
        errorCode: "MANUAL_REVIEW_REQUIRED",
        errorMessage: "OCR returned no text. Enter values manually.",
      };
    }
    return {
      kind,
      pages,
      fields: [],
      transactions: [],
      warnings: [],
      errorCode: "MANUAL_REVIEW_REQUIRED",
      errorMessage: "OCR candidates require manual review. Values are not auto-applied.",
    };
  }

  if (mime === "application/pdf" && pages.every((p) => !p.text)) {
    return {
      kind,
      pages,
      fields: [],
      transactions: [],
      warnings: [],
      errorCode: "MANUAL_REVIEW_REQUIRED",
      errorMessage: "PDF text could not be extracted. OCR is not configured for scanned pages.",
    };
  }

  if (kind === "FORM_16") {
    const fields = extractForm16(pages);
    const warning = form16Reconciliation(fields);
    return { kind, pages, fields, transactions: [], warnings: warning ? [warning] : [] };
  }
  if (kind === "AIS") return { kind, pages, fields: extractAis(pages), transactions: [], warnings: [] };
  if (kind === "TIS") return { kind, pages, fields: extractTis(pages), transactions: [], warnings: [] };
  if (kind === "BANK_STATEMENT") {
    if (mime.includes("spreadsheet") || /\.xlsx$/i.test(input.fileName)) {
      const transactions = await extractBankXlsx(input.bytes);
      return { kind, pages, fields: [], transactions, warnings: [] };
    }
    return { kind, pages, fields: [], transactions: extractBankCsv(text), warnings: [] };
  }

  return {
    kind,
    pages,
    fields: [],
    transactions: [],
    warnings: [],
    errorCode: PRIORITY.includes(kind) ? "MANUAL_REVIEW_REQUIRED" : "PLACEHOLDER",
    errorMessage: `Extractor for ${kind} is not implemented. Use manual entry.`,
  };
}

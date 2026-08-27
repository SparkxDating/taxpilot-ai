import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getDocumentAIProvider } from "@/lib/providers/documentAi";
import { getOcrProvider } from "@/lib/providers/ocr";
import { rebuildDocumentConflicts } from "./conflicts";
import { extractionConfigKey, shouldReuseExtraction } from "./fallback";
import { runExtraction } from "./pipeline";
import { pageRef } from "./rupees";
import { normalizedTaxField } from "./mapping";
import { EXTRACTION_BUNDLE_VERSION, HIGH, type DocumentType, type ExtractedField, type ExtractionResult } from "./types";

export function documentSha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fieldsFromRows(rows: Array<{ fieldKey: string; extractedValue: string; numericValue: number | null; confidence: number; pageRef: string; sourceText: string; extractionMethod: string }>, kind: string): ExtractedField[] {
  const documentType = (kind as DocumentType) || "OTHER";
  return rows
    .filter((r) => !r.fieldKey.startsWith("txn."))
    .map((r) => ({
      field: r.fieldKey,
      normalizedTaxField: normalizedTaxField(documentType, r.fieldKey),
      documentType,
      value: r.extractedValue,
      numericValue: r.numericValue,
      confidence: r.confidence,
      sourcePage: r.pageRef ? Number(r.pageRef) : null,
      sourceText: r.sourceText,
      extractionMethod: (r.extractionMethod as ExtractedField["extractionMethod"]) || "DETERMINISTIC",
    }));
}

async function writeResult(opts: {
  documentId: string;
  returnId: string;
  userId: string;
  result: ExtractionResult;
  cached: boolean;
  config: string;
}) {
  await prisma.documentExtraction.deleteMany({ where: { documentId: opts.documentId } });
  await prisma.taxFact.deleteMany({ where: { sourceDocumentId: opts.documentId } });
  await prisma.bankTransaction.deleteMany({ where: { documentId: opts.documentId } });

  for (const f of opts.result.fields) {
    if (f.value == null) continue;
    await prisma.documentExtraction.create({
      data: {
        documentId: opts.documentId,
        fieldKey: f.field,
        extractedValue: f.value,
        originalValue: f.value,
        numericValue: f.numericValue ?? undefined,
        confidence: f.confidence,
        pageRef: pageRef(f.sourcePage),
        sourceText: f.sourceText.slice(0, 500),
        extractionMethod: f.extractionMethod,
        status: f.confidence >= HIGH ? "EXTRACTED" : "NEEDS_REVIEW",
      },
    });
    if (!f.normalizedTaxField) continue;
    await prisma.taxFact.create({
      data: {
        returnId: opts.returnId,
        sourceDocumentId: opts.documentId,
        documentType: f.documentType,
        field: f.field,
        normalizedTaxField: f.normalizedTaxField,
        value: f.value,
        numericValue: f.numericValue ?? undefined,
        confidence: f.confidence,
        sourcePage: pageRef(f.sourcePage),
        sourceText: f.sourceText.slice(0, 500),
        originalValue: f.value,
        status: "AI_EXTRACTED",
        verified: false,
      },
    });
  }

  for (const [i, tx] of (opts.result.aisTransactions || []).entries()) {
    if (tx.amount == null) continue;
    await prisma.documentExtraction.create({
      data: {
        documentId: opts.documentId,
        fieldKey: `txn.${i}`,
        extractedValue: String(tx.amount),
        originalValue: String(tx.amount),
        numericValue: tx.amount,
        confidence: 0.7,
        pageRef: pageRef(tx.sourcePage),
        sourceText: `${tx.date} ${tx.originalCategory} ${tx.sourceText}`.slice(0, 500),
        extractionMethod: "DETERMINISTIC",
        status: "NEEDS_REVIEW",
      },
    });
  }

  if (opts.returnId) {
    for (const tx of opts.result.transactions) {
      await prisma.bankTransaction.create({
        data: {
          documentId: opts.documentId,
          returnId: opts.returnId,
          date: tx.date,
          description: tx.description,
          debit: tx.debit,
          credit: tx.credit,
          balance: tx.balance,
          reference: tx.reference,
          sourcePage: pageRef(tx.sourcePage),
          category: tx.suggestedCategory,
          rawCategory: tx.rawCategory,
          suggestedCategory: tx.suggestedCategory,
          verifiedCategory: tx.verifiedCategory || "",
          verified: false,
        },
      });
    }
  }

  await rebuildDocumentConflicts(opts.returnId);
  const warningCode = opts.result.warnings[0] || "";
  const needsReview =
    Boolean(opts.result.errorCode) ||
    Boolean(warningCode) ||
    opts.result.fields.some((f) => f.value && f.confidence < HIGH) ||
    opts.result.fields.length === 0;
  await prisma.document.update({
    where: { id: opts.documentId },
    data: {
      kind: opts.result.kind,
      status: opts.result.errorCode === "EXTRACTION_FAILED" ? "FAILED" : needsReview ? "NEEDS_REVIEW" : "EXTRACTED",
      processedAt: new Date(),
      errorCode: opts.result.errorCode || warningCode,
      errorMessage: opts.result.errorMessage || (warningCode ? warningCode : ""),
      extractorVersion: EXTRACTION_BUNDLE_VERSION,
      extractionConfig: opts.config,
      promptVersion: opts.result.promptVersion || "",
      aiProvider: opts.result.usedAi ? getDocumentAIProvider().name : "",
      aiModel: opts.result.usedAi ? getDocumentAIProvider().model : "",
    },
  });
  await audit({
    userId: opts.userId,
    returnId: opts.returnId,
    action: opts.cached ? "EXTRACTION_CACHE_HIT" : "EXTRACTED",
    entity: "Document",
    entityId: opts.documentId,
    metadata: { kind: opts.result.kind, fields: opts.result.fields.length, warnings: opts.result.warnings.length, cached: opts.cached, usedAi: Boolean(opts.result.usedAi) },
  });
  return opts.result;
}

export async function persistExtraction(opts: {
  documentId: string;
  returnId: string;
  userId: string;
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  declaredKind?: string;
  force?: boolean;
}) {
  const config = extractionConfigKey(getOcrProvider().configured, getDocumentAIProvider().configured);
  const doc = await prisma.document.findUnique({
    where: { id: opts.documentId },
    include: { extractions: true },
  });
  if (
    doc &&
    shouldReuseExtraction({
      force: opts.force,
      storedVersion: doc.extractorVersion,
      storedConfig: doc.extractionConfig,
      currentVersion: EXTRACTION_BUNDLE_VERSION,
      currentConfig: config,
      hasSuccessfulResult: Boolean(doc.processedAt) && doc.extractions.length > 0,
    })
  ) {
    return {
      kind: doc.kind as ExtractionResult["kind"],
      pages: [],
      fields: fieldsFromRows(doc.extractions, doc.kind),
      transactions: [],
      aisTransactions: [],
      warnings: doc.errorCode ? [doc.errorCode] : [],
      errorCode: doc.errorCode || undefined,
      errorMessage: doc.errorMessage || undefined,
      cached: true,
      extractorVersion: doc.extractorVersion,
    } satisfies ExtractionResult;
  }

  const hash = doc?.sha256 || documentSha256(opts.bytes);
  if (!opts.force && hash) {
    const twin = await prisma.document.findFirst({
      where: {
        userId: opts.userId,
        sha256: hash,
        extractorVersion: EXTRACTION_BUNDLE_VERSION,
        extractionConfig: config,
        processedAt: { not: null },
        NOT: { id: opts.documentId },
      },
      include: { extractions: true },
    });
    if (twin?.extractions.length) {
      const cloned: ExtractionResult = {
        kind: twin.kind as ExtractionResult["kind"],
        pages: [],
        fields: fieldsFromRows(twin.extractions, twin.kind).map((f) => ({
          ...f,
          normalizedTaxField: f.normalizedTaxField,
        })),
        transactions: [],
        aisTransactions: [],
        warnings: [],
        cached: true,
        extractorVersion: EXTRACTION_BUNDLE_VERSION,
      };
      return writeResult({ ...opts, result: cloned, cached: true, config });
    }
  }

  const result = await runExtraction({
    bytes: opts.bytes,
    fileName: opts.fileName,
    mimeType: opts.mimeType,
    declaredKind: opts.declaredKind,
  });
  return writeResult({ ...opts, result, cached: false, config });
}

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rebuildDocumentConflicts } from "./conflicts";
import { runExtraction } from "./pipeline";
import { pageRef } from "./rupees";
import { HIGH } from "./types";

export function documentSha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function persistExtraction(opts: {
  documentId: string;
  returnId: string;
  userId: string;
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  declaredKind?: string;
}) {
  const result = await runExtraction({
    bytes: opts.bytes,
    fileName: opts.fileName,
    mimeType: opts.mimeType,
    declaredKind: opts.declaredKind,
  });

  await prisma.documentExtraction.deleteMany({ where: { documentId: opts.documentId } });
  await prisma.taxFact.deleteMany({ where: { sourceDocumentId: opts.documentId } });
  await prisma.bankTransaction.deleteMany({ where: { documentId: opts.documentId } });

  for (const f of result.fields) {
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

  if (opts.returnId) {
    for (const tx of result.transactions) {
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

  const warningCode = result.warnings[0] || "";
  const needsReview =
    Boolean(result.errorCode) ||
    Boolean(warningCode) ||
    result.fields.some((f) => f.value && f.confidence < HIGH) ||
    result.fields.length === 0;
  await prisma.document.update({
    where: { id: opts.documentId },
    data: {
      kind: result.kind,
      status: result.errorCode === "EXTRACTION_FAILED" ? "FAILED" : needsReview ? "NEEDS_REVIEW" : "EXTRACTED",
      processedAt: new Date(),
      errorCode: result.errorCode || warningCode,
      errorMessage: result.errorMessage || (warningCode ? warningCode : ""),
    },
  });
  await audit({
    userId: opts.userId,
    returnId: opts.returnId,
    action: "EXTRACTED",
    entity: "Document",
    entityId: opts.documentId,
    metadata: { kind: result.kind, fields: result.fields.length, warnings: result.warnings.length },
  });
  return result;
}

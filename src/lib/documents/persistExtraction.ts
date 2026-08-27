import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { runExtraction } from "./pipeline";
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
  const result = runExtraction({
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
    const existing = await prisma.taxFact.findFirst({
      where: { returnId: opts.returnId, field: f.field, verified: true },
    });
    const conflict =
      existing && existing.numericValue != null && f.numericValue != null && existing.numericValue !== f.numericValue;
    await prisma.documentExtraction.create({
      data: {
        documentId: opts.documentId,
        fieldKey: f.field,
        extractedValue: f.value,
        originalValue: f.value,
        numericValue: f.numericValue ?? undefined,
        confidence: f.confidence,
        pageRef: f.sourcePage,
        sourceText: f.sourceText.slice(0, 500),
        extractionMethod: f.extractionMethod,
        status: conflict ? "NEEDS_REVIEW" : f.confidence >= HIGH ? "EXTRACTED" : "NEEDS_REVIEW",
      },
    });
    await prisma.taxFact.create({
      data: {
        returnId: opts.returnId,
        sourceDocumentId: opts.documentId,
        field: f.field,
        value: f.value,
        numericValue: f.numericValue ?? undefined,
        confidence: f.confidence,
        sourcePage: f.sourcePage,
        sourceText: f.sourceText.slice(0, 500),
        originalValue: f.value,
        status: conflict ? "CONFLICT" : "PENDING",
        conflictWithId: conflict ? existing!.id : "",
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
          sourcePage: tx.sourcePage,
          category: tx.category,
        },
      });
    }
  }

  const needsReview =
    result.errorCode === "MANUAL_REVIEW_REQUIRED" ||
    result.fields.some((f) => f.value && f.confidence < HIGH) ||
    result.fields.length === 0;
  await prisma.document.update({
    where: { id: opts.documentId },
    data: {
      kind: result.kind,
      status: result.errorCode === "EXTRACTION_FAILED" ? "FAILED" : needsReview ? "NEEDS_REVIEW" : "EXTRACTED",
      processedAt: new Date(),
      errorCode: result.errorCode || "",
      errorMessage: result.errorMessage || "",
    },
  });
  await audit({
    userId: opts.userId,
    returnId: opts.returnId,
    action: "EXTRACTED",
    entity: "Document",
    entityId: opts.documentId,
    metadata: { kind: result.kind, fields: result.fields.length },
  });
  return result;
}

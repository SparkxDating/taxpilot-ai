-- AlterTable
ALTER TABLE "Document" ADD COLUMN "sha256" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Document" ADD COLUMN "processedAt" DATETIME;
ALTER TABLE "Document" ADD COLUMN "errorCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Document" ADD COLUMN "errorMessage" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "DocumentExtraction" ADD COLUMN "originalValue" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DocumentExtraction" ADD COLUMN "editedValue" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DocumentExtraction" ADD COLUMN "editedBy" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DocumentExtraction" ADD COLUMN "editedAt" DATETIME;
ALTER TABLE "DocumentExtraction" ADD COLUMN "sourceText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DocumentExtraction" ADD COLUMN "extractionMethod" TEXT NOT NULL DEFAULT 'local';

-- CreateTable
CREATE TABLE "TaxFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "numericValue" INTEGER,
    "confidence" REAL NOT NULL,
    "sourcePage" TEXT NOT NULL DEFAULT '',
    "sourceText" TEXT NOT NULL DEFAULT '',
    "originalValue" TEXT NOT NULL DEFAULT '',
    "editedValue" TEXT NOT NULL DEFAULT '',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT NOT NULL DEFAULT '',
    "verifiedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "conflictWithId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxFact_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaxFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "date" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "debit" INTEGER NOT NULL DEFAULT 0,
    "credit" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "reference" TEXT NOT NULL DEFAULT '',
    "sourcePage" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "BankTransaction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BankTransaction_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Document_userId_sha256_idx" ON "Document"("userId", "sha256");
CREATE INDEX "TaxFact_returnId_field_idx" ON "TaxFact"("returnId", "field");
CREATE INDEX "BankTransaction_returnId_idx" ON "BankTransaction"("returnId");

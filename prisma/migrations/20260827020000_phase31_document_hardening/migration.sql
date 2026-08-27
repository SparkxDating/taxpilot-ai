-- AlterTable
ALTER TABLE "TaxFact" ADD COLUMN "documentType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TaxFact" ADD COLUMN "normalizedTaxField" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN "rawCategory" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "BankTransaction" ADD COLUMN "suggestedCategory" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "BankTransaction" ADD COLUMN "verifiedCategory" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "DocumentConflict" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "factsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT NOT NULL DEFAULT '',
    "resolvedValue" TEXT NOT NULL DEFAULT '',
    "resolvedBy" TEXT NOT NULL DEFAULT '',
    "resolvedAt" DATETIME,
    "reason" TEXT NOT NULL DEFAULT '',
    "chosenFactId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentConflict_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TaxFact_returnId_normalizedTaxField_idx" ON "TaxFact"("returnId", "normalizedTaxField");
CREATE INDEX "DocumentConflict_returnId_status_idx" ON "DocumentConflict"("returnId", "status");

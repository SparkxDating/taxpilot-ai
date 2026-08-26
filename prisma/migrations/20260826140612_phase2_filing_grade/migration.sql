-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'SB',
    "bankName" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "BankAccount_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BankAccount" ("accountNumber", "accountType", "id", "ifsc", "isPrimary", "returnId") SELECT "accountNumber", "accountType", "id", "ifsc", "isPrimary", "returnId" FROM "BankAccount";
DROP TABLE "BankAccount";
ALTER TABLE "new_BankAccount" RENAME TO "BankAccount";
CREATE TABLE "new_CapitalGain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '112A',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "assetType" TEXT NOT NULL DEFAULT '',
    "identifier" TEXT NOT NULL DEFAULT '',
    "acquisitionDate" DATETIME,
    "saleDate" DATETIME,
    "saleConsideration" INTEGER NOT NULL DEFAULT 0,
    "acquisitionCost" INTEGER NOT NULL DEFAULT 0,
    "improvementCost" INTEGER NOT NULL DEFAULT 0,
    "transferExpenses" INTEGER NOT NULL DEFAULT 0,
    "holdingPeriodDays" INTEGER NOT NULL DEFAULT 0,
    "specialRate" REAL,
    CONSTRAINT "CapitalGain_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CapitalGain" ("amount", "id", "kind", "returnId", "section") SELECT "amount", "id", "kind", "returnId", "section" FROM "CapitalGain";
DROP TABLE "CapitalGain";
ALTER TABLE "new_CapitalGain" RENAME TO "CapitalGain";
CREATE TABLE "new_Deduction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "eligibleAmount" INTEGER NOT NULL DEFAULT 0,
    "disallowedAmount" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Deduction_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Deduction" ("amount", "id", "notes", "returnId", "section") SELECT "amount", "id", "notes", "returnId", "section" FROM "Deduction";
DROP TABLE "Deduction";
ALTER TABLE "new_Deduction" RENAME TO "Deduction";
CREATE INDEX "Deduction_returnId_section_idx" ON "Deduction"("returnId", "section");
CREATE TABLE "new_DocumentExtraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "extractedValue" TEXT NOT NULL,
    "numericValue" INTEGER,
    "confidence" REAL NOT NULL,
    "pageRef" TEXT NOT NULL DEFAULT '',
    "sourceLocation" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" DATETIME,
    "extractedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DocumentExtraction" ("confidence", "documentId", "extractedAt", "extractedValue", "fieldKey", "id", "numericValue", "pageRef", "status") SELECT "confidence", "documentId", "extractedAt", "extractedValue", "fieldKey", "id", "numericValue", "pageRef", "status" FROM "DocumentExtraction";
DROP TABLE "DocumentExtraction";
ALTER TABLE "new_DocumentExtraction" RENAME TO "DocumentExtraction";
CREATE INDEX "DocumentExtraction_documentId_fieldKey_idx" ON "DocumentExtraction"("documentId", "fieldKey");
CREATE TABLE "new_ITRJsonFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "assessmentYear" TEXT NOT NULL,
    "itrType" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileHash" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "valid" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'CURRENT',
    "versionId" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ITRJsonFile_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ITRJsonFile" ("assessmentYear", "fileHash", "generatedAt", "id", "itrType", "returnId", "schemaVersion", "storagePath", "valid") SELECT "assessmentYear", "fileHash", "generatedAt", "id", "itrType", "returnId", "schemaVersion", "storagePath", "valid" FROM "ITRJsonFile";
DROP TABLE "ITRJsonFile";
ALTER TABLE "new_ITRJsonFile" RENAME TO "ITRJsonFile";
CREATE INDEX "ITRJsonFile_returnId_status_idx" ON "ITRJsonFile"("returnId", "status");
CREATE TABLE "new_TDSEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '26AS',
    "sectionCode" TEXT NOT NULL DEFAULT '',
    "tan" TEXT NOT NULL DEFAULT '',
    "deductorName" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "grossAmount" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'TDS',
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    CONSTRAINT "TDSEntry_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TDSEntry" ("amount", "deductorName", "id", "returnId", "sectionCode", "source", "tan") SELECT "amount", "deductorName", "id", "returnId", "sectionCode", "source", "tan" FROM "TDSEntry";
DROP TABLE "TDSEntry";
ALTER TABLE "new_TDSEntry" RENAME TO "TDSEntry";
CREATE TABLE "new_TaxReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assessmentYear" TEXT NOT NULL,
    "itrType" TEXT NOT NULL DEFAULT 'UNDETERMINED',
    "taxpayerType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "taxRegime" TEXT NOT NULL DEFAULT 'NEW',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "completionPercentage" INTEGER NOT NULL DEFAULT 0,
    "estimatedTax" INTEGER NOT NULL DEFAULT 0,
    "estimatedRefund" INTEGER NOT NULL DEFAULT 0,
    "incomeSourcesJson" TEXT NOT NULL DEFAULT '[]',
    "eligibilityJson" TEXT NOT NULL DEFAULT '{}',
    "calculationJson" TEXT NOT NULL DEFAULT '{}',
    "form10IeaAck" TEXT NOT NULL DEFAULT '',
    "form10IeaDate" DATETIME,
    "verificationPlace" TEXT NOT NULL DEFAULT '',
    "dataFingerprint" TEXT NOT NULL DEFAULT '',
    "schemaVersion" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxReturn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TaxReturn" ("assessmentYear", "calculationJson", "completionPercentage", "createdAt", "eligibilityJson", "estimatedRefund", "estimatedTax", "form10IeaAck", "form10IeaDate", "id", "incomeSourcesJson", "itrType", "status", "taxRegime", "taxpayerType", "updatedAt", "userId") SELECT "assessmentYear", "calculationJson", "completionPercentage", "createdAt", "eligibilityJson", "estimatedRefund", "estimatedTax", "form10IeaAck", "form10IeaDate", "id", "incomeSourcesJson", "itrType", "status", "taxRegime", "taxpayerType", "updatedAt", "userId" FROM "TaxReturn";
DROP TABLE "TaxReturn";
ALTER TABLE "new_TaxReturn" RENAME TO "TaxReturn";
CREATE INDEX "TaxReturn_userId_assessmentYear_idx" ON "TaxReturn"("userId", "assessmentYear");
CREATE INDEX "TaxReturn_status_idx" ON "TaxReturn"("status");
CREATE INDEX "TaxReturn_itrType_idx" ON "TaxReturn"("itrType");
CREATE TABLE "new_ValidationError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "level" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL DEFAULT '',
    "href" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationError_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ValidationError" ("createdAt", "field", "href", "id", "level", "message", "returnId", "section", "severity", "suggestion") SELECT "createdAt", "field", "href", "id", "level", "message", "returnId", "section", "severity", "suggestion" FROM "ValidationError";
DROP TABLE "ValidationError";
ALTER TABLE "new_ValidationError" RENAME TO "ValidationError";
CREATE INDEX "ValidationError_returnId_severity_idx" ON "ValidationError"("returnId", "severity");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

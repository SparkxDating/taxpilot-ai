-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pan" TEXT NOT NULL DEFAULT '',
    "aadhaarLast4" TEXT NOT NULL DEFAULT '',
    "dateOfBirth" DATETIME,
    "gender" TEXT NOT NULL DEFAULT '',
    "fatherName" TEXT NOT NULL DEFAULT '',
    "residentialStatus" TEXT NOT NULL DEFAULT 'RESIDENT',
    "phone" TEXT NOT NULL DEFAULT '',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "pincode" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '91',
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxReturn" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxReturn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReturnVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReturnVersion_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "returnId" TEXT,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentExtraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "extractedValue" TEXT NOT NULL,
    "numericValue" INTEGER,
    "confidence" REAL NOT NULL,
    "pageRef" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "extractedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncomeSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "IncomeSource_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalaryIncome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "employerName" TEXT NOT NULL DEFAULT '',
    "employerTan" TEXT NOT NULL DEFAULT '',
    "grossSalary" INTEGER NOT NULL DEFAULT 0,
    "exemptions" INTEGER NOT NULL DEFAULT 0,
    "standardDeduction" INTEGER NOT NULL DEFAULT 0,
    "tds" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SalaryIncome_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessIncome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '44AD',
    "nature" TEXT NOT NULL DEFAULT '',
    "turnover" INTEGER NOT NULL DEFAULT 0,
    "digitalReceipts" INTEGER NOT NULL DEFAULT 0,
    "cashReceipts" INTEGER NOT NULL DEFAULT 0,
    "presumptiveIncome" INTEGER NOT NULL DEFAULT 0,
    "declaredIncome" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BusinessIncome_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfessionalIncome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '44ADA',
    "profession" TEXT NOT NULL DEFAULT '',
    "grossReceipts" INTEGER NOT NULL DEFAULT 0,
    "cashReceipts" INTEGER NOT NULL DEFAULT 0,
    "presumptiveIncome" INTEGER NOT NULL DEFAULT 0,
    "declaredIncome" INTEGER NOT NULL DEFAULT 0,
    "personalNotCompany" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ProfessionalIncome_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CapitalGain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '112A',
    "amount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CapitalGain_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HouseProperty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "occupancy" TEXT NOT NULL DEFAULT 'SELF_OCCUPIED',
    "annualLetableValue" INTEGER NOT NULL DEFAULT 0,
    "municipalTaxes" INTEGER NOT NULL DEFAULT 0,
    "interestOnLoan" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "HouseProperty_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OtherIncome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "OtherIncome_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deduction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Deduction_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TDSEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '26AS',
    "sectionCode" TEXT NOT NULL DEFAULT '',
    "tan" TEXT NOT NULL DEFAULT '',
    "deductorName" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TDSEntry_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "bsrCode" TEXT NOT NULL DEFAULT '',
    "challanNo" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "paidOn" DATETIME,
    CONSTRAINT "TaxPayment_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'SAVINGS',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "BankAccount_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfitLoss" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "otherIncome" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "employeeCost" INTEGER NOT NULL DEFAULT 0,
    "depreciation" INTEGER NOT NULL DEFAULT 0,
    "otherExpenses" INTEGER NOT NULL DEFAULT 0,
    "netProfit" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProfitLoss_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BalanceSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "capital" INTEGER NOT NULL DEFAULT 0,
    "securedLoans" INTEGER NOT NULL DEFAULT 0,
    "unsecuredLoans" INTEGER NOT NULL DEFAULT 0,
    "currentLiabilities" INTEGER NOT NULL DEFAULT 0,
    "fixedAssets" INTEGER NOT NULL DEFAULT 0,
    "inventories" INTEGER NOT NULL DEFAULT 0,
    "sundryDebtors" INTEGER NOT NULL DEFAULT 0,
    "cashBank" INTEGER NOT NULL DEFAULT 0,
    "loansAdvances" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BalanceSheet_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "helpText" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'CHOICE',
    "optionsJson" TEXT NOT NULL DEFAULT '[]',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "Question_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Answer_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "ITRJsonFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "assessmentYear" TEXT NOT NULL,
    "itrType" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileHash" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "valid" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ITRJsonFile_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "returnId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL DEFAULT '',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "provider" TEXT NOT NULL DEFAULT 'NONE',
    "currentPeriodEnd" DATETIME,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "TaxReturn_userId_assessmentYear_idx" ON "TaxReturn"("userId", "assessmentYear");

-- CreateIndex
CREATE INDEX "TaxReturn_status_idx" ON "TaxReturn"("status");

-- CreateIndex
CREATE INDEX "TaxReturn_itrType_idx" ON "TaxReturn"("itrType");

-- CreateIndex
CREATE INDEX "ReturnVersion_returnId_createdAt_idx" ON "ReturnVersion"("returnId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_userId_returnId_idx" ON "Document"("userId", "returnId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "DocumentExtraction_documentId_fieldKey_idx" ON "DocumentExtraction"("documentId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeSource_returnId_kind_key" ON "IncomeSource"("returnId", "kind");

-- CreateIndex
CREATE INDEX "Deduction_returnId_section_idx" ON "Deduction"("returnId", "section");

-- CreateIndex
CREATE UNIQUE INDEX "ProfitLoss_returnId_key" ON "ProfitLoss"("returnId");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceSheet_returnId_key" ON "BalanceSheet"("returnId");

-- CreateIndex
CREATE INDEX "Question_returnId_status_idx" ON "Question"("returnId", "status");

-- CreateIndex
CREATE INDEX "ValidationError_returnId_severity_idx" ON "ValidationError"("returnId", "severity");

-- CreateIndex
CREATE INDEX "ITRJsonFile_returnId_idx" ON "ITRJsonFile"("returnId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_returnId_idx" ON "AuditLog"("returnId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");

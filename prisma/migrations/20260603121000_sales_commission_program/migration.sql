-- CreateEnum
CREATE TYPE "SalesCommissionPeriodStatus" AS ENUM ('DRAFT', 'REVIEWED', 'LOCKED', 'PAID');

-- CreateEnum
CREATE TYPE "SalesCommissionInvoiceStatus" AS ENUM ('OPEN', 'HOLD', 'FIRST_PAID', 'SECOND_PAID', 'CLOSED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "SalesCommissionDebtType" AS ENUM ('DEBT_ADDED', 'DEBT_DEDUCTED', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SalesCommissionAuditEntity" AS ENUM ('INVOICE', 'PERIOD', 'SETTINGS', 'SALES_REP', 'DEBT', 'BONUS');

-- CreateTable
CREATE TABLE "SalesCommissionSettings" (
    "id" TEXT NOT NULL,
    "firstCommissionPercent" DECIMAL(6,3) NOT NULL DEFAULT 60,
    "secondCommissionPercent" DECIMAL(6,3) NOT NULL DEFAULT 40,
    "minimumWeeklyPay" DECIMAL(12,2) NOT NULL DEFAULT 560,
    "monthlyBonusSalesTarget" DECIMAL(12,2) NOT NULL DEFAULT 200000,
    "monthlyBonusAmount" DECIMAL(12,2) NOT NULL DEFAULT 2500,
    "payWeekStartDay" INTEGER NOT NULL DEFAULT 5,
    "payWeekEndDay" INTEGER NOT NULL DEFAULT 4,
    "checkDateRule" TEXT NOT NULL DEFAULT 'SECOND_MONDAY_AFTER_PERIOD_END',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCommissionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesCommissionSalesRep" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "quickbooksInitials" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultCommissionRate" DECIMAL(6,3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCommissionSalesRep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesCommissionNoteOption" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCommissionNoteOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesCommissionPeriod" (
    "id" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "checkDate" DATE NOT NULL,
    "status" "SalesCommissionPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "paidByUserId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCommissionPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesCommissionInvoice" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "quickbooksInvoiceId" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" DATE,
    "customerName" TEXT NOT NULL,
    "salesRepId" TEXT,
    "salesRepDisplay" TEXT,
    "salesRepInitialsRaw" TEXT,
    "salesRepUnmatched" BOOLEAN NOT NULL DEFAULT false,
    "commissionRate" DECIMAL(8,4),
    "invoiceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quickbooksBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "thirdPartyAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCommissionCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCommissionOverride" DECIMAL(12,2),
    "firstCommissionCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "firstCommissionOverride" DECIMAL(12,2),
    "firstPaymentNowCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "firstPaymentNowOverride" DECIMAL(12,2),
    "secondCommissionCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "secondCommissionOverride" DECIMAL(12,2),
    "adjustedSecondCommissionCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "secondPaymentNowCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "secondPaymentNowOverride" DECIMAL(12,2),
    "depositPaidDate" DATE,
    "fullyPaidDate" DATE,
    "notesOptionLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notesFreeText" TEXT,
    "status" "SalesCommissionInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "manualOverrideFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importFlags" JSONB,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCommissionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesCommissionDebtLedger" (
    "id" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "periodId" TEXT,
    "type" "SalesCommissionDebtType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "previousBalance" DECIMAL(12,2) NOT NULL,
    "newBalance" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesCommissionDebtLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesCommissionBonusLedger" (
    "id" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "periodId" TEXT,
    "monthKey" TEXT NOT NULL,
    "thresholdIndex" INTEGER NOT NULL,
    "thresholdSalesAmount" DECIMAL(12,2) NOT NULL,
    "bonusAmount" DECIMAL(12,2) NOT NULL,
    "reachedByInvoiceDate" DATE,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesCommissionBonusLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesCommissionAuditLog" (
    "id" TEXT NOT NULL,
    "entityType" "SalesCommissionAuditEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "notes" TEXT,
    "changedByUserId" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesCommissionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesCommissionSalesRep_quickbooksInitials_key" ON "SalesCommissionSalesRep"("quickbooksInitials");

-- CreateIndex
CREATE INDEX "SalesCommissionSalesRep_active_idx" ON "SalesCommissionSalesRep"("active");

-- CreateIndex
CREATE INDEX "SalesCommissionSalesRep_displayName_idx" ON "SalesCommissionSalesRep"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "SalesCommissionNoteOption_label_key" ON "SalesCommissionNoteOption"("label");

-- CreateIndex
CREATE INDEX "SalesCommissionNoteOption_isActive_idx" ON "SalesCommissionNoteOption"("isActive");

-- CreateIndex
CREATE INDEX "SalesCommissionNoteOption_sortOrder_idx" ON "SalesCommissionNoteOption"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SalesCommissionPeriod_startDate_endDate_key" ON "SalesCommissionPeriod"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "SalesCommissionPeriod_status_idx" ON "SalesCommissionPeriod"("status");

-- CreateIndex
CREATE INDEX "SalesCommissionPeriod_checkDate_idx" ON "SalesCommissionPeriod"("checkDate");

-- CreateIndex
CREATE INDEX "SalesCommissionInvoice_periodId_idx" ON "SalesCommissionInvoice"("periodId");

-- CreateIndex
CREATE INDEX "SalesCommissionInvoice_invoiceNumber_idx" ON "SalesCommissionInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "SalesCommissionInvoice_customerName_idx" ON "SalesCommissionInvoice"("customerName");

-- CreateIndex
CREATE INDEX "SalesCommissionInvoice_status_idx" ON "SalesCommissionInvoice"("status");

-- CreateIndex
CREATE INDEX "SalesCommissionInvoice_salesRepDisplay_idx" ON "SalesCommissionInvoice"("salesRepDisplay");

-- CreateIndex
CREATE INDEX "SalesCommissionInvoice_invoiceDate_idx" ON "SalesCommissionInvoice"("invoiceDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalesCommissionInvoice_periodId_invoiceNumber_key" ON "SalesCommissionInvoice"("periodId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "SalesCommissionDebtLedger_salesRepId_idx" ON "SalesCommissionDebtLedger"("salesRepId");

-- CreateIndex
CREATE INDEX "SalesCommissionDebtLedger_periodId_idx" ON "SalesCommissionDebtLedger"("periodId");

-- CreateIndex
CREATE INDEX "SalesCommissionDebtLedger_createdAt_idx" ON "SalesCommissionDebtLedger"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesCommissionBonusLedger_salesRepId_monthKey_thresholdIndex_key" ON "SalesCommissionBonusLedger"("salesRepId", "monthKey", "thresholdIndex");

-- CreateIndex
CREATE INDEX "SalesCommissionBonusLedger_periodId_idx" ON "SalesCommissionBonusLedger"("periodId");

-- CreateIndex
CREATE INDEX "SalesCommissionBonusLedger_monthKey_idx" ON "SalesCommissionBonusLedger"("monthKey");

-- CreateIndex
CREATE INDEX "SalesCommissionAuditLog_entityType_entityId_idx" ON "SalesCommissionAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SalesCommissionAuditLog_changedAt_idx" ON "SalesCommissionAuditLog"("changedAt");

-- AddForeignKey
ALTER TABLE "SalesCommissionInvoice" ADD CONSTRAINT "SalesCommissionInvoice_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SalesCommissionPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesCommissionInvoice" ADD CONSTRAINT "SalesCommissionInvoice_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "SalesCommissionSalesRep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesCommissionDebtLedger" ADD CONSTRAINT "SalesCommissionDebtLedger_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "SalesCommissionSalesRep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesCommissionDebtLedger" ADD CONSTRAINT "SalesCommissionDebtLedger_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SalesCommissionPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesCommissionBonusLedger" ADD CONSTRAINT "SalesCommissionBonusLedger_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "SalesCommissionSalesRep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesCommissionBonusLedger" ADD CONSTRAINT "SalesCommissionBonusLedger_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SalesCommissionPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old Sales Commission tables
DROP TABLE IF EXISTS "SalesCommissionAuditLog";
DROP TABLE IF EXISTS "SalesCommissionBonusLedger";
DROP TABLE IF EXISTS "SalesCommissionDebtLedger";
DROP TABLE IF EXISTS "SalesCommissionInvoice";
DROP TABLE IF EXISTS "SalesCommissionWeeklyInvoiceActivity";
DROP TABLE IF EXISTS "SalesCommissionMasterInvoice";
DROP TABLE IF EXISTS "SalesCommissionPeriod";
DROP TABLE IF EXISTS "SalesCommissionNoteOption";
DROP TABLE IF EXISTS "SalesCommissionSalesRep";
DROP TABLE IF EXISTS "SalesCommissionSettings";

-- Drop old enums
DROP TYPE IF EXISTS "SalesCommissionPeriodStatus";
DROP TYPE IF EXISTS "SalesCommissionInvoiceStatus";
DROP TYPE IF EXISTS "SalesCommissionDebtType";
DROP TYPE IF EXISTS "SalesCommissionAuditEntity";

-- Create new enums
CREATE TYPE "CMSWeekStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED');
CREATE TYPE "CMSInvoiceStatus" AS ENUM ('PENDING', 'FIRST_PAYMENT', 'FIRST_PAID', 'SECOND_PAYMENT', 'BOTH_PAYMENTS', 'HOLD', 'HOLD_SIGNATURE');

-- CMSSettings
CREATE TABLE "CMSSettings" (
    "id" TEXT NOT NULL,
    "firstPaymentPercent" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "secondPaymentPercent" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "colorPending" TEXT NOT NULL DEFAULT '#FFFFFF',
    "colorFirstPayment" TEXT NOT NULL DEFAULT '#BFDBFE',
    "colorFirstPaid" TEXT NOT NULL DEFAULT '#F0F9FF',
    "colorClosing" TEXT NOT NULL DEFAULT '#BBF7D0',
    "colorHold" TEXT NOT NULL DEFAULT '#FEF08A',
    "colorHoldSignature" TEXT NOT NULL DEFAULT '#FBCFE8',
    "colorError" TEXT NOT NULL DEFAULT '#FECACA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CMSSettings_pkey" PRIMARY KEY ("id")
);

-- CMSWeek
CREATE TABLE "CMSWeek" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "checkDate" DATE NOT NULL,
    "status" "CMSWeekStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CMSWeek_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CMSWeek_status_idx" ON "CMSWeek"("status");
CREATE INDEX "CMSWeek_weekStart_idx" ON "CMSWeek"("weekStart");

-- CMSInvoice
CREATE TABLE "CMSInvoice" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "salesRep" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "calculatedCommission" DECIMAL(12,2) NOT NULL,
    "firstPaymentAmount" DECIMAL(12,2) NOT NULL,
    "secondPaymentAmount" DECIMAL(12,2) NOT NULL,
    "payFirst" BOOLEAN NOT NULL DEFAULT false,
    "paySecond" BOOLEAN NOT NULL DEFAULT false,
    "firstPaid" BOOLEAN NOT NULL DEFAULT false,
    "firstPaidDate" DATE,
    "secondPaid" BOOLEAN NOT NULL DEFAULT false,
    "secondPaidDate" DATE,
    "thirdPartyAmount" DECIMAL(12,2),
    "refundAmount" DECIMAL(12,2),
    "notes" TEXT,
    "isNew" BOOLEAN NOT NULL DEFAULT true,
    "status" "CMSInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "originalInvoiceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CMSInvoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CMSInvoice_weekId_idx" ON "CMSInvoice"("weekId");
CREATE INDEX "CMSInvoice_salesRep_idx" ON "CMSInvoice"("salesRep");
CREATE INDEX "CMSInvoice_invoiceNumber_idx" ON "CMSInvoice"("invoiceNumber");
CREATE INDEX "CMSInvoice_status_idx" ON "CMSInvoice"("status");

ALTER TABLE "CMSInvoice" ADD CONSTRAINT "CMSInvoice_weekId_fkey"
    FOREIGN KEY ("weekId") REFERENCES "CMSWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CMSClosedInvoice
CREATE TABLE "CMSClosedInvoice" (
    "id" TEXT NOT NULL,
    "salesRep" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "calculatedCommission" DECIMAL(12,2) NOT NULL,
    "firstPaymentAmount" DECIMAL(12,2) NOT NULL,
    "secondPaymentAmount" DECIMAL(12,2) NOT NULL,
    "thirdPartyAmount" DECIMAL(12,2),
    "refundAmount" DECIMAL(12,2),
    "firstPaidDate" DATE,
    "secondPaidDate" DATE,
    "notes" TEXT,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "checkDate" DATE NOT NULL,
    "originalInvoiceId" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CMSClosedInvoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CMSClosedInvoice_salesRep_idx" ON "CMSClosedInvoice"("salesRep");
CREATE INDEX "CMSClosedInvoice_invoiceNumber_idx" ON "CMSClosedInvoice"("invoiceNumber");
CREATE INDEX "CMSClosedInvoice_weekStart_idx" ON "CMSClosedInvoice"("weekStart");

-- Refactor sales commission to support master invoices + weekly activity snapshots.
-- Keeps existing period/invoice tables for backward compatibility while introducing new normalized entities.

-- 1) Replace period status enum values to match Draft/Reviewed/Finalized/Reopened workflow.
ALTER TYPE "SalesCommissionPeriodStatus" RENAME TO "SalesCommissionPeriodStatus_old";

CREATE TYPE "SalesCommissionPeriodStatus" AS ENUM ('DRAFT', 'REVIEWED', 'FINALIZED', 'REOPENED');

ALTER TABLE "SalesCommissionPeriod"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SalesCommissionPeriodStatus"
  USING (
    CASE
      WHEN "status"::text IN ('LOCKED', 'PAID') THEN 'FINALIZED'
      WHEN "status"::text = 'REVIEWED' THEN 'REVIEWED'
      WHEN "status"::text = 'DRAFT' THEN 'DRAFT'
      ELSE 'DRAFT'
    END
  )::"SalesCommissionPeriodStatus",
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "SalesCommissionPeriodStatus_old";

-- 2) Extend periods as saved weekly commissions metadata.
ALTER TABLE "SalesCommissionPeriod"
  ADD COLUMN "salesRepScope" TEXT NOT NULL DEFAULT 'ALL',
  ADD COLUMN "totalFirstPayments" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalSecondPayments" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalDebtAdded" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalDebtDeducted" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalBonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalFinalPayroll" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "finalizedByUserId" TEXT,
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "reopenedByUserId" TEXT,
  ADD COLUMN "reopenedAt" TIMESTAMP(3),
  ADD COLUMN "reopenReason" TEXT;

UPDATE "SalesCommissionPeriod"
SET
  "finalizedByUserId" = COALESCE("paidByUserId", "lockedByUserId"),
  "finalizedAt" = COALESCE("paidAt", "lockedAt")
WHERE "finalizedByUserId" IS NULL;

ALTER TABLE "SalesCommissionPeriod"
  DROP COLUMN "lockedByUserId",
  DROP COLUMN "lockedAt",
  DROP COLUMN "paidByUserId",
  DROP COLUMN "paidAt";

-- 3) Create master invoice table.
CREATE TABLE "SalesCommissionMasterInvoice" (
  "id" TEXT NOT NULL,
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
  "thirdPartyAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "refundAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalCommissionCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "firstCommissionCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "secondCommissionCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "adjustedSecondCommissionCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "firstCommissionPaid" BOOLEAN NOT NULL DEFAULT false,
  "secondCommissionPaid" BOOLEAN NOT NULL DEFAULT false,
  "firstCommissionPaidAt" TIMESTAMP(3),
  "secondCommissionPaidAt" TIMESTAMP(3),
  "notesOptionLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "notesFreeText" TEXT,
  "status" "SalesCommissionInvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "isClosed" BOOLEAN NOT NULL DEFAULT false,
  "closedAt" TIMESTAMP(3),
  "manualEditedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "importFlags" JSONB,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesCommissionMasterInvoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesCommissionMasterInvoice_invoiceNumber_idx" ON "SalesCommissionMasterInvoice"("invoiceNumber");
CREATE INDEX "SalesCommissionMasterInvoice_customerName_idx" ON "SalesCommissionMasterInvoice"("customerName");
CREATE INDEX "SalesCommissionMasterInvoice_status_idx" ON "SalesCommissionMasterInvoice"("status");
CREATE INDEX "SalesCommissionMasterInvoice_salesRepDisplay_idx" ON "SalesCommissionMasterInvoice"("salesRepDisplay");
CREATE INDEX "SalesCommissionMasterInvoice_invoiceDate_idx" ON "SalesCommissionMasterInvoice"("invoiceDate");
CREATE INDEX "SalesCommissionMasterInvoice_isClosed_idx" ON "SalesCommissionMasterInvoice"("isClosed");

ALTER TABLE "SalesCommissionMasterInvoice"
  ADD CONSTRAINT "SalesCommissionMasterInvoice_salesRepId_fkey"
  FOREIGN KEY ("salesRepId") REFERENCES "SalesCommissionSalesRep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Create weekly activity table.
CREATE TABLE "SalesCommissionWeeklyInvoiceActivity" (
  "id" TEXT NOT NULL,
  "weeklyCommissionId" TEXT NOT NULL,
  "masterInvoiceId" TEXT NOT NULL,
  "firstPaymentThisWeek" DECIMAL(12,2),
  "secondPaymentThisWeek" DECIMAL(12,2),
  "refundAppliedThisWeek" DECIMAL(12,2),
  "thirdPartyAppliedThisWeek" DECIMAL(12,2),
  "notesOptionLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "notesFreeText" TEXT,
  "addedManually" BOOLEAN NOT NULL DEFAULT false,
  "removedFromDraft" BOOLEAN NOT NULL DEFAULT false,
  "manualCorrections" JSONB,
  "status" "SalesCommissionInvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesCommissionWeeklyInvoiceActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesCommissionWeeklyInvoiceActivity_weeklyCommissionId_masterInvoiceId_key"
ON "SalesCommissionWeeklyInvoiceActivity"("weeklyCommissionId", "masterInvoiceId");

CREATE INDEX "SalesCommissionWeeklyInvoiceActivity_weeklyCommissionId_idx"
ON "SalesCommissionWeeklyInvoiceActivity"("weeklyCommissionId");

CREATE INDEX "SalesCommissionWeeklyInvoiceActivity_masterInvoiceId_idx"
ON "SalesCommissionWeeklyInvoiceActivity"("masterInvoiceId");

CREATE INDEX "SalesCommissionWeeklyInvoiceActivity_status_idx"
ON "SalesCommissionWeeklyInvoiceActivity"("status");

ALTER TABLE "SalesCommissionWeeklyInvoiceActivity"
  ADD CONSTRAINT "SalesCommissionWeeklyInvoiceActivity_weeklyCommissionId_fkey"
  FOREIGN KEY ("weeklyCommissionId") REFERENCES "SalesCommissionPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesCommissionWeeklyInvoiceActivity"
  ADD CONSTRAINT "SalesCommissionWeeklyInvoiceActivity_masterInvoiceId_fkey"
  FOREIGN KEY ("masterInvoiceId") REFERENCES "SalesCommissionMasterInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Backfill master invoices from existing period-bound invoices.
WITH latest_per_invoice AS (
  SELECT DISTINCT ON (COALESCE(NULLIF("invoiceNumber", ''), "id"))
    COALESCE(NULLIF("invoiceNumber", ''), "id") AS dedupe_key,
    "id",
    "quickbooksInvoiceId",
    "invoiceNumber",
    "invoiceDate",
    "customerName",
    "salesRepId",
    "salesRepDisplay",
    "salesRepInitialsRaw",
    "salesRepUnmatched",
    "commissionRate",
    "invoiceAmount",
    "thirdPartyAdjustment",
    "refundAdjustment",
    COALESCE("totalCommissionOverride", "totalCommissionCalculated") AS "totalCommissionCalculated",
    COALESCE("firstCommissionOverride", "firstCommissionCalculated") AS "firstCommissionCalculated",
    COALESCE("secondCommissionOverride", "secondCommissionCalculated") AS "secondCommissionCalculated",
    "adjustedSecondCommissionCalculated",
    "notesOptionLabels",
    "notesFreeText",
    "status",
    "closedAt",
    "manualOverrideFields",
    "importFlags",
    "createdByUserId",
    "updatedByUserId",
    "createdAt",
    "updatedAt"
  FROM "SalesCommissionInvoice"
  ORDER BY COALESCE(NULLIF("invoiceNumber", ''), "id"), "updatedAt" DESC
)
INSERT INTO "SalesCommissionMasterInvoice" (
  "id",
  "quickbooksInvoiceId",
  "invoiceNumber",
  "invoiceDate",
  "customerName",
  "salesRepId",
  "salesRepDisplay",
  "salesRepInitialsRaw",
  "salesRepUnmatched",
  "commissionRate",
  "invoiceAmount",
  "thirdPartyAdjustment",
  "refundAdjustment",
  "totalCommissionCalculated",
  "firstCommissionCalculated",
  "secondCommissionCalculated",
  "adjustedSecondCommissionCalculated",
  "firstCommissionPaid",
  "secondCommissionPaid",
  "notesOptionLabels",
  "notesFreeText",
  "status",
  "isClosed",
  "closedAt",
  "manualEditedFields",
  "importFlags",
  "createdByUserId",
  "updatedByUserId",
  "createdAt",
  "updatedAt"
)
SELECT
  l."id",
  l."quickbooksInvoiceId",
  l."invoiceNumber",
  l."invoiceDate",
  l."customerName",
  l."salesRepId",
  l."salesRepDisplay",
  l."salesRepInitialsRaw",
  l."salesRepUnmatched",
  l."commissionRate",
  l."invoiceAmount",
  l."thirdPartyAdjustment",
  l."refundAdjustment",
  l."totalCommissionCalculated",
  l."firstCommissionCalculated",
  l."secondCommissionCalculated",
  l."adjustedSecondCommissionCalculated",
  CASE WHEN l."status"::text IN ('FIRST_PAID', 'SECOND_PAID', 'CLOSED') THEN true ELSE false END,
  CASE WHEN l."status"::text IN ('SECOND_PAID', 'CLOSED') THEN true ELSE false END,
  l."notesOptionLabels",
  l."notesFreeText",
  l."status",
  CASE WHEN l."status"::text = 'CLOSED' THEN true ELSE false END,
  l."closedAt",
  l."manualOverrideFields",
  l."importFlags",
  l."createdByUserId",
  l."updatedByUserId",
  l."createdAt",
  l."updatedAt"
FROM latest_per_invoice l;

-- 6) Backfill weekly activities for historical weekly snapshots.
WITH invoice_to_master AS (
  SELECT
    i."id" AS invoice_id,
    m."id" AS master_id
  FROM "SalesCommissionInvoice" i
  JOIN "SalesCommissionMasterInvoice" m
    ON COALESCE(NULLIF(i."invoiceNumber", ''), i."id") = COALESCE(NULLIF(m."invoiceNumber", ''), m."id")
)
INSERT INTO "SalesCommissionWeeklyInvoiceActivity" (
  "id",
  "weeklyCommissionId",
  "masterInvoiceId",
  "firstPaymentThisWeek",
  "secondPaymentThisWeek",
  "refundAppliedThisWeek",
  "thirdPartyAppliedThisWeek",
  "notesOptionLabels",
  "notesFreeText",
  "addedManually",
  "removedFromDraft",
  "manualCorrections",
  "status",
  "createdByUserId",
  "updatedByUserId",
  "createdAt",
  "updatedAt"
)
SELECT
  i."id",
  i."periodId",
  map.master_id,
  NULLIF(COALESCE(i."firstPaymentNowOverride", i."firstPaymentNowCalculated"), 0),
  NULLIF(COALESCE(i."secondPaymentNowOverride", i."secondPaymentNowCalculated"), 0),
  NULLIF(i."refundAdjustment", 0),
  NULLIF(i."thirdPartyAdjustment", 0),
  i."notesOptionLabels",
  i."notesFreeText",
  false,
  false,
  CASE WHEN array_length(i."manualOverrideFields", 1) > 0 THEN jsonb_build_object('fields', i."manualOverrideFields") ELSE NULL END,
  i."status",
  i."createdByUserId",
  i."updatedByUserId",
  i."createdAt",
  i."updatedAt"
FROM "SalesCommissionInvoice" i
JOIN invoice_to_master map ON map.invoice_id = i."id"
ON CONFLICT ("weeklyCommissionId", "masterInvoiceId") DO NOTHING;

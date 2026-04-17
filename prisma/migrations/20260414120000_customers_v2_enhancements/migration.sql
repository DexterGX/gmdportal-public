-- Migration: customers_v2_enhancements
-- Adds referral tracking to Customer and rich job detail fields to Job

-- Customer: track which contractor/designer referred this client
ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "referredByOrgPipedriveId" TEXT,
  ADD COLUMN IF NOT EXISTS "referredByOrgName" TEXT;

-- Job: enrich with Pipedrive deal data
ALTER TABLE "Job"
  ADD COLUMN IF NOT EXISTS "jobType" TEXT,
  ADD COLUMN IF NOT EXISTS "companyCamUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "quickbooksUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "stageId" INTEGER,
  ADD COLUMN IF NOT EXISTS "closeDate" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "expectedCloseDate" DATE,
  ADD COLUMN IF NOT EXISTS "propertyAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "dealTitle" TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS "Customer_referredByOrgPipedriveId_idx" ON "Customer"("referredByOrgPipedriveId");
CREATE INDEX IF NOT EXISTS "Job_jobType_idx" ON "Job"("jobType");

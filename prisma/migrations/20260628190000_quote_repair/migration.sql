-- CreateQuoteRepair
CREATE TYPE "QuoteRepairStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'VOIDED', 'ARCHIVED');

CREATE TABLE "QuoteRepairSequence" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteRepairSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuoteRepairSequence_year_month_key" ON "QuoteRepairSequence"("year", "month");

CREATE TABLE "QuoteRepairService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteRepairService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuoteRepairService_name_key" ON "QuoteRepairService"("name");
CREATE INDEX "QuoteRepairService_active_idx" ON "QuoteRepairService"("active");
CREATE INDEX "QuoteRepairService_sortOrder_idx" ON "QuoteRepairService"("sortOrder");

CREATE TABLE "QuoteRepairSettings" (
    "id" TEXT NOT NULL,
    "authorizationText" TEXT NOT NULL DEFAULT 'I, ______________________________, authorize the charge amount of $____________ for the services described above.',
    "hoaPermitNote" TEXT NOT NULL DEFAULT 'HOA approval and permit are the customer''s responsibility when applicable.',
    "defaultCustomerTerms" TEXT,
    "footerText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteRepairSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteRepair" (
    "id" TEXT NOT NULL,
    "quoteRepairNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "propertyAddress" TEXT NOT NULL,
    "pipedrivePersonId" TEXT,
    "pipedriveDealId" TEXT,
    "pipedriveDealName" TEXT,
    "contractor" TEXT,
    "areas" JSONB NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "QuoteRepairStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "approvedVersionId" TEXT,
    "nextVersionNumber" INTEGER NOT NULL DEFAULT 2,
    "deletedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteRepair_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuoteRepair_quoteRepairNumber_key" ON "QuoteRepair"("quoteRepairNumber");
CREATE UNIQUE INDEX "QuoteRepair_currentVersionId_key" ON "QuoteRepair"("currentVersionId");
CREATE UNIQUE INDEX "QuoteRepair_approvedVersionId_key" ON "QuoteRepair"("approvedVersionId");
CREATE INDEX "QuoteRepair_salesRepId_idx" ON "QuoteRepair"("salesRepId");
CREATE INDEX "QuoteRepair_createdById_idx" ON "QuoteRepair"("createdById");
CREATE INDEX "QuoteRepair_status_idx" ON "QuoteRepair"("status");
CREATE INDEX "QuoteRepair_createdAt_idx" ON "QuoteRepair"("createdAt");
CREATE INDEX "QuoteRepair_updatedAt_idx" ON "QuoteRepair"("updatedAt");

CREATE TABLE "QuoteRepairVersion" (
    "id" TEXT NOT NULL,
    "quoteRepairId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "QuoteRepairStatus" NOT NULL DEFAULT 'DRAFT',
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "reviewComment" TEXT,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteRepairVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuoteRepairVersion_quoteRepairId_versionNumber_key" ON "QuoteRepairVersion"("quoteRepairId", "versionNumber");
CREATE INDEX "QuoteRepairVersion_quoteRepairId_status_idx" ON "QuoteRepairVersion"("quoteRepairId", "status");
CREATE INDEX "QuoteRepairVersion_createdById_idx" ON "QuoteRepairVersion"("createdById");
CREATE INDEX "QuoteRepairVersion_updatedById_idx" ON "QuoteRepairVersion"("updatedById");
CREATE INDEX "QuoteRepairVersion_submittedById_idx" ON "QuoteRepairVersion"("submittedById");
CREATE INDEX "QuoteRepairVersion_approvedById_idx" ON "QuoteRepairVersion"("approvedById");

CREATE TABLE "QuoteRepairItem" (
    "id" TEXT NOT NULL,
    "quoteRepairVersionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "serviceId" TEXT,
    "serviceNameSnapshot" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteRepairItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuoteRepairItem_quoteRepairVersionId_sortOrder_idx" ON "QuoteRepairItem"("quoteRepairVersionId", "sortOrder");
CREATE INDEX "QuoteRepairItem_serviceId_idx" ON "QuoteRepairItem"("serviceId");

CREATE TABLE "QuoteRepairActivity" (
    "id" TEXT NOT NULL,
    "quoteRepairId" TEXT NOT NULL,
    "quoteRepairVersionId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "beforeSummary" TEXT,
    "afterSummary" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteRepairActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuoteRepairActivity_quoteRepairId_createdAt_idx" ON "QuoteRepairActivity"("quoteRepairId", "createdAt");
CREATE INDEX "QuoteRepairActivity_quoteRepairVersionId_idx" ON "QuoteRepairActivity"("quoteRepairVersionId");
CREATE INDEX "QuoteRepairActivity_actorUserId_idx" ON "QuoteRepairActivity"("actorUserId");
CREATE INDEX "QuoteRepairActivity_action_idx" ON "QuoteRepairActivity"("action");

ALTER TABLE "QuoteRepair" ADD CONSTRAINT "QuoteRepair_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteRepair" ADD CONSTRAINT "QuoteRepair_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteRepair" ADD CONSTRAINT "QuoteRepair_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "QuoteRepairVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuoteRepair" ADD CONSTRAINT "QuoteRepair_approvedVersionId_fkey" FOREIGN KEY ("approvedVersionId") REFERENCES "QuoteRepairVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuoteRepairVersion" ADD CONSTRAINT "QuoteRepairVersion_quoteRepairId_fkey" FOREIGN KEY ("quoteRepairId") REFERENCES "QuoteRepair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteRepairVersion" ADD CONSTRAINT "QuoteRepairVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteRepairVersion" ADD CONSTRAINT "QuoteRepairVersion_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuoteRepairVersion" ADD CONSTRAINT "QuoteRepairVersion_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuoteRepairVersion" ADD CONSTRAINT "QuoteRepairVersion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuoteRepairItem" ADD CONSTRAINT "QuoteRepairItem_quoteRepairVersionId_fkey" FOREIGN KEY ("quoteRepairVersionId") REFERENCES "QuoteRepairVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteRepairItem" ADD CONSTRAINT "QuoteRepairItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "QuoteRepairService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuoteRepairActivity" ADD CONSTRAINT "QuoteRepairActivity_quoteRepairId_fkey" FOREIGN KEY ("quoteRepairId") REFERENCES "QuoteRepair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteRepairActivity" ADD CONSTRAINT "QuoteRepairActivity_quoteRepairVersionId_fkey" FOREIGN KEY ("quoteRepairVersionId") REFERENCES "QuoteRepairVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuoteRepairActivity" ADD CONSTRAINT "QuoteRepairActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

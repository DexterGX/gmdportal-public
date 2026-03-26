-- Add tier-based costs and sale price for cabinet installation settings

ALTER TABLE "CabinetInstallerProfile"
ADD COLUMN "costTierId" TEXT;

ALTER TABLE "CabinetInstallationItem"
ADD COLUMN "salePrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE "CabinetInstallationCostTier" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CabinetInstallationCostTier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CabinetInstallationItemCost" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "costTierId" TEXT NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CabinetInstallationItemCost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CabinetInstallationCostTier_key_key" ON "CabinetInstallationCostTier"("key");
CREATE INDEX "CabinetInstallationCostTier_isActive_idx" ON "CabinetInstallationCostTier"("isActive");
CREATE INDEX "CabinetInstallationCostTier_sortOrder_idx" ON "CabinetInstallationCostTier"("sortOrder");

CREATE UNIQUE INDEX "CabinetInstallationItemCost_itemId_costTierId_key" ON "CabinetInstallationItemCost"("itemId", "costTierId");
CREATE INDEX "CabinetInstallationItemCost_itemId_idx" ON "CabinetInstallationItemCost"("itemId");
CREATE INDEX "CabinetInstallationItemCost_costTierId_idx" ON "CabinetInstallationItemCost"("costTierId");

CREATE INDEX "CabinetInstallerProfile_costTierId_idx" ON "CabinetInstallerProfile"("costTierId");

ALTER TABLE "CabinetInstallerProfile"
ADD CONSTRAINT "CabinetInstallerProfile_costTierId_fkey"
FOREIGN KEY ("costTierId") REFERENCES "CabinetInstallationCostTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CabinetInstallationItemCost"
ADD CONSTRAINT "CabinetInstallationItemCost_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "CabinetInstallationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CabinetInstallationItemCost"
ADD CONSTRAINT "CabinetInstallationItemCost_costTierId_fkey"
FOREIGN KEY ("costTierId") REFERENCES "CabinetInstallationCostTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CabinetInstallationCostTier" ("id", "key", "name", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'A', 'Cost A', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'B', 'Cost B', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

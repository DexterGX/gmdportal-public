-- Cabinet Installation settings: installer profiles, line items, and per-installer pricing

CREATE TABLE "CabinetInstallerProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CabinetInstallerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CabinetInstallationItem" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "defaultWillingToPay" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CabinetInstallationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CabinetInstallationPricing" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "installerCharge" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CabinetInstallationPricing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CabinetInstallerProfile_name_key" ON "CabinetInstallerProfile"("name");
CREATE UNIQUE INDEX "CabinetInstallerProfile_code_key" ON "CabinetInstallerProfile"("code");
CREATE INDEX "CabinetInstallerProfile_isActive_idx" ON "CabinetInstallerProfile"("isActive");

CREATE INDEX "CabinetInstallationItem_description_idx" ON "CabinetInstallationItem"("description");
CREATE INDEX "CabinetInstallationItem_category_idx" ON "CabinetInstallationItem"("category");
CREATE INDEX "CabinetInstallationItem_isActive_idx" ON "CabinetInstallationItem"("isActive");

CREATE UNIQUE INDEX "CabinetInstallationPricing_profileId_itemId_key" ON "CabinetInstallationPricing"("profileId", "itemId");
CREATE INDEX "CabinetInstallationPricing_profileId_idx" ON "CabinetInstallationPricing"("profileId");
CREATE INDEX "CabinetInstallationPricing_itemId_idx" ON "CabinetInstallationPricing"("itemId");

ALTER TABLE "CabinetInstallationPricing"
ADD CONSTRAINT "CabinetInstallationPricing_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "CabinetInstallerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CabinetInstallationPricing"
ADD CONSTRAINT "CabinetInstallationPricing_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "CabinetInstallationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

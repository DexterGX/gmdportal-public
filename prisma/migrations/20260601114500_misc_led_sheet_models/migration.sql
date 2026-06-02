CREATE TABLE "MiscLedSheetType" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MiscLedSheetType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MiscLedSheetType_name_key" ON "MiscLedSheetType"("name");

CREATE TABLE "MiscLedSheetSetting" (
  "id" TEXT NOT NULL,
  "minimumSheetPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MiscLedSheetSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MiscEstimateLedSheetRow" (
  "id" TEXT NOT NULL,
  "estimateId" TEXT NOT NULL,
  "roomId" TEXT,
  "sheetTypeId" TEXT,
  "controlTypeId" TEXT,
  "widthIn" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "heightIn" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "squareFeet" INTEGER NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MiscEstimateLedSheetRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MiscEstimateLedSheetRow_estimateId_idx" ON "MiscEstimateLedSheetRow"("estimateId");
CREATE INDEX "MiscEstimateLedSheetRow_roomId_idx" ON "MiscEstimateLedSheetRow"("roomId");
CREATE INDEX "MiscEstimateLedSheetRow_sheetTypeId_idx" ON "MiscEstimateLedSheetRow"("sheetTypeId");
CREATE INDEX "MiscEstimateLedSheetRow_controlTypeId_idx" ON "MiscEstimateLedSheetRow"("controlTypeId");

ALTER TABLE "MiscEstimateLedSheetRow"
ADD CONSTRAINT "MiscEstimateLedSheetRow_estimateId_fkey"
FOREIGN KEY ("estimateId") REFERENCES "MiscEstimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MiscEstimateLedSheetRow"
ADD CONSTRAINT "MiscEstimateLedSheetRow_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "MiscLedRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MiscEstimateLedSheetRow"
ADD CONSTRAINT "MiscEstimateLedSheetRow_sheetTypeId_fkey"
FOREIGN KEY ("sheetTypeId") REFERENCES "MiscLedSheetType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MiscEstimateLedSheetRow"
ADD CONSTRAINT "MiscEstimateLedSheetRow_controlTypeId_fkey"
FOREIGN KEY ("controlTypeId") REFERENCES "MiscLedControlType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "MiscLedSheetType" ("id", "name", "unitPrice", "active", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('msht_white', 'White', 170, true, 10, NOW(), NOW()),
  ('msht_color', 'Color', 190, true, 20, NOW(), NOW()),
  ('msht_warmwhite', 'WarmWhite', 190, true, 30, NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "MiscLedSheetSetting" ("id", "minimumSheetPrice", "createdAt", "updatedAt")
VALUES ('mss_default', 2500, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

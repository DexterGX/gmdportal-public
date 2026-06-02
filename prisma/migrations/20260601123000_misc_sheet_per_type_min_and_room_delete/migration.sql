ALTER TABLE "MiscLedSheetType"
ADD COLUMN "minimumPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "MiscEstimateLedRow"
DROP CONSTRAINT IF EXISTS "MiscEstimateLedRow_roomId_fkey";
ALTER TABLE "MiscEstimateLedRow"
ADD CONSTRAINT "MiscEstimateLedRow_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "MiscLedRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MiscEstimateLedSheetRow"
DROP CONSTRAINT IF EXISTS "MiscEstimateLedSheetRow_roomId_fkey";
ALTER TABLE "MiscEstimateLedSheetRow"
ADD CONSTRAINT "MiscEstimateLedSheetRow_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "MiscLedRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

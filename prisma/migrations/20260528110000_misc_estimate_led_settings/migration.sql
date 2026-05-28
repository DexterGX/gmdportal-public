-- CreateTable
CREATE TABLE "MiscEstimate" (
    "id" TEXT NOT NULL,
    "estimateNo" TEXT,
    "title" TEXT NOT NULL,
    "clientName" TEXT,
    "clientId" TEXT,
    "dealName" TEXT,
    "dealId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "salesRep" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiscEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiscLedRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiscLedRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiscLedType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
  "minimumPriceUnder25Ft" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pricePerFt" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiscLedType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiscLedControlType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiscLedControlType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiscLedProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiscLedProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiscEstimateLedRow" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "roomId" TEXT,
    "ledTypeId" TEXT,
    "controlTypeId" TEXT,
    "profileId" TEXT,
    "linearFeet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "profileQty" INTEGER NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiscEstimateLedRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MiscEstimate_estimateNo_key" ON "MiscEstimate"("estimateNo");
CREATE INDEX "MiscEstimate_estimateNo_idx" ON "MiscEstimate"("estimateNo");
CREATE INDEX "MiscEstimate_clientId_idx" ON "MiscEstimate"("clientId");
CREATE INDEX "MiscEstimate_dealId_idx" ON "MiscEstimate"("dealId");
CREATE UNIQUE INDEX "MiscLedRoom_name_key" ON "MiscLedRoom"("name");
CREATE UNIQUE INDEX "MiscLedType_name_key" ON "MiscLedType"("name");
CREATE UNIQUE INDEX "MiscLedControlType_name_key" ON "MiscLedControlType"("name");
CREATE UNIQUE INDEX "MiscLedProfile_name_key" ON "MiscLedProfile"("name");
CREATE INDEX "MiscEstimateLedRow_estimateId_idx" ON "MiscEstimateLedRow"("estimateId");
CREATE INDEX "MiscEstimateLedRow_roomId_idx" ON "MiscEstimateLedRow"("roomId");
CREATE INDEX "MiscEstimateLedRow_ledTypeId_idx" ON "MiscEstimateLedRow"("ledTypeId");
CREATE INDEX "MiscEstimateLedRow_controlTypeId_idx" ON "MiscEstimateLedRow"("controlTypeId");
CREATE INDEX "MiscEstimateLedRow_profileId_idx" ON "MiscEstimateLedRow"("profileId");

-- AddForeignKey
ALTER TABLE "MiscEstimateLedRow" ADD CONSTRAINT "MiscEstimateLedRow_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "MiscEstimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MiscEstimateLedRow" ADD CONSTRAINT "MiscEstimateLedRow_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MiscLedRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MiscEstimateLedRow" ADD CONSTRAINT "MiscEstimateLedRow_ledTypeId_fkey" FOREIGN KEY ("ledTypeId") REFERENCES "MiscLedType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MiscEstimateLedRow" ADD CONSTRAINT "MiscEstimateLedRow_controlTypeId_fkey" FOREIGN KEY ("controlTypeId") REFERENCES "MiscLedControlType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MiscEstimateLedRow" ADD CONSTRAINT "MiscEstimateLedRow_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MiscLedProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed initial rooms
INSERT INTO "MiscLedRoom" ("id", "name", "sortOrder", "active", "createdAt", "updatedAt") VALUES
  ('misc_led_room_bar', 'Bar', 10, true, NOW(), NOW()),
  ('misc_led_room_floor', 'Floor', 20, true, NOW(), NOW()),
  ('misc_led_room_guest_bath', 'Guest Bath', 30, true, NOW(), NOW()),
  ('misc_led_room_island', 'Island', 40, true, NOW(), NOW()),
  ('misc_led_room_kitchen', 'Kitchen', 50, true, NOW(), NOW()),
  ('misc_led_room_master_bath', 'Master Bath', 60, true, NOW(), NOW()),
  ('misc_led_room_powder_room', 'Powder Room', 70, true, NOW(), NOW()),
  ('misc_led_room_wall', 'Wall', 80, true, NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- Seed sample led types
INSERT INTO "MiscLedType" ("id", "name", "minimumPriceUnder25Ft", "pricePerFt", "active", "sortOrder", "createdAt", "updatedAt") VALUES
  ('misc_led_type_warm_white', 'Warm White LED Strip', 0, 0, true, 10, NOW(), NOW()),
  ('misc_led_type_cool_white', 'Cool White LED Strip', 0, 0, true, 20, NOW(), NOW()),
  ('misc_led_type_rgb', 'RGB LED Strip', 0, 0, true, 30, NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- Seed sample control types
INSERT INTO "MiscLedControlType" ("id", "name", "unitPrice", "active", "sortOrder", "createdAt", "updatedAt") VALUES
  ('misc_led_control_standard_switch', 'Standard Switch', 0, true, 10, NOW(), NOW()),
  ('misc_led_control_dimmer', 'Dimmer', 0, true, 20, NOW(), NOW()),
  ('misc_led_control_remote', 'Remote Control', 0, true, 30, NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- Seed sample profiles
INSERT INTO "MiscLedProfile" ("id", "name", "unitPrice", "active", "sortOrder", "createdAt", "updatedAt") VALUES
  ('misc_led_profile_standard', 'Standard Profile', 0, true, 10, NOW(), NOW()),
  ('misc_led_profile_recessed', 'Recessed Profile', 0, true, 20, NOW(), NOW()),
  ('misc_led_profile_corner', 'Corner Profile', 0, true, 30, NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

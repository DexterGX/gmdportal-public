-- CreateEnum
CREATE TYPE "SinkStatus" AS ENUM ('AVAILABLE', 'DISCONTINUED');

-- CreateTable
CREATE TABLE "SinkBrand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "factor" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "taxFactor" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "freight" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "contactName" TEXT,
    "contactCell" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SinkBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sink" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "description" TEXT,
    "dimensions" TEXT NOT NULL,
    "listedPrice" DECIMAL(10,2) NOT NULL,
    "finalPrice" DECIMAL(10,2) NOT NULL,
    "status" "SinkStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isPromotional" BOOLEAN NOT NULL DEFAULT false,
    "promotionalPrice" DECIMAL(10,2),
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SinkBrand_name_key" ON "SinkBrand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Sink_brandId_model_dimensions_key" ON "Sink"("brandId", "model", "dimensions");

-- CreateIndex
CREATE INDEX "Sink_brandId_idx" ON "Sink"("brandId");

-- CreateIndex
CREATE INDEX "Sink_status_idx" ON "Sink"("status");

-- CreateIndex
CREATE INDEX "Sink_isPromotional_idx" ON "Sink"("isPromotional");

-- AddForeignKey
ALTER TABLE "Sink" ADD CONSTRAINT "Sink_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "SinkBrand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

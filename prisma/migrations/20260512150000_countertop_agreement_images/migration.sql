-- CreateTable
CREATE TABLE "CountertopAgreementImage" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "optionKey" TEXT NOT NULL,
    "optionLabel" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountertopAgreementImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CountertopAgreementImage_category_idx" ON "CountertopAgreementImage"("category");

-- CreateIndex
CREATE UNIQUE INDEX "CountertopAgreementImage_category_optionKey_key" ON "CountertopAgreementImage"("category", "optionKey");

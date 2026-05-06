-- Create table for editable agreement form templates used by Settings and print workflows
CREATE TABLE "AgreementFormTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgreementFormTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgreementFormTemplate_key_key" ON "AgreementFormTemplate"("key");
CREATE INDEX "AgreementFormTemplate_sortOrder_idx" ON "AgreementFormTemplate"("sortOrder");

-- Add QuickBooks transaction id support and allow invoices without a weekly period.
ALTER TABLE "SalesCommissionMasterInvoice"
ADD COLUMN IF NOT EXISTS "quickbooksTxnId" TEXT;

ALTER TABLE "SalesCommissionInvoice"
ADD COLUMN IF NOT EXISTS "quickbooksTxnId" TEXT;

ALTER TABLE "SalesCommissionInvoice"
ALTER COLUMN "periodId" DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'SalesCommissionInvoice_periodId_fkey'
      AND table_name = 'SalesCommissionInvoice'
  ) THEN
    ALTER TABLE "SalesCommissionInvoice"
    DROP CONSTRAINT "SalesCommissionInvoice_periodId_fkey";
  END IF;
END $$;

ALTER TABLE "SalesCommissionInvoice"
ADD CONSTRAINT "SalesCommissionInvoice_periodId_fkey"
FOREIGN KEY ("periodId") REFERENCES "SalesCommissionPeriod"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "SalesCommissionMasterInvoice_quickbooksTxnId_idx"
ON "SalesCommissionMasterInvoice"("quickbooksTxnId");

CREATE INDEX IF NOT EXISTS "SalesCommissionInvoice_quickbooksTxnId_idx"
ON "SalesCommissionInvoice"("quickbooksTxnId");

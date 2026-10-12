-- Phase 3 (REQ-144, REQ-147, DEC-019…023, DEC-068…072, DEC-100…105, AUD-001/002/003):
-- per-line VAT, Invoice<->Job and Invoice<->B/L joins, TRN snapshot, controlled correction.
--
-- Additive and money-preserving:
--   1) new nullable columns only; no existing column is dropped, renamed or re-typed,
--   2) invoice_items.taxRate is backfilled from the header rate of the same invoice, so every
--      existing line carries the rate it was actually billed at (DEC-102),
--   3) invoice_items.taxAmount is NOT backfilled. Issued invoices keep their stored header
--      money fields as the authoritative record; nothing is re-derived (DEC-023),
--   4) invoices.billOfLadingId is copied into invoice_bills; the legacy column is kept,
--   5) no invoice header total, subtotal, tax or status is changed by this migration.
-- Replay-safe: every statement is guarded.

-- 1) Per-line VAT (REQ-144, DEC-101)
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5,2);
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(18,2);

UPDATE "invoice_items" AS ii
SET "taxRate" = i."taxRate"
FROM "invoices" AS i
WHERE i."id" = ii."invoiceId"
  AND ii."taxRate" IS NULL;

-- 2) TRN snapshot (REQ-147). Historical invoices stay NULL: their printed TRN is not
--    recorded, and CompanySettings is the current value, not the historical one.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "trn" VARCHAR(40);

-- 3) Company setting for correction approval (DEC-022). Default off.
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "invoiceCorrectionApprovalRequired" BOOLEAN NOT NULL DEFAULT false;

-- 4) Invoice <-> Job (DEC-071 many-to-many)
CREATE TABLE IF NOT EXISTS "invoice_jobs" (
    "invoiceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_jobs_pkey" PRIMARY KEY ("invoiceId", "jobId")
);

CREATE INDEX IF NOT EXISTS "invoice_jobs_jobId_idx" ON "invoice_jobs"("jobId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_jobs_invoiceId_fkey') THEN
        ALTER TABLE "invoice_jobs" ADD CONSTRAINT "invoice_jobs_invoiceId_fkey"
            FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_jobs_jobId_fkey') THEN
        ALTER TABLE "invoice_jobs" ADD CONSTRAINT "invoice_jobs_jobId_fkey"
            FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 5) Invoice <-> B/L (DEC-105 multi-B/L)
CREATE TABLE IF NOT EXISTS "invoice_bills" (
    "invoiceId" TEXT NOT NULL,
    "billOfLadingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_bills_pkey" PRIMARY KEY ("invoiceId", "billOfLadingId")
);

CREATE INDEX IF NOT EXISTS "invoice_bills_billOfLadingId_idx" ON "invoice_bills"("billOfLadingId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_bills_invoiceId_fkey') THEN
        ALTER TABLE "invoice_bills" ADD CONSTRAINT "invoice_bills_invoiceId_fkey"
            FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_bills_billOfLadingId_fkey') THEN
        ALTER TABLE "invoice_bills" ADD CONSTRAINT "invoice_bills_billOfLadingId_fkey"
            FOREIGN KEY ("billOfLadingId") REFERENCES "bills_of_lading"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Copy the existing single B/L anchor into the join. ON CONFLICT keeps this replay-safe.
INSERT INTO "invoice_bills" ("invoiceId", "billOfLadingId")
SELECT i."id", i."billOfLadingId"
FROM "invoices" AS i
WHERE i."billOfLadingId" IS NOT NULL
ON CONFLICT ("invoiceId", "billOfLadingId") DO NOTHING;

-- 6) Controlled correction (DEC-020/021/022/023)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceCorrectionStatus') THEN
        CREATE TYPE "InvoiceCorrectionStatus" AS ENUM ('PENDING_APPROVAL', 'APPLIED', 'REJECTED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "invoice_corrections" (
    "id" TEXT NOT NULL,
    "originalInvoiceId" TEXT NOT NULL,
    "replacementInvoiceId" TEXT,
    "mechanism" VARCHAR(40) NOT NULL DEFAULT 'CANCEL_AND_REISSUE',
    "status" "InvoiceCorrectionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "reason" VARCHAR(500) NOT NULL,
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" VARCHAR(500),
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "invoice_corrections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_corrections_replacementInvoiceId_key" ON "invoice_corrections"("replacementInvoiceId");
CREATE INDEX IF NOT EXISTS "invoice_corrections_originalInvoiceId_idx" ON "invoice_corrections"("originalInvoiceId");
CREATE INDEX IF NOT EXISTS "invoice_corrections_status_idx" ON "invoice_corrections"("status");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_corrections_originalInvoiceId_fkey') THEN
        ALTER TABLE "invoice_corrections" ADD CONSTRAINT "invoice_corrections_originalInvoiceId_fkey"
            FOREIGN KEY ("originalInvoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_corrections_replacementInvoiceId_fkey') THEN
        ALTER TABLE "invoice_corrections" ADD CONSTRAINT "invoice_corrections_replacementInvoiceId_fkey"
            FOREIGN KEY ("replacementInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_corrections_requestedById_fkey') THEN
        ALTER TABLE "invoice_corrections" ADD CONSTRAINT "invoice_corrections_requestedById_fkey"
            FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_corrections_decidedById_fkey') THEN
        ALTER TABLE "invoice_corrections" ADD CONSTRAINT "invoice_corrections_decidedById_fkey"
            FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

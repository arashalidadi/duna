-- ==========================================================================
-- source: 20261004000001_bl_issued_backfill
-- ==========================================================================
-- P4-U4 backfill (ADR-046 ruling 1 / ADR-045 decision 2): shipped 'ISSUED' rows map to
-- the issued-equivalent 'APPROVED'. DRAFT/CANCELLED untouched. Idempotent — a re-run
-- matches zero rows (safe under any deploy policy).
UPDATE "bills_of_lading" SET "status" = 'APPROVED' WHERE "status" = 'ISSUED';

-- ==========================================================================
-- source: 20261004120000_bl_revisions
-- ==========================================================================
-- P4-U5 — ADR-045 decision 4 (B/L revisions): additive only.
--  * bills_of_lading.revision: the label the NEXT frozen revision receives
--    (snapshots are numbered 1, 2, 3, ... ; counter starts at 1).
--  * bills_of_lading_revisions: immutable snapshots {billId, revisionNumber, note?,
--    snapshot (JSONB), createdById, createdAt}; @@unique(billId, revisionNumber) is the
--    DB backstop behind the row-lock used by the service.
-- Both FKs are ON DELETE CASCADE (a bill or user removal drops its revision rows —
-- keeps test cleanups working). No column drops, no enum changes.
ALTER TABLE "bills_of_lading" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "bills_of_lading_revisions" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "note" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bills_of_lading_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bills_of_lading_revisions_billId_idx" ON "bills_of_lading_revisions"("billId");

CREATE UNIQUE INDEX "bills_of_lading_revisions_billId_revisionNumber_key" ON "bills_of_lading_revisions"("billId", "revisionNumber");

ALTER TABLE "bills_of_lading_revisions" ADD CONSTRAINT "bills_of_lading_revisions_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills_of_lading"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bills_of_lading_revisions" ADD CONSTRAINT "bills_of_lading_revisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20261005130000_manifest_bl_reference
-- ==========================================================================
-- AlterTable
ALTER TABLE "manifests" ADD COLUMN     "manifestDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "manifest_items" ADD COLUMN     "billOfLadingItemId" TEXT,
ADD COLUMN     "consigneeId" TEXT,
ADD COLUMN     "shipperId" TEXT;

-- CreateIndex
CREATE INDEX "manifest_items_billOfLadingItemId_idx" ON "manifest_items"("billOfLadingItemId");

-- CreateIndex
CREATE INDEX "manifest_items_shipperId_idx" ON "manifest_items"("shipperId");

-- CreateIndex
CREATE INDEX "manifest_items_consigneeId_idx" ON "manifest_items"("consigneeId");

-- AddForeignKey
ALTER TABLE "manifest_items" ADD CONSTRAINT "manifest_items_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "shippers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifest_items" ADD CONSTRAINT "manifest_items_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "consignees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifest_items" ADD CONSTRAINT "manifest_items_billOfLadingItemId_fkey" FOREIGN KEY ("billOfLadingItemId") REFERENCES "bills_of_lading_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (ADR-047 d3, verbatim): restore the two-way reference for legacy stamped
-- lines (bills_of_lading_items.manifestItemId -> manifest_items). Idempotent — guarded
-- by IS NULL, re-runnable on a live DB (P5-U2 test asserts a re-run changes 0 rows).
UPDATE "manifest_items" mi
SET "billOfLadingItemId" = bli.id
FROM "bills_of_lading_items" bli
WHERE bli."manifestItemId" = mi.id
  AND mi."billOfLadingItemId" IS NULL;


-- ==========================================================================
-- source: 20261012000000_primary_administrator
-- ==========================================================================
-- DEC-116 — Primary administrator (the company owner).
--
-- Adds the identity flag described in confirmed-decisions.md DEC-116.
--
-- Why a PARTIAL unique index rather than a plain unique index:
--   A plain UNIQUE("isPrimaryAdmin") would permit only ONE row with true AND only
--   ONE row with false, which is wrong — there must be exactly one primary
--   administrator and arbitrarily many non-primary users.
--   A partial unique index constrains only the rows where isPrimaryAdmin = true,
--   which is precisely "at most one primary administrator".
--
-- "Exactly one" (rather than "at most one") is additionally enforced in the
-- application layer by UsersService, because a database cannot require a row to
-- exist. UsersService.assertCanMutatePrimaryAdmin + transferPrimaryAdmin cover
-- removal, deactivation, deletion and succession.
ALTER TABLE "User" ADD COLUMN "isPrimaryAdmin" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "User_isPrimaryAdmin_key"
  ON "User"("isPrimaryAdmin")
  WHERE "isPrimaryAdmin" = true;

-- ==========================================================================
-- source: 20261013000000_voyage_leg_vessel_scope
-- ==========================================================================
-- Phase 2 (REQ-040): voyage number `n/yy` counts trips per vessel + destination + year.
--
-- Additive and number-preserving:
--   1) adds VoyageDestination."numberingVesselId" (the vessel whose counter issued the leg number),
--   2) backfills it from the leg's voyage (Voyage.vesselId) for EVERY existing leg, including
--      soft-deleted rows, so no issued voyageNumber changes (DEC-026),
--   3) replaces the unique index (destination, voyageNumber) with (destination, vessel, voyageNumber).
--      The new index is a superset of the old one: any data that satisfied the old index also
--      satisfies the new one, so the change cannot fail on existing rows.
-- Replay-safe: every statement is guarded.

-- 1) Column (nullable while backfilling)
ALTER TABLE "VoyageDestination" ADD COLUMN IF NOT EXISTS "numberingVesselId" TEXT;

-- 2) Backfill from the voyage's vessel at the time of this migration
UPDATE "VoyageDestination" AS vd
SET "numberingVesselId" = v."vesselId"
FROM "Voyage" AS v
WHERE v."id" = vd."voyageId"
  AND vd."numberingVesselId" IS NULL;

ALTER TABLE "VoyageDestination" ALTER COLUMN "numberingVesselId" SET NOT NULL;

-- 3) Foreign key
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VoyageDestination_numberingVesselId_fkey') THEN
        ALTER TABLE "VoyageDestination" ADD CONSTRAINT "VoyageDestination_numberingVesselId_fkey"
            FOREIGN KEY ("numberingVesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- 4) Unique index: vessel-scoped numbers. The name is set explicitly because the Prisma-default
--    name exceeds PostgreSQL's 63-byte identifier limit and would be truncated.
DROP INDEX IF EXISTS "VoyageDestination_destinationPortId_voyageNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "VoyageDestination_dest_vessel_number_key"
    ON "VoyageDestination"("destinationPortId", "numberingVesselId", "voyageNumber");

-- ==========================================================================
-- source: 20261013120000_invoice_tax_links_correction
-- ==========================================================================
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

-- ==========================================================================
-- source: 20261013150000_phase5_release_payment_port_labels
-- ==========================================================================
-- Phase 5 slice 1 (REQ-182, REQ-186, DEC-059/060/061, DEC-063, AUD-010):
-- release payment state, delivery-order port, and configurable B/L lifecycle labels.
--
-- Additive only:
--   1) new enum type and nullable column on release_orders; existing rows stay NULL,
--   2) new nullable port columns and an index on delivery_orders; existing rows stay NULL,
--   3) new table bl_lifecycle_labels; no existing table, column, enum value or row is changed.
-- No status, money field or document number is changed by this migration.
-- Replay-safe: every statement is guarded.

-- 1) Payment state recorded at release (REQ-182, EMP-685..689)
DO $$
BEGIN
  CREATE TYPE "ReleasePaymentState" AS ENUM ('PAID', 'PARTIAL', 'UNPAID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "release_orders" ADD COLUMN IF NOT EXISTS "paymentState" "ReleasePaymentState";

-- 2) Port on the delivery order (REQ-186, EMP-671). portName is a snapshot taken at issue.
ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "portId" TEXT;
ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "portName" TEXT;

CREATE INDEX IF NOT EXISTS "delivery_orders_portId_idx" ON "delivery_orders"("portId");

DO $$
BEGIN
  ALTER TABLE "delivery_orders"
    ADD CONSTRAINT "delivery_orders_portId_fkey"
    FOREIGN KEY ("portId") REFERENCES "Port"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3) Configurable B/L lifecycle labels (DEC-059/060/061). Seed rows are written by the seed
--    (add-only, labels default to the code); the migration only creates the table.
CREATE TABLE IF NOT EXISTS "bl_lifecycle_labels" (
    "code" "BlStatus" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bl_lifecycle_labels_pkey" PRIMARY KEY ("code")
);

-- ==========================================================================
-- source: 20261015000000_phase6_financial_core_additive
-- ==========================================================================
-- Phase 6, additive financial core. No existing amount, currency, paidAmount,
-- status or derived statement is recomputed by this migration. The only change
-- to an existing numeric column is a lossless widening for small FX rates.
CREATE TYPE "AllocationPolicy" AS ENUM ('MANUAL', 'OLDEST_DUE', 'OLDEST_ISSUED');
CREATE TYPE "CurrencyRateStatus" AS ENUM ('DRAFT', 'APPROVED');
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');
CREATE TYPE "JournalKind" AS ENUM ('GENERAL', 'OFFICE_EXPENSE');

ALTER TABLE "CompanySettings" ADD COLUMN "allocationPolicy" "AllocationPolicy" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "invoices"
  ADD COLUMN "baseCurrencyCode" TEXT,
  ADD COLUMN "baseAmount" DECIMAL(24,2),
  ADD COLUMN "exchangeRate" DECIMAL(24,12),
  ADD COLUMN "rateEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "rateSource" TEXT,
  ADD COLUMN "currencyRateId" TEXT,
  ADD COLUMN "rateOverrideReason" TEXT;
ALTER TABLE "vouchers"
  ALTER COLUMN "exchangeRate" TYPE DECIMAL(24,12),
  ADD COLUMN "billOfLadingId" TEXT,
  ADD COLUMN "baseCurrencyCode" TEXT,
  ADD COLUMN "baseAmount" DECIMAL(24,2),
  ADD COLUMN "rateEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "rateSource" TEXT,
  ADD COLUMN "currencyRateId" TEXT,
  ADD COLUMN "rateOverrideReason" TEXT;
CREATE INDEX "vouchers_billOfLadingId_idx" ON "vouchers"("billOfLadingId");
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_billOfLadingId_fkey"
  FOREIGN KEY ("billOfLadingId") REFERENCES "bills_of_lading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "currency_rates" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "currencyCode" TEXT NOT NULL,
  "baseCurrencyCode" TEXT NOT NULL,
  "rate" DECIMAL(24,12) NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "status" "CurrencyRateStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "currency_rates_currencyCode_baseCurrencyCode_effectiveAt_key" ON "currency_rates"("currencyCode","baseCurrencyCode","effectiveAt");
CREATE INDEX "currency_rates_currencyCode_baseCurrencyCode_status_effectiveAt_idx" ON "currency_rates"("currencyCode","baseCurrencyCode","status","effectiveAt");
ALTER TABLE "currency_rates" ADD CONSTRAINT "currency_rates_positive_rate" CHECK ("rate" > 0 AND "currencyCode" <> "baseCurrencyCode");
ALTER TABLE "currency_rates" ADD CONSTRAINT "currency_rates_approval_check" CHECK
  (("status" = 'DRAFT' AND "approvedAt" IS NULL AND "approvedById" IS NULL) OR
   ("status" = 'APPROVED' AND "approvedAt" IS NOT NULL AND "approvedById" IS NOT NULL));

-- A central rate may be edited while DRAFT; once approved it must be replaced
-- by a new effective-dated rate, not updated or deleted (even via SQL clients).
CREATE FUNCTION phase6_approved_rate_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'APPROVED' THEN
    RAISE EXCEPTION 'Approved currency rates are immutable; create a new dated rate';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase6_approved_rate_immutable_trigger
  BEFORE UPDATE OR DELETE ON "currency_rates" FOR EACH ROW
  EXECUTE FUNCTION phase6_approved_rate_immutable();

CREATE TABLE "voucher_allocations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voucherId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "billOfLadingId" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedAt" TIMESTAMP(3),
  "reversedById" TEXT,
  "reversalReason" TEXT
);
CREATE INDEX "voucher_allocations_voucherId_reversedAt_idx" ON "voucher_allocations"("voucherId","reversedAt");
CREATE INDEX "voucher_allocations_invoiceId_reversedAt_idx" ON "voucher_allocations"("invoiceId","reversedAt");
CREATE INDEX "voucher_allocations_billOfLadingId_reversedAt_idx" ON "voucher_allocations"("billOfLadingId","reversedAt");
ALTER TABLE "voucher_allocations" ADD CONSTRAINT "voucher_allocations_ref_check"
  CHECK ("amount" > 0 AND (("invoiceId" IS NOT NULL) <> ("billOfLadingId" IS NOT NULL)));
ALTER TABLE "voucher_allocations" ADD CONSTRAINT "voucher_allocations_reversal_check"
  CHECK (("reversedAt" IS NULL AND "reversedById" IS NULL AND "reversalReason" IS NULL)
      OR ("reversedAt" IS NOT NULL AND "reversalReason" IS NOT NULL));
ALTER TABLE "voucher_allocations" ADD CONSTRAINT "voucher_allocations_voucherId_fkey"
  FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voucher_allocations" ADD CONSTRAINT "voucher_allocations_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voucher_allocations" ADD CONSTRAINT "voucher_allocations_billOfLadingId_fkey"
  FOREIGN KEY ("billOfLadingId") REFERENCES "bills_of_lading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "voucher_amount_adjustments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voucherId" TEXT NOT NULL,
  "previousAmount" DECIMAL(18,2) NOT NULL,
  "newAmount" DECIMAL(18,2) NOT NULL,
  "previousBaseAmount" DECIMAL(24,2),
  "newBaseAmount" DECIMAL(24,2),
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "voucher_amount_adjustments_voucherId_createdAt_idx" ON "voucher_amount_adjustments"("voucherId","createdAt");
ALTER TABLE "voucher_amount_adjustments" ADD CONSTRAINT "voucher_amount_adjustments_amount_check"
  CHECK ("previousAmount" > 0 AND "newAmount" > 0 AND "previousAmount" <> "newAmount");
ALTER TABLE "voucher_amount_adjustments" ADD CONSTRAINT "voucher_amount_adjustments_voucherId_fkey"
  FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "customer_postings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventKey" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "currencyCode" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_postings_nonnegative" CHECK ("debit" >= 0 AND "credit" >= 0)
);
CREATE UNIQUE INDEX "customer_postings_eventKey_key" ON "customer_postings"("eventKey");
CREATE INDEX "customer_postings_customerId_currencyCode_effectiveAt_idx" ON "customer_postings"("customerId","currencyCode","effectiveAt");
CREATE INDEX "customer_postings_sourceType_sourceId_idx" ON "customer_postings"("sourceType","sourceId");

CREATE TABLE "accounts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AccountType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "accounts_code_key" ON "accounts"("code");
CREATE INDEX "accounts_type_isActive_idx" ON "accounts"("type","isActive");

CREATE TABLE "general_journals" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "journalNumber" TEXT NOT NULL,
  "kind" "JournalKind" NOT NULL DEFAULT 'GENERAL',
  "journalDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "currencyCode" TEXT NOT NULL,
  "baseCurrencyCode" TEXT NOT NULL,
  "exchangeRate" DECIMAL(24,12) NOT NULL,
  "rateEffectiveAt" TIMESTAMP(3) NOT NULL,
  "rateSource" TEXT NOT NULL,
  "currencyRateId" TEXT,
  "rateOverrideReason" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversalOfId" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversedById" TEXT,
  "reversalReason" TEXT
);
CREATE UNIQUE INDEX "general_journals_journalNumber_key" ON "general_journals"("journalNumber");
CREATE UNIQUE INDEX "general_journals_reversalOfId_key" ON "general_journals"("reversalOfId");
CREATE INDEX "general_journals_journalDate_idx" ON "general_journals"("journalDate");
CREATE INDEX "general_journals_kind_idx" ON "general_journals"("kind");
ALTER TABLE "general_journals" ADD CONSTRAINT "general_journals_reversalOfId_fkey"
  FOREIGN KEY ("reversalOfId") REFERENCES "general_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The original header is also immutable. Its one permitted UPDATE marks a
-- reasoned reversal, whose opposite lines live in a separate posted journal.
CREATE FUNCTION phase6_journal_header_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Posted journals cannot be deleted; post a reversal';
  END IF;
  IF (NEW."id",NEW."journalNumber",NEW."kind",NEW."journalDate",NEW."description",
      NEW."reference",NEW."currencyCode",NEW."baseCurrencyCode",NEW."exchangeRate",
      NEW."rateEffectiveAt",NEW."rateSource",NEW."currencyRateId",NEW."rateOverrideReason",
      NEW."createdById",NEW."createdAt",NEW."reversalOfId") IS DISTINCT FROM
     (OLD."id",OLD."journalNumber",OLD."kind",OLD."journalDate",OLD."description",
      OLD."reference",OLD."currencyCode",OLD."baseCurrencyCode",OLD."exchangeRate",
      OLD."rateEffectiveAt",OLD."rateSource",OLD."currencyRateId",OLD."rateOverrideReason",
      OLD."createdById",OLD."createdAt",OLD."reversalOfId")
     OR OLD."reversedAt" IS NOT NULL OR NEW."reversedAt" IS NULL
     OR NEW."reversedById" IS NULL OR NULLIF(BTRIM(NEW."reversalReason"), '') IS NULL THEN
    RAISE EXCEPTION 'Posted journal headers are immutable except a reasoned reversal';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase6_journal_header_immutable_trigger
  BEFORE UPDATE OR DELETE ON "general_journals" FOR EACH ROW
  EXECUTE FUNCTION phase6_journal_header_immutable();

CREATE TABLE "journal_lines" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "journalId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "customerId" TEXT,
  "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "baseDebit" DECIMAL(24,2) NOT NULL DEFAULT 0,
  "baseCredit" DECIMAL(24,2) NOT NULL DEFAULT 0,
  "memo" TEXT,
  CONSTRAINT "journal_lines_one_side" CHECK
    (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0))
);
CREATE INDEX "journal_lines_journalId_idx" ON "journal_lines"("journalId");
CREATE INDEX "journal_lines_accountId_idx" ON "journal_lines"("accountId");
CREATE INDEX "journal_lines_customerId_idx" ON "journal_lines"("customerId");
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journalId_fkey"
  FOREIGN KEY ("journalId") REFERENCES "general_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A posted journal is an immutable set of lines. A deferrable constraint checks
-- BOTH currencies after all lines have been inserted, not after each insert.
-- Corrections use a new reversal journal, never an UPDATE/DELETE to old lines.
CREATE FUNCTION phase6_journal_lines_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Posted journal lines cannot be updated or deleted; post a reversal';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase6_journal_lines_immutable_trigger
  BEFORE UPDATE OR DELETE ON "journal_lines" FOR EACH ROW
  EXECUTE FUNCTION phase6_journal_lines_immutable();

CREATE FUNCTION phase6_journal_balanced() RETURNS trigger AS $$
DECLARE
  source_id TEXT;
  line_count BIGINT;
  debit_sum DECIMAL;
  credit_sum DECIMAL;
  base_debit_sum DECIMAL;
  base_credit_sum DECIMAL;
BEGIN
  IF TG_TABLE_NAME = 'general_journals' THEN
    source_id := NEW."id";
  ELSE
    source_id := NEW."journalId";
  END IF;
  SELECT COUNT(*), COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0),
         COALESCE(SUM("baseDebit"), 0), COALESCE(SUM("baseCredit"), 0)
    INTO line_count, debit_sum, credit_sum, base_debit_sum, base_credit_sum
    FROM "journal_lines" WHERE "journalId" = source_id;
  IF line_count < 2 OR debit_sum <= 0 OR debit_sum <> credit_sum OR base_debit_sum <> base_credit_sum THEN
    RAISE EXCEPTION 'Journal % must contain >=2 balanced lines in original and base currency', source_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER phase6_journal_balanced_header_trigger
  AFTER INSERT ON "general_journals" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION phase6_journal_balanced();
CREATE CONSTRAINT TRIGGER phase6_journal_balanced_line_trigger
  AFTER INSERT ON "journal_lines" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION phase6_journal_balanced();

-- Copy only the *current* existing statement into the shadow subledger. Cancelled
-- and deleted sources are absent from the old derived read, so they are absent here.
-- Dates and amounts are copied, not converted; later reversals have the original
-- effective date to match the old statement's date-window semantics.
INSERT INTO "customer_postings" ("id","eventKey","sourceType","sourceId","customerId","currencyCode","effectiveAt","debit","credit")
SELECT 'p6-inv-' || "id", 'invoice:' || "id" || ':ISSUE', 'invoice', "id", "customerId", "currencyCode", COALESCE("issueDate","createdAt"), "totalAmount", 0
FROM "invoices" WHERE "status" = 'ISSUED' AND "deletedAt" IS NULL;
INSERT INTO "customer_postings" ("id","eventKey","sourceType","sourceId","customerId","currencyCode","effectiveAt","debit","credit")
SELECT 'p6-vch-' || "id", 'voucher:' || "id" || ':POST', 'voucher', "id", "customerId", "currencyCode", "voucherDate", 0, "amount"
FROM "vouchers" WHERE "status" = 'POSTED' AND "deletedAt" IS NULL;

-- Existing direct voucher-to-invoice links become immutable, per-reference
-- allocation rows. The legacy invoiceId and paidAmount are NOT touched.
INSERT INTO "voucher_allocations" ("id","voucherId","invoiceId","amount","createdById","createdAt")
SELECT 'p6-alloc-' || "id", "id", "invoiceId", "amount", "createdById", "createdAt"
FROM "vouchers" WHERE "invoiceId" IS NOT NULL;

-- ==========================================================================
-- source: 20261015010000_phase8_document_output
-- ==========================================================================
-- Phase 8: additive output infrastructure. No existing rows are rewritten,
-- deleted, or marked as migrated. Inspect migration status on the target before applying.
ALTER TABLE "DocumentTemplateVersion" ADD COLUMN "contentHash" TEXT;

CREATE TABLE "DocumentTemplateAssignment" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "templateId" TEXT,
    "versionId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT NOT NULL,
    CONSTRAINT "DocumentTemplateAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DocumentTemplateAssignment_documentType_assignedAt_idx" ON "DocumentTemplateAssignment"("documentType", "assignedAt");
ALTER TABLE "DocumentTemplateAssignment" ADD CONSTRAINT "DocumentTemplateAssignment_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentTemplateAssignment" ADD CONSTRAINT "DocumentTemplateAssignment_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DocumentAsset" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentAsset_storageKey_key" ON "DocumentAsset"("storageKey");
CREATE INDEX "DocumentAsset_kind_isApproved_idx" ON "DocumentAsset"("kind", "isApproved");

CREATE TABLE "DocumentIssuedSnapshot" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "identity" JSONB NOT NULL,
    "fallbackLayout" JSONB NOT NULL,
    "templateVersionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentIssuedSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentIssuedSnapshot_documentType_recordId_key"
    ON "DocumentIssuedSnapshot"("documentType", "recordId");
CREATE INDEX "DocumentIssuedSnapshot_templateVersionId_idx" ON "DocumentIssuedSnapshot"("templateVersionId");
ALTER TABLE "DocumentIssuedSnapshot" ADD CONSTRAINT "DocumentIssuedSnapshot_templateVersionId_fkey"
    FOREIGN KEY ("templateVersionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DocumentRenderedOutput" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "revisionKey" TEXT NOT NULL,
    "templateVersionId" TEXT,
    "content" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentRenderedOutput_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentRenderedOutput_documentType_recordId_format_revisionKey_key"
    ON "DocumentRenderedOutput"("documentType", "recordId", "format", "revisionKey");
CREATE INDEX "DocumentRenderedOutput_templateVersionId_idx" ON "DocumentRenderedOutput"("templateVersionId");
ALTER TABLE "DocumentRenderedOutput" ADD CONSTRAINT "DocumentRenderedOutput_templateVersionId_fkey"
    FOREIGN KEY ("templateVersionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20261016000000_phase7_reporting
-- ==========================================================================
-- Phase 7 is additive: no historical cost column is reinterpreted or erased.
ALTER TYPE "JournalKind" ADD VALUE 'VOYAGE_COST';

CREATE TABLE "voyage_cost_categories" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "voyage_cost_categories_code_key" ON "voyage_cost_categories"("code");

CREATE TABLE "voyage_costs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voyageId" TEXT NOT NULL,
  "manifestId" TEXT,
  "categoryId" TEXT NOT NULL,
  "categoryCodeSnapshot" TEXT NOT NULL,
  "categoryNameSnapshot" TEXT NOT NULL,
  "journalId" TEXT NOT NULL,
  "netAmount" DECIMAL(18,2) NOT NULL,
  "baseNetAmount" DECIMAL(24,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "voyage_costs_net_check" CHECK ("netAmount" > 0 AND "baseNetAmount" >= 0)
);
CREATE UNIQUE INDEX "voyage_costs_journalId_key" ON "voyage_costs"("journalId");
CREATE INDEX "voyage_costs_voyageId_idx" ON "voyage_costs"("voyageId");
CREATE INDEX "voyage_costs_manifestId_idx" ON "voyage_costs"("manifestId");
CREATE INDEX "voyage_costs_categoryId_idx" ON "voyage_costs"("categoryId");
ALTER TABLE "voyage_costs" ADD CONSTRAINT "voyage_costs_voyageId_fkey"
  FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voyage_costs" ADD CONSTRAINT "voyage_costs_manifestId_fkey"
  FOREIGN KEY ("manifestId") REFERENCES "manifests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voyage_costs" ADD CONSTRAINT "voyage_costs_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "voyage_cost_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voyage_costs" ADD CONSTRAINT "voyage_costs_journalId_fkey"
  FOREIGN KEY ("journalId") REFERENCES "general_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "expense_input_taxes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "journalId" TEXT NOT NULL,
  "taxAccountId" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "baseAmount" DECIMAL(24,2) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expense_input_taxes_amount_check" CHECK (
    ("amount" = 0 AND "baseAmount" = 0 AND "taxAccountId" IS NULL AND "paidAt" IS NULL)
    OR ("amount" > 0 AND "baseAmount" >= 0 AND "taxAccountId" IS NOT NULL AND "paidAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "expense_input_taxes_journalId_key" ON "expense_input_taxes"("journalId");
CREATE INDEX "expense_input_taxes_paidAt_idx" ON "expense_input_taxes"("paidAt");
ALTER TABLE "expense_input_taxes" ADD CONSTRAINT "expense_input_taxes_journalId_fkey"
  FOREIGN KEY ("journalId") REFERENCES "general_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expense_input_taxes" ADD CONSTRAINT "expense_input_taxes_taxAccountId_fkey"
  FOREIGN KEY ("taxAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prevent mutation of posted report facts even by direct SQL; correct a cost or
-- tax posting by a reasoned journal reversal and a new posting instead.
CREATE FUNCTION phase7_posted_fact_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Posted report facts are immutable; reverse and repost the journal';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase7_cost_immutable BEFORE UPDATE OR DELETE ON "voyage_costs"
  FOR EACH ROW EXECUTE FUNCTION phase7_posted_fact_immutable();
CREATE TRIGGER phase7_input_tax_immutable BEFORE UPDATE OR DELETE ON "expense_input_taxes"
  FOR EACH ROW EXECUTE FUNCTION phase7_posted_fact_immutable();

-- Check reporting facts against the actual posted journal at COMMIT, after
-- nested journal lines and both fact rows have been inserted. A fake standalone
-- cost/tax row must never enter P&L or VAT even through direct SQL access.
CREATE FUNCTION phase7_report_fact_matches_journal() RETURNS trigger AS $$
DECLARE
  journal_kind "JournalKind";
  reversal TEXT;
  exp_debit DECIMAL;
  exp_base DECIMAL;
BEGIN
  SELECT "kind", "reversalOfId" INTO journal_kind, reversal
    FROM "general_journals" WHERE "id" = NEW."journalId";
  IF reversal IS NOT NULL THEN RAISE EXCEPTION 'Reversal journals are not new report costs or VAT'; END IF;
  IF TG_TABLE_NAME = 'voyage_costs' THEN
    IF journal_kind <> 'VOYAGE_COST' THEN RAISE EXCEPTION 'Voyage cost needs a voyage cost journal'; END IF;
    IF NEW."manifestId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "manifests" WHERE "id" = NEW."manifestId" AND "voyageId" = NEW."voyageId") THEN
      RAISE EXCEPTION 'Cost manifest does not belong to voyage';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM "expense_input_taxes" WHERE "journalId" = NEW."journalId") THEN
      RAISE EXCEPTION 'Voyage cost requires explicit input VAT classification (including zero)';
    END IF;
    SELECT COALESCE(SUM(l."debit"), 0), COALESCE(SUM(l."baseDebit"), 0)
      INTO exp_debit, exp_base FROM "journal_lines" l JOIN "accounts" a ON a."id" = l."accountId"
      WHERE l."journalId" = NEW."journalId" AND a."type" = 'EXPENSE';
    IF exp_debit <> NEW."netAmount" OR exp_base <> NEW."baseNetAmount" THEN
      RAISE EXCEPTION 'Voyage cost net must match posted expense-account debits';
    END IF;
  ELSIF TG_TABLE_NAME = 'expense_input_taxes' THEN
    IF journal_kind NOT IN ('OFFICE_EXPENSE', 'VOYAGE_COST') THEN
      RAISE EXCEPTION 'Input VAT requires a posted expense journal';
    END IF;
    IF NEW."amount" > 0 AND NOT EXISTS (
      SELECT 1 FROM "journal_lines" l JOIN "accounts" a ON a."id" = l."accountId"
      WHERE l."journalId" = NEW."journalId" AND l."accountId" = NEW."taxAccountId"
        AND a."type" = 'ASSET' AND l."debit" = NEW."amount" AND l."baseDebit" = NEW."baseAmount") THEN
      RAISE EXCEPTION 'Input VAT must match a posted VAT asset debit in original and base currency';
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER phase7_cost_matches_journal AFTER INSERT ON "voyage_costs"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase7_report_fact_matches_journal();
CREATE CONSTRAINT TRIGGER phase7_tax_matches_journal AFTER INSERT ON "expense_input_taxes"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase7_report_fact_matches_journal();

CREATE TABLE "saved_reports" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "definition" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "saved_reports_createdById_idx" ON "saved_reports"("createdById");
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "customer_statement_issues" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "customerId" TEXT NOT NULL,
  "currencyCode" TEXT NOT NULL,
  "periodFrom" TIMESTAMP(3) NOT NULL,
  "periodTo" TIMESTAMP(3) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_statement_issues_period_check" CHECK ("periodFrom" <= "periodTo")
);
CREATE INDEX "customer_statement_issues_customerId_currencyCode_createdAt_idx"
  ON "customer_statement_issues"("customerId","currencyCode","createdAt");
ALTER TABLE "customer_statement_issues" ADD CONSTRAINT "customer_statement_issues_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_statement_issues" ADD CONSTRAINT "customer_statement_issues_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TRIGGER phase7_statement_immutable BEFORE UPDATE OR DELETE ON "customer_statement_issues"
  FOR EACH ROW EXECUTE FUNCTION phase7_posted_fact_immutable();

-- ==========================================================================
-- source: 20261016010000_phase9_configuration
-- ==========================================================================
-- Phase 9: additive configuration. No existing records, statuses, numbers,
-- permissions or historical document output are rewritten.
CREATE TABLE "ConfigOptionList" (
    "id" TEXT NOT NULL PRIMARY KEY, "code" TEXT NOT NULL, "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL,
    "updatedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigOptionList_code_key" ON "ConfigOptionList"("code");

CREATE TABLE "ConfigOption" (
    "id" TEXT NOT NULL PRIMARY KEY, "listId" TEXT NOT NULL, "code" TEXT NOT NULL,
    "label" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigOption_listId_code_key" ON "ConfigOption"("listId", "code");
CREATE INDEX "ConfigOption_listId_isActive_idx" ON "ConfigOption"("listId", "isActive");
ALTER TABLE "ConfigOption" ADD CONSTRAINT "ConfigOption_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "ConfigOptionList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigField" (
    "id" TEXT NOT NULL PRIMARY KEY, "scope" TEXT NOT NULL, "key" TEXT NOT NULL,
    "label" TEXT NOT NULL, "kind" TEXT NOT NULL, "required" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL DEFAULT '{}', "optionListId" TEXT,
    "displayLocation" TEXT NOT NULL DEFAULT 'detail', "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visibility" JSONB NOT NULL DEFAULT '{}', "viewPermission" TEXT, "editPermission" TEXT,
    "searchable" BOOLEAN NOT NULL DEFAULT false, "filterable" BOOLEAN NOT NULL DEFAULT false,
    "reportable" BOOLEAN NOT NULL DEFAULT false, "exportable" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "effectiveUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true, "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL, "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigField_scope_key_key" ON "ConfigField"("scope", "key");
CREATE INDEX "ConfigField_scope_isActive_sortOrder_idx" ON "ConfigField"("scope", "isActive", "sortOrder");
CREATE INDEX "ConfigField_optionListId_idx" ON "ConfigField"("optionListId");
ALTER TABLE "ConfigField" ADD CONSTRAINT "ConfigField_optionListId_fkey"
    FOREIGN KEY ("optionListId") REFERENCES "ConfigOptionList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigFieldRevision" (
    "id" TEXT NOT NULL PRIMARY KEY, "fieldId" TEXT NOT NULL,
    "version" INTEGER NOT NULL, "definition" JSONB NOT NULL,
    "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ConfigFieldRevision_fieldId_version_key" ON "ConfigFieldRevision"("fieldId", "version");
ALTER TABLE "ConfigFieldRevision" ADD CONSTRAINT "ConfigFieldRevision_fieldId_fkey"
    FOREIGN KEY ("fieldId") REFERENCES "ConfigField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY, "fieldId" TEXT NOT NULL, "scope" TEXT NOT NULL,
    "recordId" TEXT NOT NULL, "value" JSONB NOT NULL, "searchText" TEXT,
    "fieldSnapshot" JSONB NOT NULL, "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigFieldValue_fieldId_recordId_key" ON "ConfigFieldValue"("fieldId", "recordId");
CREATE INDEX "ConfigFieldValue_scope_recordId_idx" ON "ConfigFieldValue"("scope", "recordId");
CREATE INDEX "ConfigFieldValue_fieldId_searchText_idx" ON "ConfigFieldValue"("fieldId", "searchText");
ALTER TABLE "ConfigFieldValue" ADD CONSTRAINT "ConfigFieldValue_fieldId_fkey"
    FOREIGN KEY ("fieldId") REFERENCES "ConfigField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigFieldValueRevision" (
    "id" TEXT NOT NULL PRIMARY KEY, "valueId" TEXT NOT NULL,
    "value" JSONB NOT NULL, "snapshot" JSONB NOT NULL,
    "actorId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ConfigFieldValueRevision_valueId_createdAt_idx" ON "ConfigFieldValueRevision"("valueId", "createdAt");
ALTER TABLE "ConfigFieldValueRevision" ADD CONSTRAINT "ConfigFieldValueRevision_valueId_fkey"
    FOREIGN KEY ("valueId") REFERENCES "ConfigFieldValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigDocumentType" (
    "id" TEXT NOT NULL PRIMARY KEY, "code" TEXT NOT NULL, "isCore" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT false, "currentVersionId" TEXT,
    "createdById" TEXT NOT NULL, "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigDocumentType_code_key" ON "ConfigDocumentType"("code");
CREATE INDEX "ConfigDocumentType_isActive_idx" ON "ConfigDocumentType"("isActive");

CREATE TABLE "ConfigDocumentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY, "typeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL, "definition" JSONB NOT NULL,
    "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ConfigDocumentVersion_typeId_version_key" ON "ConfigDocumentVersion"("typeId", "version");
ALTER TABLE "ConfigDocumentVersion" ADD CONSTRAINT "ConfigDocumentVersion_typeId_fkey"
    FOREIGN KEY ("typeId") REFERENCES "ConfigDocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigWorkflow" (
    "id" TEXT NOT NULL PRIMARY KEY, "scope" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT false,
    "currentVersionId" TEXT, "createdById" TEXT NOT NULL, "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigWorkflow_scope_key" ON "ConfigWorkflow"("scope");

CREATE TABLE "ConfigWorkflowVersion" (
    "id" TEXT NOT NULL PRIMARY KEY, "workflowId" TEXT NOT NULL, "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL, "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ConfigWorkflowVersion_workflowId_version_key" ON "ConfigWorkflowVersion"("workflowId", "version");
ALTER TABLE "ConfigWorkflowVersion" ADD CONSTRAINT "ConfigWorkflowVersion_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "ConfigWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigDocument" (
    "id" TEXT NOT NULL PRIMARY KEY, "typeId" TEXT NOT NULL, "versionId" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL, "number" TEXT NOT NULL, "status" TEXT NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}', "links" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 1, "issuedAt" TIMESTAMP(3), "issueSnapshot" JSONB,
    "createdById" TEXT NOT NULL, "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigDocument_typeId_number_key" ON "ConfigDocument"("typeId", "number");
CREATE INDEX "ConfigDocument_typeId_status_idx" ON "ConfigDocument"("typeId", "status");
ALTER TABLE "ConfigDocument" ADD CONSTRAINT "ConfigDocument_typeId_fkey"
    FOREIGN KEY ("typeId") REFERENCES "ConfigDocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfigDocument" ADD CONSTRAINT "ConfigDocument_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "ConfigDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfigDocument" ADD CONSTRAINT "ConfigDocument_workflowVersionId_fkey"
    FOREIGN KEY ("workflowVersionId") REFERENCES "ConfigWorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigDocumentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY, "documentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL, "kind" TEXT NOT NULL,
    "beforeData" JSONB, "afterData" JSONB, "reason" TEXT, "approvalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ConfigDocumentEvent_documentId_createdAt_idx" ON "ConfigDocumentEvent"("documentId", "createdAt");
ALTER TABLE "ConfigDocumentEvent" ADD CONSTRAINT "ConfigDocumentEvent_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "ConfigDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigApproval" (
    "id" TEXT NOT NULL PRIMARY KEY, "workflowVersionId" TEXT NOT NULL,
    "scope" TEXT NOT NULL, "recordId" TEXT NOT NULL, "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL, "context" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'PENDING', "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT, "decidedAt" TIMESTAMP(3), "decisionNote" TEXT,
    "consumedAt" TIMESTAMP(3),
    CONSTRAINT "ConfigApproval_status_check" CHECK ("status" IN ('PENDING','APPROVED','REJECTED','CONSUMED','EXPIRED'))
);
CREATE INDEX "ConfigApproval_scope_recordId_status_idx" ON "ConfigApproval"("scope", "recordId", "status");
CREATE INDEX "ConfigApproval_requestedById_status_idx" ON "ConfigApproval"("requestedById", "status");
-- Exactly one live approval per edge/record even under concurrent requests.
CREATE UNIQUE INDEX "ConfigApproval_one_open_request" ON "ConfigApproval"("scope", "recordId", "fromStatus", "toStatus")
    WHERE "status" IN ('PENDING', 'APPROVED') AND "consumedAt" IS NULL;
ALTER TABLE "ConfigApproval" ADD CONSTRAINT "ConfigApproval_workflowVersionId_fkey"
    FOREIGN KEY ("workflowVersionId") REFERENCES "ConfigWorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve immutable configuration versions, value revisions, and document
-- transition events even if an application writer accidentally calls UPDATE.
CREATE FUNCTION phase9_reject_history_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Phase 9 configuration history is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_field_revision_immutable BEFORE UPDATE OR DELETE ON "ConfigFieldRevision"
    FOR EACH ROW EXECUTE FUNCTION phase9_reject_history_change();
CREATE TRIGGER phase9_value_revision_immutable BEFORE UPDATE OR DELETE ON "ConfigFieldValueRevision"
    FOR EACH ROW EXECUTE FUNCTION phase9_reject_history_change();
CREATE TRIGGER phase9_type_version_immutable BEFORE UPDATE OR DELETE ON "ConfigDocumentVersion"
    FOR EACH ROW EXECUTE FUNCTION phase9_reject_history_change();
CREATE TRIGGER phase9_workflow_version_immutable BEFORE UPDATE OR DELETE ON "ConfigWorkflowVersion"
    FOR EACH ROW EXECUTE FUNCTION phase9_reject_history_change();
CREATE TRIGGER phase9_document_event_immutable BEFORE UPDATE OR DELETE ON "ConfigDocumentEvent"
    FOR EACH ROW EXECUTE FUNCTION phase9_reject_history_change();

CREATE FUNCTION phase9_document_frozen() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Configured documents are retained; deletion is forbidden'; END IF;
    IF OLD."issuedAt" IS NOT NULL THEN
        RAISE EXCEPTION 'Issued configured documents are immutable';
    END IF;
    IF NEW."issuedAt" IS NOT NULL AND NEW."issueSnapshot" IS NULL THEN
        RAISE EXCEPTION 'Issuance requires a frozen output snapshot';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_document_frozen BEFORE UPDATE OR DELETE ON "ConfigDocument"
    FOR EACH ROW EXECUTE FUNCTION phase9_document_frozen();
ALTER TABLE "ConfigDocument" ADD CONSTRAINT "ConfigDocument_issueSnapshot_check"
    CHECK (("issuedAt" IS NULL AND "issueSnapshot" IS NULL)
        OR ("issuedAt" IS NOT NULL AND "issueSnapshot" IS NOT NULL));

CREATE FUNCTION phase9_definition_identity() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Configured definitions may only be deactivated'; END IF;
    IF TG_TABLE_NAME = 'ConfigOptionList' THEN
        IF OLD."code" <> NEW."code" THEN
            RAISE EXCEPTION 'Option list code is immutable';
        END IF;
    ELSIF TG_TABLE_NAME = 'ConfigDocumentType' THEN
        IF OLD."code" <> NEW."code" OR OLD."isCore" <> NEW."isCore" THEN
            RAISE EXCEPTION 'Document type identity is immutable';
        END IF;
    ELSIF TG_TABLE_NAME = 'ConfigWorkflow' THEN
        IF OLD."scope" <> NEW."scope" THEN
            RAISE EXCEPTION 'Workflow scope is immutable';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_option_list_identity BEFORE UPDATE OR DELETE ON "ConfigOptionList"
    FOR EACH ROW EXECUTE FUNCTION phase9_definition_identity();
CREATE TRIGGER phase9_document_type_identity BEFORE UPDATE OR DELETE ON "ConfigDocumentType"
    FOR EACH ROW EXECUTE FUNCTION phase9_definition_identity();
CREATE TRIGGER phase9_workflow_identity BEFORE UPDATE OR DELETE ON "ConfigWorkflow"
    FOR EACH ROW EXECUTE FUNCTION phase9_definition_identity();

CREATE FUNCTION phase9_option_identity() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Configured options may only be deactivated'; END IF;
    IF OLD."code" <> NEW."code" OR OLD."listId" <> NEW."listId" THEN
        RAISE EXCEPTION 'Option code and list are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_option_identity BEFORE UPDATE OR DELETE ON "ConfigOption"
    FOR EACH ROW EXECUTE FUNCTION phase9_option_identity();

CREATE FUNCTION phase9_field_identity() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Custom fields may only be deactivated'; END IF;
    IF OLD."scope" <> NEW."scope" OR OLD."key" <> NEW."key" OR
        OLD."kind" <> NEW."kind" OR OLD."optionListId" IS DISTINCT FROM NEW."optionListId" THEN
        RAISE EXCEPTION 'Field identity, type and option list are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_field_identity BEFORE UPDATE OR DELETE ON "ConfigField"
    FOR EACH ROW EXECUTE FUNCTION phase9_field_identity();

CREATE FUNCTION phase9_approval_final() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Approval history is retained'; END IF;
    IF OLD."status" IN ('REJECTED','CONSUMED','EXPIRED') OR
       OLD."status" = 'APPROVED' AND NEW."status" NOT IN ('CONSUMED','EXPIRED') OR
       OLD."status" = 'PENDING' AND NEW."status" NOT IN ('APPROVED','REJECTED','EXPIRED') OR
       OLD."scope" <> NEW."scope" OR OLD."recordId" <> NEW."recordId" OR
       OLD."fromStatus" <> NEW."fromStatus" OR OLD."toStatus" <> NEW."toStatus" OR
       OLD."context" IS DISTINCT FROM NEW."context" OR
       OLD."requestedById" <> NEW."requestedById" OR OLD."workflowVersionId" <> NEW."workflowVersionId" OR
       OLD."status" = 'APPROVED' AND (OLD."decidedById" IS DISTINCT FROM NEW."decidedById" OR
           OLD."decidedAt" IS DISTINCT FROM NEW."decidedAt" OR
           OLD."decisionNote" IS DISTINCT FROM NEW."decisionNote") THEN
        RAISE EXCEPTION 'Approval decision and identity cannot be rewritten';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_approval_final BEFORE UPDATE OR DELETE ON "ConfigApproval"
    FOR EACH ROW EXECUTE FUNCTION phase9_approval_final();

-- Phase-8 core archive rows stay untouched; NEW configurable-document bytes
-- cannot be rewritten by SQL even if an application bug bypasses service checks.
CREATE FUNCTION phase9_output_frozen() RETURNS trigger AS $$
BEGIN
    IF OLD."documentType" LIKE 'CUSTOM:%' THEN
        RAISE EXCEPTION 'Issued configurable output is immutable';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_output_frozen BEFORE UPDATE OR DELETE ON "DocumentRenderedOutput"
    FOR EACH ROW EXECUTE FUNCTION phase9_output_frozen();

-- ==========================================================================
-- source: 20261016090000_phase10_notifications_master_data
-- ==========================================================================
-- Phase 10: staged master-data read switch, archival and durable notifications.
-- Run the read-only Phase 10 preflight on the TARGET database before deploy.
-- Do not interpret any undocumented port code, customer role or load-list state.
-- PostgreSQL executes a Prisma migration in its own transaction only when
-- explicitly enclosed; an exception here rolls back ALL copies and drops.

-- Port names are administrator managed. No bulk updates to existing Port rows.
ALTER TABLE "Port" ADD COLUMN "displayName" TEXT;
CREATE TABLE "PortAlias" (
    "id" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortAlias_key_key" ON "PortAlias"("key");
CREATE INDEX "PortAlias_portId_idx" ON "PortAlias"("portId");
ALTER TABLE "PortAlias" ADD CONSTRAINT "PortAlias_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the four prohibited Customer values in a restricted legacy archive.
-- A commercial-role type is NOT a natural/legal person classification.
CREATE TYPE "CustomerPersonKind" AS ENUM ('NATURAL', 'LEGAL');
ALTER TABLE "Customer" ADD COLUMN "personKind" "CustomerPersonKind";
CREATE TABLE "CustomerLegacyAttribute" (
    "customerId" TEXT NOT NULL,
    "legacyType" TEXT,
    "shortName" TEXT,
    "taxId" TEXT,
    "currency" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerLegacyAttribute_pkey" PRIMARY KEY ("customerId")
);
ALTER TABLE "CustomerLegacyAttribute" ADD CONSTRAINT "CustomerLegacyAttribute_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "CustomerLegacyAttribute" ("customerId", "legacyType", "shortName", "taxId", "currency")
SELECT "id", "type", "shortName", "taxId", "currency" FROM "Customer"
WHERE "type" IS NOT NULL OR "shortName" IS NOT NULL OR "taxId" IS NOT NULL OR "currency" IS NOT NULL;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "Customer" c LEFT JOIN "CustomerLegacyAttribute" a ON a."customerId" = c."id"
    WHERE (c."type" IS NOT NULL OR c."shortName" IS NOT NULL OR c."taxId" IS NOT NULL OR c."currency" IS NOT NULL)
      AND (a."customerId" IS NULL OR a."legacyType" IS DISTINCT FROM c."type"
           OR a."shortName" IS DISTINCT FROM c."shortName" OR a."taxId" IS DISTINCT FROM c."taxId"
           OR a."currency" IS DISTINCT FROM c."currency")
  ) THEN RAISE EXCEPTION 'Customer archive comparison failed; no legacy columns were dropped'; END IF;
END $$;
DROP INDEX IF EXISTS "Customer_type_idx";
ALTER TABLE "Customer" DROP COLUMN "type", DROP COLUMN "shortName", DROP COLUMN "taxId", DROP COLUMN "currency";
CREATE INDEX "Customer_personKind_idx" ON "Customer"("personKind");

-- Canonical Cargo fields were already used by the web and downstream documents.
-- Archive *every* non-null legacy value before backfilling missing canonical
-- values. Both sides of conflicting non-null pairs remain available (archive
-- and canonical) for manual reconciliation; never choose one by guesswork.
CREATE TABLE "CargoLegacyAttribute" (
    "cargoId" TEXT NOT NULL,
    "chassis" TEXT,
    "serial" TEXT,
    "comment" TEXT,
    "units" INTEGER,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CargoLegacyAttribute_pkey" PRIMARY KEY ("cargoId")
);
ALTER TABLE "CargoLegacyAttribute" ADD CONSTRAINT "CargoLegacyAttribute_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "CargoLegacyAttribute" ("cargoId", "chassis", "serial", "comment", "units")
SELECT "id", "chassis", "serial", "comment", "units" FROM "Cargo"
WHERE "chassis" IS NOT NULL OR "serial" IS NOT NULL OR "comment" IS NOT NULL OR "units" IS NOT NULL;
UPDATE "Cargo" SET
  "chassisNumber" = COALESCE(NULLIF(BTRIM("chassisNumber"), ''), NULLIF(BTRIM("chassis"), '')),
  "serialNumber"  = COALESCE(NULLIF(BTRIM("serialNumber"), ''), NULLIF(BTRIM("serial"), '')),
  "comments"      = COALESCE(NULLIF(BTRIM("comments"), ''), NULLIF(BTRIM("comment"), '')),
  "quantity"      = COALESCE("quantity", CASE WHEN "units" > 0 THEN "units" ELSE NULL END)
WHERE "chassis" IS NOT NULL OR "serial" IS NOT NULL OR "comment" IS NOT NULL OR "units" IS NOT NULL;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "Cargo" c LEFT JOIN "CargoLegacyAttribute" a ON a."cargoId" = c."id"
    WHERE (c."chassis" IS NOT NULL OR c."serial" IS NOT NULL OR c."comment" IS NOT NULL OR c."units" IS NOT NULL)
      AND (a."cargoId" IS NULL OR a."chassis" IS DISTINCT FROM c."chassis"
           OR a."serial" IS DISTINCT FROM c."serial" OR a."comment" IS DISTINCT FROM c."comment" OR a."units" IS DISTINCT FROM c."units")
  ) THEN RAISE EXCEPTION 'Cargo archive comparison failed; no legacy columns were dropped'; END IF;
END $$;
-- Old columns intentionally remain in the table through the read-switch release.
-- API/Prisma stop writing/reading them. A separately gated contract script
-- checks row-by-row equivalence again before physical removal (after acceptance).
CREATE TYPE "CargoDocumentStatus" AS ENUM ('EXID', 'BCC', 'LOCAL_TRANSFER');
ALTER TABLE "Cargo" ADD COLUMN "documentStatus" "CargoDocumentStatus";
CREATE TABLE "CargoIntakeDocument" (
    "id" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "reference" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CargoIntakeDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CargoIntakeDocument_cargoId_idx" ON "CargoIntakeDocument"("cargoId");
ALTER TABLE "CargoIntakeDocument" ADD CONSTRAINT "CargoIntakeDocument_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- IMO already was optional. Fleet ownership and per-voyage chartering are
-- independent, nullable classifications for historical rows.
CREATE TYPE "VesselOwnership" AS ENUM ('OWNED', 'VOYAGE_CHARTER', 'TIME_CHARTER', 'OTHER');
ALTER TABLE "Vessel" ADD COLUMN "ownership" "VesselOwnership";
ALTER TABLE "Voyage" ADD COLUMN "vesselUse" "VesselOwnership";

-- ADR-041: leave LoadListStatus (all SIX original values) and every
-- historical LoadList row untouched. Application transitions now write only
-- DRAFT / FINALIZED / CANCELLED; contraction requires owner-verified mapping.
-- ActualLoadingStatus is a separate lifecycle and remains unchanged.

CREATE TYPE "NotificationTrigger" AS ENUM ('OVERDUE_INVOICE', 'PENDING_APPROVAL', 'JOB_STATUS_CHANGED', 'UNPAID_RELEASE', 'CARGO_DOCUMENT_PENDING');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'DELIVERED', 'FAILED', 'SUPPRESSED');
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "trigger" "NotificationTrigger" NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "recipients" JSONB NOT NULL,
    "channels" JSONB NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "repeatMinutes" INTEGER,
    "maxPerRecord" INTEGER NOT NULL DEFAULT 1,
    "maxPerDay" INTEGER,
    "escalateAfterMinutes" INTEGER,
    "escalationRecipients" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NotificationRule_limits_check" CHECK (
      "delayMinutes" >= 0 AND "maxPerRecord" > 0 AND
      ("repeatMinutes" IS NULL OR "repeatMinutes" > 0) AND
      ("maxPerDay" IS NULL OR "maxPerDay" > 0) AND
      ("escalateAfterMinutes" IS NULL OR "escalateAfterMinutes" > 0))
);
CREATE INDEX "NotificationRule_trigger_isActive_idx" ON "NotificationRule"("trigger", "isActive");
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "baseAt" TIMESTAMP(3) NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "cycle" INTEGER NOT NULL DEFAULT 0,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationEvent_ruleId_eventKey_key" ON "NotificationEvent"("ruleId", "eventKey");
CREATE INDEX "NotificationEvent_status_nextRunAt_idx" ON "NotificationEvent"("status", "nextRunAt");
CREATE INDEX "NotificationEvent_ruleId_sourceId_idx" ON "NotificationEvent"("ruleId", "sourceId");
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "NotificationRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "NotificationInbox" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "cycle" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationInbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationInbox_eventId_userId_stage_cycle_key" ON "NotificationInbox"("eventId", "userId", "stage", "cycle");
CREATE INDEX "NotificationInbox_userId_createdAt_idx" ON "NotificationInbox"("userId", "createdAt");
ALTER TABLE "NotificationInbox" ADD CONSTRAINT "NotificationInbox_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "NotificationRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationInbox" ADD CONSTRAINT "NotificationInbox_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationInbox" ADD CONSTRAINT "NotificationInbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "inboxId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastErrorCode" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationDelivery_inboxId_channel_key" ON "NotificationDelivery"("inboxId", "channel");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "NotificationInbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ==========================================================================
-- source: 20261016110000_phase11_audit_append_only
-- ==========================================================================
-- Phase 11 / DEC-047: append-only audit rows, including TRUNCATE protection.
-- Existing rows are never copied, rewritten, or deleted. In addition to this
-- defense in depth, deploy with a non-owner, non-superuser runtime role whose
-- UPDATE/DELETE/TRUNCATE privileges are revoked (see
-- docs/duna-analysis/09-audit/phase11-security-audit-2026-10-16.md).
CREATE FUNCTION public.phase11_reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: UPDATE, DELETE and TRUNCATE are prohibited'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER phase11_audit_no_update_delete
  BEFORE UPDATE OR DELETE ON public."AuditLog"
  FOR EACH ROW EXECUTE FUNCTION public.phase11_reject_audit_mutation();
CREATE TRIGGER phase11_audit_no_truncate
  BEFORE TRUNCATE ON public."AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION public.phase11_reject_audit_mutation();
ALTER TABLE public."AuditLog" ENABLE ALWAYS TRIGGER phase11_audit_no_update_delete;
ALTER TABLE public."AuditLog" ENABLE ALWAYS TRIGGER phase11_audit_no_truncate;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."AuditLog" FROM PUBLIC;
COMMENT ON TABLE public."AuditLog" IS 'Phase 11: immutable audit history. Runtime role may SELECT/INSERT only; never UPDATE, DELETE or TRUNCATE.';

-- ==========================================================================
-- source: 20261017120000_phase12_archive_retention
-- ==========================================================================
-- Phase 12: additive policy vocabulary. No period, archive criterion, data
-- rewrite, deletion or backup schedule is inferred from this migration.
ALTER TABLE public."letters" ADD COLUMN "archivedFromStatus" public."LetterStatus";
CREATE TABLE public."RetentionPolicy" (
  "scope" varchar(40) NOT NULL PRIMARY KEY,
  "minimumDays" integer,
  "archiveAfterDays" integer,
  "secureDeleteAfterDays" integer,
  "authority" varchar(500),
  "lawfulBasis" varchar(500),
  "updatedById" text NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RetentionPolicy_scope_check" CHECK ("scope" IN
    ('LETTER', 'IDENTITY_DOCUMENT', 'DOCUMENT_ASSET', 'DOCUMENT_TEMPLATE',
     'ISSUED_OUTPUT', 'FINANCE', 'AUDIT')),
  CONSTRAINT "RetentionPolicy_archive_check" CHECK
    ("archiveAfterDays" IS NULL OR ("scope" = 'LETTER' AND "archiveAfterDays" BETWEEN 1 AND 365000
      AND "authority" IS NOT NULL AND length(btrim("authority")) >= 10)),
  CONSTRAINT "RetentionPolicy_minimum_check" CHECK
    ("minimumDays" IS NULL OR ("minimumDays" BETWEEN 1 AND 365000
      AND "authority" IS NOT NULL AND length(btrim("authority")) >= 10)),
  CONSTRAINT "RetentionPolicy_identity_check" CHECK
    ("scope" <> 'IDENTITY_DOCUMENT' OR "minimumDays" IS NULL OR
      ("lawfulBasis" IS NOT NULL AND length(btrim("lawfulBasis")) >= 10)),
  CONSTRAINT "RetentionPolicy_purge_check" CHECK
    ("secureDeleteAfterDays" IS NULL OR
      ("minimumDays" IS NOT NULL AND "secureDeleteAfterDays" BETWEEN "minimumDays" AND 365000))
);

-- An administrator may increase a floor but cannot silently lower/remove one.
-- Changes needing a lower compliance floor require a separately reviewed DBA
-- migration. The configured secure-delete threshold never starts a purge job.
CREATE FUNCTION public.phase12_protect_retention_policy()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'RetentionPolicy cannot be deleted or truncated'
      USING ERRCODE = '42501';
  END IF;
  IF NEW."scope" IS DISTINCT FROM OLD."scope" THEN
    RAISE EXCEPTION 'Retention scope cannot be reassigned' USING ERRCODE = '42501';
  END IF;
  IF OLD."minimumDays" IS NOT NULL AND
      (NEW."minimumDays" IS NULL OR NEW."minimumDays" < OLD."minimumDays") THEN
    RAISE EXCEPTION 'Retention minimum may not be reduced' USING ERRCODE = '42501';
  END IF;
  IF OLD."secureDeleteAfterDays" IS NOT NULL AND
      (NEW."secureDeleteAfterDays" IS NULL OR NEW."secureDeleteAfterDays" < OLD."secureDeleteAfterDays") THEN
    RAISE EXCEPTION 'Secure deletion threshold may not be reduced' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER phase12_retention_no_reduction
  BEFORE UPDATE OR DELETE ON public."RetentionPolicy"
  FOR EACH ROW EXECUTE FUNCTION public.phase12_protect_retention_policy();
CREATE TRIGGER phase12_retention_no_truncate
  BEFORE TRUNCATE ON public."RetentionPolicy"
  FOR EACH STATEMENT EXECUTE FUNCTION public.phase12_protect_retention_policy();
ALTER TABLE public."RetentionPolicy" ENABLE ALWAYS TRIGGER phase12_retention_no_reduction;
ALTER TABLE public."RetentionPolicy" ENABLE ALWAYS TRIGGER phase12_retention_no_truncate;
REVOKE ALL ON public."RetentionPolicy" FROM PUBLIC;
-- The existing Phase 11 non-owner runtime identity must be reverified before
-- deploy. A fresh development database without that role is still migratable;
-- the deployment postflight explicitly checks the reviewed runtime grants.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'shipping_runtime_p11') THEN
    GRANT SELECT, INSERT, UPDATE ON public."RetentionPolicy" TO shipping_runtime_p11;
    REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public."RetentionPolicy" FROM shipping_runtime_p11;
  END IF;
END;
$$;
COMMENT ON TABLE public."RetentionPolicy" IS
  'Phase 12 compliance-configured floors and archive criterion. No seeded periods or physical-delete authority.';

-- A letter reopened to DRAFT is not a new record. A later delete_draft
-- must not erase its archive/retention obligations, even if a caller skips
-- the service guard. The existing non-owner API role has no hard DELETE grant.
CREATE FUNCTION public.phase12_protect_archived_letter()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" AND NEW."deletedAt" IS NOT NULL AND
      (OLD."status" <> 'DRAFT' OR OLD."archivedFromStatus" IS NOT NULL OR EXISTS (
        SELECT 1 FROM public."AuditLog" a WHERE a."entityType" = 'Letter'
          AND a."entityId" = OLD."id" AND a."action" = 'letter.archive') OR EXISTS (
        SELECT 1 FROM public."RetentionPolicy" p WHERE p."scope" = 'LETTER'
          AND p."minimumDays" IS NOT NULL
          AND GREATEST(OLD."createdAt", OLD."letterDate") >
            (clock_timestamp() AT TIME ZONE 'UTC') - p."minimumDays" * INTERVAL '1 day')) THEN
    RAISE EXCEPTION 'Archived or issued letter cannot be deleted'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER phase12_letter_no_archive_delete_bypass
  BEFORE UPDATE OF "deletedAt" ON public."letters"
  FOR EACH ROW EXECUTE FUNCTION public.phase12_protect_archived_letter();
ALTER TABLE public."letters" ENABLE ALWAYS TRIGGER phase12_letter_no_archive_delete_bypass;


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

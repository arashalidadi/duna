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

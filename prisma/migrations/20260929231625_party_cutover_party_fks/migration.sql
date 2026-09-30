-- Phase 2 — B/L/Manifest party reference cutover (party-cutover-plan.md §2; task-unit 1).
--
-- Additive/declarative + repoint, non-destructive to rows:
--   1) declare shippers/consignees/agents guarded (pre-existing replay gap: these tables exist
--      in NO migration file — plan §9; "agents" is also declared by 20260929212803_portal_agent_linkage,
--      so its declaration here is a guarded no-op),
--   2) declare the Cargo party columns/indexes/FKs guarded (live already — replay-completeness
--      no-ops, plan §2.4 / evidence §1.4),
--   3) DROP the 5 old manifest/B-L party FKs to "Customer",
--   4) NULL the 12 unmigratable FK values (6 rows; pre-flight proved 0/12 match any master →
--      non-blocking; rows keep their free-text notifyParty),
--   5) ADD the new FKs to shippers/consignees/agents (Prisma naming, ON DELETE SET NULL /
--      ON UPDATE CASCADE — matches live defs captured in the log).
-- File order is drop → null → add (the validating order; plan §2.1–§2.3 is conceptual).

-- =========================================================================
-- 1) Master tables (exact live shape: 12 columns each)
-- =========================================================================
CREATE TABLE IF NOT EXISTS "shippers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Shipper_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Shipper_code_key" ON "shippers"("code");
CREATE INDEX IF NOT EXISTS "Shipper_code_idx" ON "shippers"("code");
CREATE INDEX IF NOT EXISTS "Shipper_name_idx" ON "shippers"("name");
CREATE INDEX IF NOT EXISTS "Shipper_isActive_idx" ON "shippers"("isActive");

CREATE TABLE IF NOT EXISTS "consignees" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Consignee_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Consignee_code_key" ON "consignees"("code");
CREATE INDEX IF NOT EXISTS "Consignee_code_idx" ON "consignees"("code");
CREATE INDEX IF NOT EXISTS "Consignee_name_idx" ON "consignees"("name");
CREATE INDEX IF NOT EXISTS "Consignee_isActive_idx" ON "consignees"("isActive");

CREATE TABLE IF NOT EXISTS "agents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Agent_code_key" ON "agents"("code");
CREATE INDEX IF NOT EXISTS "Agent_code_idx" ON "agents"("code");
CREATE INDEX IF NOT EXISTS "Agent_name_idx" ON "agents"("name");
CREATE INDEX IF NOT EXISTS "Agent_isActive_idx" ON "agents"("isActive");

-- =========================================================================
-- 2) Cargo party FKs/columns (schema.prisma:424-425,463-464,479-480) — no-ops on live DB
-- =========================================================================
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "shipperId" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "consigneeId" TEXT;
CREATE INDEX IF NOT EXISTS "Cargo_shipperId_idx" ON "Cargo"("shipperId");
CREATE INDEX IF NOT EXISTS "Cargo_consigneeId_idx" ON "Cargo"("consigneeId");
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cargo_shipperId_fkey') THEN
        ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_shipperId_fkey"
            FOREIGN KEY ("shipperId") REFERENCES "shippers"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cargo_consigneeId_fkey') THEN
        ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_consigneeId_fkey"
            FOREIGN KEY ("consigneeId") REFERENCES "consignees"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- =========================================================================
-- 3) Drop the old party FKs to "Customer" (columns kept)
-- =========================================================================
ALTER TABLE "manifests" DROP CONSTRAINT IF EXISTS "manifests_shipperId_fkey";
ALTER TABLE "manifests" DROP CONSTRAINT IF EXISTS "manifests_consigneeId_fkey";
ALTER TABLE "manifests" DROP CONSTRAINT IF EXISTS "manifests_agentId_fkey";
ALTER TABLE "bills_of_lading" DROP CONSTRAINT IF EXISTS "bills_of_lading_shipperId_fkey";
ALTER TABLE "bills_of_lading" DROP CONSTRAINT IF EXISTS "bills_of_lading_consigneeId_fkey";

-- =========================================================================
-- 4) Null the unmigratable values (idempotent: second run matches 0 rows).
--    Pre-flight (this log): 12 non-null values across 6 rows, 0/12 match any
--    master under name/taxId/code heuristics → cannot be remapped; accepted
--    greenfield consequence (plan §1). notifyParty free text is untouched.
-- =========================================================================
UPDATE "manifests"
   SET "shipperId" = NULL, "consigneeId" = NULL, "agentId" = NULL
 WHERE "shipperId" IS NOT NULL OR "consigneeId" IS NOT NULL OR "agentId" IS NOT NULL;

UPDATE "bills_of_lading"
   SET "shipperId" = NULL, "consigneeId" = NULL
 WHERE "shipperId" IS NOT NULL OR "consigneeId" IS NOT NULL;

-- =========================================================================
-- 5) New FKs to the master tables (Prisma names reused)
-- =========================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manifests_shipperId_fkey') THEN
        ALTER TABLE "manifests" ADD CONSTRAINT "manifests_shipperId_fkey"
            FOREIGN KEY ("shipperId") REFERENCES "shippers"("id")
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manifests_consigneeId_fkey') THEN
        ALTER TABLE "manifests" ADD CONSTRAINT "manifests_consigneeId_fkey"
            FOREIGN KEY ("consigneeId") REFERENCES "consignees"("id")
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manifests_agentId_fkey') THEN
        ALTER TABLE "manifests" ADD CONSTRAINT "manifests_agentId_fkey"
            FOREIGN KEY ("agentId") REFERENCES "agents"("id")
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bills_of_lading_shipperId_fkey') THEN
        ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_shipperId_fkey"
            FOREIGN KEY ("shipperId") REFERENCES "shippers"("id")
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bills_of_lading_consigneeId_fkey') THEN
        ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_consigneeId_fkey"
            FOREIGN KEY ("consigneeId") REFERENCES "consignees"("id")
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- Phase 2 — Portal agent linkage (party-cutover-plan.md §3 addendum + §8 item 0).
--
-- ADDITIVE ONLY: adds User.portalAgentId (nullable, unique) FK -> Agent master.
-- User.portalCustomerId is retained unchanged (bookings/statement stay
-- Customer-scoped); portal manifest scoping moves to portalAgentId in code.
--
-- Guarded so the migration is replay-safe on this database AND complete on a
-- fresh replay:
--   * "agents" is declared here because it exists in NO migration file (pre-existing
--     replay gap; party-cutover-plan.md §9 records the same gap for the cutover
--     unit, whose guarded declaration then no-ops).
--   * column / unique index / FK use IF NOT EXISTS / pg_constraint guards.

-- 1) Agent master table (matches schema.prisma Agent model + live shape)
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

-- 2) User.portalAgentId — nullable + unique (Prisma naming)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "portalAgentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_portalAgentId_key" ON "User"("portalAgentId");

-- 3) FK -> Agent (Prisma default for an optional relation: SET NULL / CASCADE update)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_portalAgentId_fkey') THEN
        ALTER TABLE "User" ADD CONSTRAINT "User_portalAgentId_fkey"
            FOREIGN KEY ("portalAgentId") REFERENCES "agents"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

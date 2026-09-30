-- Phase 2 - Voyage per-destination numbering.
-- docs/current-plan/01-final-requirements.md:58-64: voyage numbering is per
-- destination (1/26, 2/26 per destination per year); 04-final-data-model.md:44.
--
-- Additive only: creates the VoyageDestination legs table, then backfills ONE
-- leg per existing voyage (legNumber = 1, voyageNumber = the existing parent
-- voyageNumber) so no historical number changes and no voyage row is rewritten.
-- Every statement is guarded so the migration is replay-safe (idempotent).

-- 1) Legs table
CREATE TABLE IF NOT EXISTS "VoyageDestination" (
    "id" TEXT NOT NULL,
    "voyageId" TEXT NOT NULL,
    "destinationPortId" TEXT NOT NULL,
    "legNumber" INTEGER NOT NULL,
    "voyageNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VoyageDestination_pkey" PRIMARY KEY ("id")
);

-- 2) Indexes (Prisma naming, from migrate diff)
CREATE INDEX IF NOT EXISTS "VoyageDestination_voyageId_idx" ON "VoyageDestination"("voyageId");
CREATE INDEX IF NOT EXISTS "VoyageDestination_destinationPortId_idx" ON "VoyageDestination"("destinationPortId");
CREATE INDEX IF NOT EXISTS "VoyageDestination_createdAt_idx" ON "VoyageDestination"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "VoyageDestination_destinationPortId_voyageNumber_key" ON "VoyageDestination"("destinationPortId", "voyageNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "VoyageDestination_voyageId_destinationPortId_key" ON "VoyageDestination"("voyageId", "destinationPortId");

-- 3) Foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VoyageDestination_voyageId_fkey') THEN
        ALTER TABLE "VoyageDestination" ADD CONSTRAINT "VoyageDestination_voyageId_fkey"
            FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VoyageDestination_destinationPortId_fkey') THEN
        ALTER TABLE "VoyageDestination" ADD CONSTRAINT "VoyageDestination_destinationPortId_fkey"
            FOREIGN KEY ("destinationPortId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- 4) Backfill: one leg per voyage that has no leg yet (idempotent).
--    legNumber = 1, voyageNumber = the voyage's existing number (preserved).
INSERT INTO "VoyageDestination"
    ("id", "voyageId", "destinationPortId", "legNumber", "voyageNumber", "createdAt", "updatedAt")
SELECT
    replace(gen_random_uuid()::text, '-', ''),
    v."id",
    v."destinationPortId",
    1,
    v."voyageNumber",
    NOW(),
    NOW()
FROM "Voyage" v
WHERE NOT EXISTS (
    SELECT 1 FROM "VoyageDestination" vd WHERE vd."voyageId" = v."id"
);

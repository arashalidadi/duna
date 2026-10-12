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

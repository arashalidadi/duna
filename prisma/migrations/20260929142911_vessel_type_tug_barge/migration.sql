-- Phase 2 — Vessel type & tug/barge modeling.
-- docs/current-plan/01-final-requirements.md:56-57: "Vessel types include Tug,
-- Barge, Landing Craft, and regular Vessel. Tug and Barge may be recorded as a
-- pair with two names."
--
-- Additive and idempotent: every statement is guarded so this migration is a
-- no-op on the live database (where these objects already exist from an
-- out-of-band change by a prior execution) and applies cleanly on a fresh
-- replay of the migration history. No existing rows are rewritten; every
-- existing Vessel keeps the type it already has.

-- 1) Extend VesselType with the three categories the plan documents require
--    alongside the existing self-propelled categories (CONTAINER, BULK,
--    TANKER, RORO, GENERAL, PROJECT, OTHER). PostgreSQL >= 12 permits ADD
--    VALUE inside the migration transaction as long as the new values are not
--    used in the same transaction (they are not).
ALTER TYPE "VesselType" ADD VALUE IF NOT EXISTS 'TUG';
ALTER TYPE "VesselType" ADD VALUE IF NOT EXISTS 'BARGE';
ALTER TYPE "VesselType" ADD VALUE IF NOT EXISTS 'LANDING_CRAFT';

-- 2) Optional per-voyage tug/barge pairing (nullable FK columns; NULL means
--    the voyage is a plain self-propelled sailing — the shape every existing
--    voyage already has).
ALTER TABLE "Voyage" ADD COLUMN IF NOT EXISTS "tugVesselId" TEXT;
ALTER TABLE "Voyage" ADD COLUMN IF NOT EXISTS "bargeVesselId" TEXT;

-- 3) Indexes for the pairing columns (Prisma naming convention).
CREATE INDEX IF NOT EXISTS "Voyage_tugVesselId_idx" ON "Voyage"("tugVesselId");
CREATE INDEX IF NOT EXISTS "Voyage_bargeVesselId_idx" ON "Voyage"("bargeVesselId");

-- 4) Pairing foreign keys with the referential actions Prisma declares for
--    optional relations (ON DELETE SET NULL — deleting a tug/barge never
--    deletes the voyage; ON UPDATE CASCADE). Dropped and re-added so the live
--    database converges on the schema-declared definition; this touches only
--    the constraint, never row data.
ALTER TABLE "Voyage" DROP CONSTRAINT IF EXISTS "Voyage_tugVesselId_fkey";
ALTER TABLE "Voyage" ADD CONSTRAINT "Voyage_tugVesselId_fkey"
    FOREIGN KEY ("tugVesselId") REFERENCES "Vessel"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Voyage" DROP CONSTRAINT IF EXISTS "Voyage_bargeVesselId_fkey";
ALTER TABLE "Voyage" ADD CONSTRAINT "Voyage_bargeVesselId_fkey"
    FOREIGN KEY ("bargeVesselId") REFERENCES "Vessel"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

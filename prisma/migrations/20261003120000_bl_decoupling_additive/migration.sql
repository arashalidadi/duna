-- Phase 4 unit 2 (P4-U2) — B/L decoupling, ADDITIVE ONLY (ADR-045 decision 1).
-- Generated with `prisma migrate diff --from-migrations --to-schema-datamodel --script`
-- against a scratch shadow DB, then extended with the idempotent data backfills.
-- No columns are dropped; the FK drop/re-add pairs are Postgres' only way to change
-- nullability (they become ON DELETE SET NULL, matching the new optional legacy linkage).

-- DropForeignKey (required to relax nullability + switch to SET NULL)
ALTER TABLE "bills_of_lading" DROP CONSTRAINT "bills_of_lading_manifestId_fkey";

-- DropForeignKey
ALTER TABLE "bills_of_lading_items" DROP CONSTRAINT "bills_of_lading_items_manifestItemId_fkey";

-- AlterTable
ALTER TABLE "bills_of_lading" ADD COLUMN IF NOT EXISTS "destinationPortId" TEXT,
ALTER COLUMN "manifestId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "bills_of_lading_items" ALTER COLUMN "manifestItemId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bills_of_lading_destinationPortId_idx" ON "bills_of_lading"("destinationPortId");

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "manifests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading_items" ADD CONSTRAINT "bills_of_lading_items_manifestItemId_fkey" FOREIGN KEY ("manifestItemId") REFERENCES "manifest_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data backfills (idempotent UPDATEs; no schema)
-- 1) Existing B/L items' cargoId from their manifest line (ManifestItem.cargoId is
--    REQUIRED, so this is a clean per-row copy; no-op where already populated).
UPDATE "bills_of_lading_items" bli
SET "cargoId" = mi."cargoId"
FROM "manifest_items" mi
WHERE bli."manifestItemId" = mi.id
  AND bli."cargoId" IS NULL;

-- 2) Existing bills' destinationPortId (the P4-U3 numbering scope key) from their voyage.
UPDATE "bills_of_lading" bl
SET "destinationPortId" = v."destinationPortId"
FROM "Voyage" v
WHERE bl."voyageId" = v.id
  AND bl."destinationPortId" IS NULL;

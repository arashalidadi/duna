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


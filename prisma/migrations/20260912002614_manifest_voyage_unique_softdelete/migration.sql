-- DropIndex
DROP INDEX "manifests_voyageId_key";

-- CreateIndex
CREATE INDEX "manifests_voyageId_idx" ON "manifests"("voyageId");

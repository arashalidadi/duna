-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "voyageId" TEXT;

-- CreateIndex
CREATE INDEX "invoices_voyageId_idx" ON "invoices"("voyageId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

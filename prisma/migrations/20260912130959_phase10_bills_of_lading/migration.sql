-- CreateEnum
CREATE TYPE "BlStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BlType" AS ENUM ('MASTER', 'HOUSE');

-- CreateEnum
CREATE TYPE "FreightTerms" AS ENUM ('PREPAID', 'COLLECT');

-- CreateTable
CREATE TABLE "bills_of_lading" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "voyageId" TEXT NOT NULL,
    "status" "BlStatus" NOT NULL DEFAULT 'DRAFT',
    "billType" "BlType" NOT NULL DEFAULT 'HOUSE',
    "vesselName" TEXT NOT NULL,
    "vesselImo" TEXT,
    "shipperId" TEXT,
    "consigneeId" TEXT,
    "notifyParty" TEXT,
    "freightTerms" "FreightTerms",
    "carrierName" TEXT,
    "placeOfIssue" TEXT,
    "dateOfIssue" TIMESTAMP(3),
    "originals" INTEGER,
    "freightAmount" DECIMAL(18,2),
    "currencyCode" TEXT,
    "goodsDescription" TEXT,
    "shipmentMarks" TEXT,
    "totalPackages" INTEGER NOT NULL DEFAULT 0,
    "totalGrossWeight" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "issuedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bills_of_lading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills_of_lading_items" (
    "id" TEXT NOT NULL,
    "billOfLadingId" TEXT NOT NULL,
    "manifestItemId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "goodsDescription" TEXT,
    "marksAndNumbers" TEXT,
    "packages" INTEGER,
    "packageType" TEXT,
    "grossWeight" DECIMAL(18,3),
    "volume" DECIMAL(18,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_of_lading_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bills_of_lading_billNumber_key" ON "bills_of_lading"("billNumber");

-- CreateIndex
CREATE INDEX "bills_of_lading_manifestId_idx" ON "bills_of_lading"("manifestId");

-- CreateIndex
CREATE INDEX "bills_of_lading_voyageId_idx" ON "bills_of_lading"("voyageId");

-- CreateIndex
CREATE INDEX "bills_of_lading_status_idx" ON "bills_of_lading"("status");

-- CreateIndex
CREATE INDEX "bills_of_lading_shipperId_idx" ON "bills_of_lading"("shipperId");

-- CreateIndex
CREATE INDEX "bills_of_lading_consigneeId_idx" ON "bills_of_lading"("consigneeId");

-- CreateIndex
CREATE INDEX "bills_of_lading_createdAt_idx" ON "bills_of_lading"("createdAt");

-- CreateIndex
CREATE INDEX "bills_of_lading_createdById_idx" ON "bills_of_lading"("createdById");

-- CreateIndex
CREATE INDEX "bills_of_lading_items_billOfLadingId_idx" ON "bills_of_lading_items"("billOfLadingId");

-- CreateIndex
CREATE INDEX "bills_of_lading_items_manifestItemId_idx" ON "bills_of_lading_items"("manifestItemId");

-- CreateIndex
CREATE INDEX "bills_of_lading_items_cargoId_idx" ON "bills_of_lading_items"("cargoId");

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "manifests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading_items" ADD CONSTRAINT "bills_of_lading_items_billOfLadingId_fkey" FOREIGN KEY ("billOfLadingId") REFERENCES "bills_of_lading"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading_items" ADD CONSTRAINT "bills_of_lading_items_manifestItemId_fkey" FOREIGN KEY ("manifestItemId") REFERENCES "manifest_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading_items" ADD CONSTRAINT "bills_of_lading_items_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

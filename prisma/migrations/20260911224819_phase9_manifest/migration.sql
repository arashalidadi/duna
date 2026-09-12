-- CreateEnum
CREATE TYPE "ManifestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "manifests" (
    "id" TEXT NOT NULL,
    "manifestNumber" TEXT NOT NULL,
    "voyageId" TEXT NOT NULL,
    "status" "ManifestStatus" NOT NULL DEFAULT 'DRAFT',
    "vesselName" TEXT NOT NULL,
    "vesselImo" TEXT,
    "polPortId" TEXT NOT NULL,
    "podPortId" TEXT NOT NULL,
    "shipperId" TEXT,
    "consigneeId" TEXT,
    "agentId" TEXT,
    "notifyParty" TEXT,
    "description" TEXT,
    "gasCost" DECIMAL(18,2),
    "lashingCost" DECIMAL(18,2),
    "shipperCost" DECIMAL(18,2),
    "podCost" DECIMAL(18,2),
    "polCost" DECIMAL(18,2),
    "currencyCode" TEXT,
    "totalWeight" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "totalPackages" INTEGER NOT NULL DEFAULT 0,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "submittedById" TEXT,
    "approvedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "manifests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manifest_items" (
    "id" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "blNumber" TEXT,
    "weight" DECIMAL(18,3),
    "quantity" INTEGER,
    "packages" INTEGER,
    "packageType" TEXT,
    "notes" TEXT,
    "actualLoadingItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manifest_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manifests_manifestNumber_key" ON "manifests"("manifestNumber");

-- CreateIndex
CREATE INDEX "manifests_manifestNumber_idx" ON "manifests"("manifestNumber");

-- CreateIndex
CREATE INDEX "manifests_status_idx" ON "manifests"("status");

-- CreateIndex
CREATE INDEX "manifests_polPortId_idx" ON "manifests"("polPortId");

-- CreateIndex
CREATE INDEX "manifests_podPortId_idx" ON "manifests"("podPortId");

-- CreateIndex
CREATE INDEX "manifests_shipperId_idx" ON "manifests"("shipperId");

-- CreateIndex
CREATE INDEX "manifests_consigneeId_idx" ON "manifests"("consigneeId");

-- CreateIndex
CREATE INDEX "manifests_createdAt_idx" ON "manifests"("createdAt");

-- CreateIndex
CREATE INDEX "manifests_createdById_idx" ON "manifests"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "manifests_voyageId_key" ON "manifests"("voyageId");

-- CreateIndex
CREATE UNIQUE INDEX "manifest_items_actualLoadingItemId_key" ON "manifest_items"("actualLoadingItemId");

-- CreateIndex
CREATE INDEX "manifest_items_manifestId_idx" ON "manifest_items"("manifestId");

-- CreateIndex
CREATE INDEX "manifest_items_cargoId_idx" ON "manifest_items"("cargoId");

-- CreateIndex
CREATE INDEX "manifest_items_sequence_idx" ON "manifest_items"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "manifest_items_manifestId_cargoId_key" ON "manifest_items"("manifestId", "cargoId");

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_polPortId_fkey" FOREIGN KEY ("polPortId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_podPortId_fkey" FOREIGN KEY ("podPortId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifest_items" ADD CONSTRAINT "manifest_items_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "manifests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifest_items" ADD CONSTRAINT "manifest_items_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

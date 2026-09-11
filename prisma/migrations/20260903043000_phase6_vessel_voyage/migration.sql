-- CreateEnum
CREATE TYPE "VesselType" AS ENUM ('CONTAINER', 'BULK', 'TANKER', 'RORO', 'GENERAL', 'PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "VoyageStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Vessel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imo" TEXT,
    "flag" TEXT NOT NULL,
    "vesselType" "VesselType" NOT NULL,
    "capacityTeu" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Vessel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voyage" (
    "id" TEXT NOT NULL,
    "voyageNumber" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "status" "VoyageStatus" NOT NULL DEFAULT 'DRAFT',
    "originPortId" TEXT NOT NULL,
    "destinationPortId" TEXT NOT NULL,
    "plannedDepartureAt" TIMESTAMP(3),
    "plannedArrivalAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voyage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vessel_code_key" ON "Vessel"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vessel_imo_key" ON "Vessel"("imo");

-- CreateIndex
CREATE INDEX "Vessel_code_idx" ON "Vessel"("code");

-- CreateIndex
CREATE INDEX "Vessel_name_idx" ON "Vessel"("name");

-- CreateIndex
CREATE INDEX "Vessel_flag_idx" ON "Vessel"("flag");

-- CreateIndex
CREATE INDEX "Vessel_vesselType_idx" ON "Vessel"("vesselType");

-- CreateIndex
CREATE INDEX "Vessel_isActive_idx" ON "Vessel"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Voyage_voyageNumber_key" ON "Voyage"("voyageNumber");

-- CreateIndex
CREATE INDEX "Voyage_voyageNumber_idx" ON "Voyage"("voyageNumber");

-- CreateIndex
CREATE INDEX "Voyage_vesselId_idx" ON "Voyage"("vesselId");

-- CreateIndex
CREATE INDEX "Voyage_status_idx" ON "Voyage"("status");

-- CreateIndex
CREATE INDEX "Voyage_originPortId_idx" ON "Voyage"("originPortId");

-- CreateIndex
CREATE INDEX "Voyage_destinationPortId_idx" ON "Voyage"("destinationPortId");

-- CreateIndex
CREATE INDEX "Voyage_plannedDepartureAt_idx" ON "Voyage"("plannedDepartureAt");

-- CreateIndex
CREATE INDEX "Voyage_plannedArrivalAt_idx" ON "Voyage"("plannedArrivalAt");

-- CreateIndex
CREATE INDEX "Voyage_createdAt_idx" ON "Voyage"("createdAt");

-- AddForeignKey
ALTER TABLE "Voyage" ADD CONSTRAINT "Voyage_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voyage" ADD CONSTRAINT "Voyage_originPortId_fkey" FOREIGN KEY ("originPortId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voyage" ADD CONSTRAINT "Voyage_destinationPortId_fkey" FOREIGN KEY ("destinationPortId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voyage" ADD CONSTRAINT "Voyage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreateEnum
CREATE TYPE "CargoStatus" AS ENUM ('REGISTERED', 'AT_YARD', 'READY', 'LOADED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CargoType" AS ENUM ('GENERAL', 'VEHICLE', 'HEAVY_LIFT', 'CONTAINER', 'BULK', 'PROJECT');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LoadingStatus" AS ENUM ('NOT_LOADED', 'LOADED');

-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('KG', 'MT');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('IN_YARD', 'RESERVED');

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "yardId" TEXT,
    "destinationPortId" TEXT,
    "cargoType" "CargoType" NOT NULL,
    "specification" TEXT,
    "serialNumber" TEXT,
    "chassisNumber" TEXT,
    "vin" TEXT,
    "weight" DECIMAL(18,2),
    "weightUnit" "WeightUnit",
    "quantity" INTEGER,
    "packages" INTEGER,
    "packageType" TEXT,
    "arrivalDate" TIMESTAMP(3),
    "arrivalReference" TEXT,
    "inspectionStatus" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
    "loadingStatus" "LoadingStatus" NOT NULL DEFAULT 'NOT_LOADED',
    "manifestNumber" TEXT,
    "status" "CargoStatus" NOT NULL DEFAULT 'REGISTERED',
    "comments" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YardInventory" (
    "id" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "yardId" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "status" "InventoryStatus" NOT NULL DEFAULT 'IN_YARD',
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationLabel" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YardInventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_reference_key" ON "Cargo"("reference");

-- CreateIndex
CREATE INDEX "Cargo_customerId_idx" ON "Cargo"("customerId");

-- CreateIndex
CREATE INDEX "Cargo_portId_idx" ON "Cargo"("portId");

-- CreateIndex
CREATE INDEX "Cargo_yardId_idx" ON "Cargo"("yardId");

-- CreateIndex
CREATE INDEX "Cargo_destinationPortId_idx" ON "Cargo"("destinationPortId");

-- CreateIndex
CREATE INDEX "Cargo_status_idx" ON "Cargo"("status");

-- CreateIndex
CREATE INDEX "Cargo_inspectionStatus_idx" ON "Cargo"("inspectionStatus");

-- CreateIndex
CREATE INDEX "Cargo_cargoType_idx" ON "Cargo"("cargoType");

-- CreateIndex
CREATE INDEX "Cargo_serialNumber_idx" ON "Cargo"("serialNumber");

-- CreateIndex
CREATE INDEX "Cargo_chassisNumber_idx" ON "Cargo"("chassisNumber");

-- CreateIndex
CREATE INDEX "Cargo_vin_idx" ON "Cargo"("vin");

-- CreateIndex
CREATE INDEX "Cargo_arrivalDate_idx" ON "Cargo"("arrivalDate");

-- CreateIndex
CREATE UNIQUE INDEX "YardInventory_cargoId_key" ON "YardInventory"("cargoId");

-- CreateIndex
CREATE INDEX "YardInventory_yardId_idx" ON "YardInventory"("yardId");

-- CreateIndex
CREATE INDEX "YardInventory_portId_idx" ON "YardInventory"("portId");

-- CreateIndex
CREATE INDEX "YardInventory_status_idx" ON "YardInventory"("status");

-- CreateIndex
CREATE INDEX "YardInventory_enteredAt_idx" ON "YardInventory"("enteredAt");

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_destinationPortId_fkey" FOREIGN KEY ("destinationPortId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_yardId_fkey" FOREIGN KEY ("yardId") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YardInventory" ADD CONSTRAINT "YardInventory_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YardInventory" ADD CONSTRAINT "YardInventory_yardId_fkey" FOREIGN KEY ("yardId") REFERENCES "Yard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YardInventory" ADD CONSTRAINT "YardInventory_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CreateEnum
CREATE TYPE "DischargeStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DischargeResult" AS ENUM ('NOT_DISCHARGED', 'FULL', 'PARTIAL');

-- CreateTable
CREATE TABLE "Discharge" (
    "id" TEXT NOT NULL,
    "dischargeNumber" TEXT NOT NULL,
    "actualLoadingId" TEXT NOT NULL,
    "status" "DischargeStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "createdById" TEXT,
    "completedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Discharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DischargeItem" (
    "id" TEXT NOT NULL,
    "dischargeId" TEXT NOT NULL,
    "actualLoadingItemId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "expectedQuantity" INTEGER,
    "dischargeQuantity" INTEGER,
    "result" "DischargeResult" NOT NULL DEFAULT 'NOT_DISCHARGED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DischargeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Discharge_dischargeNumber_key" ON "Discharge"("dischargeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Discharge_actualLoadingId_key" ON "Discharge"("actualLoadingId");

-- CreateIndex
CREATE INDEX "Discharge_dischargeNumber_idx" ON "Discharge"("dischargeNumber");

-- CreateIndex
CREATE INDEX "Discharge_status_idx" ON "Discharge"("status");

-- CreateIndex
CREATE INDEX "Discharge_createdAt_idx" ON "Discharge"("createdAt");

-- CreateIndex
CREATE INDEX "Discharge_createdById_idx" ON "Discharge"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "DischargeItem_actualLoadingItemId_key" ON "DischargeItem"("actualLoadingItemId");

-- CreateIndex
CREATE INDEX "DischargeItem_dischargeId_idx" ON "DischargeItem"("dischargeId");

-- CreateIndex
CREATE INDEX "DischargeItem_cargoId_idx" ON "DischargeItem"("cargoId");

-- CreateIndex
CREATE INDEX "DischargeItem_actualLoadingItemId_idx" ON "DischargeItem"("actualLoadingItemId");

-- AddForeignKey
ALTER TABLE "Discharge" ADD CONSTRAINT "Discharge_actualLoadingId_fkey" FOREIGN KEY ("actualLoadingId") REFERENCES "ActualLoading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discharge" ADD CONSTRAINT "Discharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discharge" ADD CONSTRAINT "Discharge_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discharge" ADD CONSTRAINT "Discharge_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeItem" ADD CONSTRAINT "DischargeItem_dischargeId_fkey" FOREIGN KEY ("dischargeId") REFERENCES "Discharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeItem" ADD CONSTRAINT "DischargeItem_actualLoadingItemId_fkey" FOREIGN KEY ("actualLoadingItemId") REFERENCES "ActualLoadingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeItem" ADD CONSTRAINT "DischargeItem_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

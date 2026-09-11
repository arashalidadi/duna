-- CreateEnum
CREATE TYPE "ActualLoadingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoadingResult" AS ENUM ('FULL', 'PARTIAL', 'NOT_LOADED');

-- CreateTable
CREATE TABLE "ActualLoading" (
    "id" TEXT NOT NULL,
    "actualLoadingNumber" TEXT NOT NULL,
    "loadListId" TEXT NOT NULL,
    "status" "ActualLoadingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "createdById" TEXT,
    "completedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ActualLoading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActualLoadingItem" (
    "id" TEXT NOT NULL,
    "actualLoadingId" TEXT NOT NULL,
    "loadListItemId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "actualQuantity" INTEGER,
    "result" "LoadingResult" NOT NULL DEFAULT 'NOT_LOADED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActualLoadingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActualLoading_actualLoadingNumber_key" ON "ActualLoading"("actualLoadingNumber");

-- CreateIndex
CREATE INDEX "ActualLoading_actualLoadingNumber_idx" ON "ActualLoading"("actualLoadingNumber");

-- CreateIndex
CREATE INDEX "ActualLoading_loadListId_idx" ON "ActualLoading"("loadListId");

-- CreateIndex
CREATE INDEX "ActualLoading_status_idx" ON "ActualLoading"("status");

-- CreateIndex
CREATE INDEX "ActualLoading_createdAt_idx" ON "ActualLoading"("createdAt");

-- CreateIndex
CREATE INDEX "ActualLoading_createdById_idx" ON "ActualLoading"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ActualLoading_loadListId_key" ON "ActualLoading"("loadListId");

-- CreateIndex
CREATE UNIQUE INDEX "ActualLoadingItem_loadListItemId_key" ON "ActualLoadingItem"("loadListItemId");

-- CreateIndex
CREATE INDEX "ActualLoadingItem_actualLoadingId_idx" ON "ActualLoadingItem"("actualLoadingId");

-- CreateIndex
CREATE INDEX "ActualLoadingItem_loadListItemId_idx" ON "ActualLoadingItem"("loadListItemId");

-- CreateIndex
CREATE INDEX "ActualLoadingItem_cargoId_idx" ON "ActualLoadingItem"("cargoId");

-- CreateIndex
CREATE UNIQUE INDEX "ActualLoadingItem_actualLoadingId_loadListItemId_key" ON "ActualLoadingItem"("actualLoadingId", "loadListItemId");

-- CreateIndex
CREATE INDEX "LoadList_loadListNumber_idx" ON "LoadList"("loadListNumber");

-- AddForeignKey
ALTER TABLE "ActualLoading" ADD CONSTRAINT "ActualLoading_loadListId_fkey" FOREIGN KEY ("loadListId") REFERENCES "LoadList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLoading" ADD CONSTRAINT "ActualLoading_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLoading" ADD CONSTRAINT "ActualLoading_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLoading" ADD CONSTRAINT "ActualLoading_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLoadingItem" ADD CONSTRAINT "ActualLoadingItem_actualLoadingId_fkey" FOREIGN KEY ("actualLoadingId") REFERENCES "ActualLoading"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLoadingItem" ADD CONSTRAINT "ActualLoadingItem_loadListItemId_fkey" FOREIGN KEY ("loadListItemId") REFERENCES "LoadListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLoadingItem" ADD CONSTRAINT "ActualLoadingItem_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "LoadListStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LoadList" (
    "id" TEXT NOT NULL,
    "loadListNumber" TEXT NOT NULL,
    "voyageId" TEXT NOT NULL,
    "status" "LoadListStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT,
    "finalizedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LoadList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadListItem" (
    "id" TEXT NOT NULL,
    "loadListId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "plannedQuantity" INTEGER,
    "sequence" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoadList_loadListNumber_key" ON "LoadList"("loadListNumber");

-- CreateIndex
CREATE INDEX "LoadList_voyageId_idx" ON "LoadList"("voyageId");

-- CreateIndex
CREATE INDEX "LoadList_status_idx" ON "LoadList"("status");

-- CreateIndex
CREATE INDEX "LoadList_createdAt_idx" ON "LoadList"("createdAt");

-- CreateIndex
CREATE INDEX "LoadList_createdById_idx" ON "LoadList"("createdById");

-- CreateIndex
CREATE INDEX "LoadListItem_loadListId_idx" ON "LoadListItem"("loadListId");

-- CreateIndex
CREATE INDEX "LoadListItem_cargoId_idx" ON "LoadListItem"("cargoId");

-- CreateIndex
CREATE INDEX "LoadListItem_sequence_idx" ON "LoadListItem"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "LoadListItem_loadListId_cargoId_key" ON "LoadListItem"("loadListId", "cargoId");

-- AddForeignKey
ALTER TABLE "LoadList" ADD CONSTRAINT "LoadList_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadList" ADD CONSTRAINT "LoadList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadList" ADD CONSTRAINT "LoadList_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadList" ADD CONSTRAINT "LoadList_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadListItem" ADD CONSTRAINT "LoadListItem_loadListId_fkey" FOREIGN KEY ("loadListId") REFERENCES "LoadList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadListItem" ADD CONSTRAINT "LoadListItem_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
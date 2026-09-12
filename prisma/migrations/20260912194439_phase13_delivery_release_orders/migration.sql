-- CreateEnum
CREATE TYPE "DeliveryOrderStatus" AS ENUM ('ISSUED', 'CANCELLED');

-- CreateTable
CREATE TABLE "delivery_orders" (
    "id" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "billOfLadingId" TEXT NOT NULL,
    "status" "DeliveryOrderStatus" NOT NULL DEFAULT 'ISSUED',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipient" TEXT NOT NULL,
    "recipientId" TEXT,
    "vehiclePlate" TEXT,
    "notes" TEXT,
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "delivery_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_orders" (
    "id" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "billOfLadingId" TEXT NOT NULL,
    "status" "DeliveryOrderStatus" NOT NULL DEFAULT 'ISSUED',
    "releaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "financialOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "notes" TEXT,
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "release_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_orders_docNumber_key" ON "delivery_orders"("docNumber");

-- CreateIndex
CREATE INDEX "delivery_orders_billOfLadingId_idx" ON "delivery_orders"("billOfLadingId");

-- CreateIndex
CREATE INDEX "delivery_orders_status_idx" ON "delivery_orders"("status");

-- CreateIndex
CREATE INDEX "delivery_orders_issueDate_idx" ON "delivery_orders"("issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "release_orders_docNumber_key" ON "release_orders"("docNumber");

-- CreateIndex
CREATE INDEX "release_orders_billOfLadingId_idx" ON "release_orders"("billOfLadingId");

-- CreateIndex
CREATE INDEX "release_orders_status_idx" ON "release_orders"("status");

-- CreateIndex
CREATE INDEX "release_orders_releaseDate_idx" ON "release_orders"("releaseDate");

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_billOfLadingId_fkey" FOREIGN KEY ("billOfLadingId") REFERENCES "bills_of_lading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_orders" ADD CONSTRAINT "release_orders_billOfLadingId_fkey" FOREIGN KEY ("billOfLadingId") REFERENCES "bills_of_lading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_orders" ADD CONSTRAINT "release_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_orders" ADD CONSTRAINT "release_orders_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

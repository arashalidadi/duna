-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "portalCustomerId" TEXT;

-- CreateTable
CREATE TABLE "booking_requests" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "cargoDescription" TEXT NOT NULL,
    "originPortId" TEXT,
    "destinationPortId" TEXT,
    "requestedShipDate" TIMESTAMP(3),
    "containers" INTEGER,
    "weightKg" DECIMAL(18,3),
    "notes" TEXT,
    "responseNote" TEXT,
    "submittedById" TEXT,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "booking_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_requests_bookingNumber_key" ON "booking_requests"("bookingNumber");

-- CreateIndex
CREATE INDEX "booking_requests_customerId_idx" ON "booking_requests"("customerId");

-- CreateIndex
CREATE INDEX "booking_requests_bookingNumber_idx" ON "booking_requests"("bookingNumber");

-- CreateIndex
CREATE INDEX "booking_requests_status_idx" ON "booking_requests"("status");

-- CreateIndex
CREATE INDEX "booking_requests_createdAt_idx" ON "booking_requests"("createdAt");

-- CreateIndex
CREATE INDEX "booking_requests_submittedById_idx" ON "booking_requests"("submittedById");

-- CreateIndex
CREATE UNIQUE INDEX "User_portalCustomerId_key" ON "User"("portalCustomerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_portalCustomerId_fkey" FOREIGN KEY ("portalCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_originPortId_fkey" FOREIGN KEY ("originPortId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_destinationPortId_fkey" FOREIGN KEY ("destinationPortId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

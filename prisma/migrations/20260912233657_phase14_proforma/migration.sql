-- CreateEnum
CREATE TYPE "ProformaStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateTable
CREATE TABLE "proformas" (
    "id" TEXT NOT NULL,
    "proformaNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ProformaStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "description" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "issueDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "linkedInvoiceId" TEXT,
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

    CONSTRAINT "proformas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_items" (
    "id" TEXT NOT NULL,
    "proformaId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proforma_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proformas_proformaNumber_key" ON "proformas"("proformaNumber");

-- CreateIndex
CREATE UNIQUE INDEX "proformas_linkedInvoiceId_key" ON "proformas"("linkedInvoiceId");

-- CreateIndex
CREATE INDEX "proformas_customerId_idx" ON "proformas"("customerId");

-- CreateIndex
CREATE INDEX "proformas_status_idx" ON "proformas"("status");

-- CreateIndex
CREATE INDEX "proformas_issueDate_idx" ON "proformas"("issueDate");

-- CreateIndex
CREATE INDEX "proformas_createdAt_idx" ON "proformas"("createdAt");

-- CreateIndex
CREATE INDEX "proforma_items_proformaId_idx" ON "proforma_items"("proformaId");

-- CreateIndex
CREATE INDEX "proforma_items_sequence_idx" ON "proforma_items"("sequence");

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_linkedInvoiceId_fkey" FOREIGN KEY ("linkedInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_items" ADD CONSTRAINT "proforma_items_proformaId_fkey" FOREIGN KEY ("proformaId") REFERENCES "proformas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

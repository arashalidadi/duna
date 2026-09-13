-- CreateEnum
CREATE TYPE "LetterDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "LetterStatus" AS ENUM ('DRAFT', 'SENT', 'RECEIVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "letters" (
    "id" TEXT NOT NULL,
    "letterNumber" TEXT NOT NULL,
    "direction" "LetterDirection" NOT NULL,
    "status" "LetterStatus" NOT NULL DEFAULT 'DRAFT',
    "letterDate" TIMESTAMP(3) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT,
    "refNumber" VARCHAR(100),
    "fromContact" VARCHAR(160),
    "toContact" VARCHAR(160),
    "customerId" TEXT,
    "replyToId" TEXT,
    "notes" VARCHAR(500),
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "letters_letterNumber_key" ON "letters"("letterNumber");

-- CreateIndex
CREATE INDEX "letters_status_idx" ON "letters"("status");

-- CreateIndex
CREATE INDEX "letters_direction_idx" ON "letters"("direction");

-- CreateIndex
CREATE INDEX "letters_letterDate_idx" ON "letters"("letterDate");

-- CreateIndex
CREATE INDEX "letters_customerId_idx" ON "letters"("customerId");

-- CreateIndex
CREATE INDEX "letters_replyToId_idx" ON "letters"("replyToId");

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "letters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

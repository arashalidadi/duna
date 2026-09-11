-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "lookupKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_lookupKey_key" ON "RefreshToken"("lookupKey");
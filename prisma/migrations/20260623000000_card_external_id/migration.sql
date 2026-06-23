-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Card_externalId_key" ON "Card"("externalId");

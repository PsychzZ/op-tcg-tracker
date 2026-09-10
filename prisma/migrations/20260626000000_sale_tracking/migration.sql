-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "soldPricePerUnit" DECIMAL(12,2) NOT NULL,
    "fees" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "soldAt" DATE NOT NULL,
    "costBasisPerUnit" DECIMAL(12,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sale_userId_soldAt_idx" ON "Sale"("userId", "soldAt");

-- CreateIndex
CREATE INDEX "Sale_cardId_idx" ON "Sale"("cardId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

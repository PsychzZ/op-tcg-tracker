-- CreateIndex
CREATE UNIQUE INDEX "SaleObservation_cardId_grade_saleDate_priceNative_source_key" ON "SaleObservation"("cardId", "grade", "saleDate", "priceNative", "source");

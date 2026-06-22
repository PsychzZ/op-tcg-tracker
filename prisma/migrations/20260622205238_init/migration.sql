-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'friend');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('raw', 'psa9', 'psa10');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('C', 'UC', 'R', 'SR', 'SEC', 'SP', 'L');

-- CreateEnum
CREATE TYPE "Variant" AS ENUM ('normal', 'altArt', 'mangaArt', 'parallel', 'serial');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('booster', 'starter', 'promo', 'specialCollab');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('ebaySold', 'freeApi');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('running', 'success', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'friend',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "note" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameJp" TEXT,
    "setCode" TEXT,
    "number" TEXT,
    "rarity" "Rarity" NOT NULL,
    "variant" "Variant" NOT NULL DEFAULT 'normal',
    "category" "Category" NOT NULL DEFAULT 'booster',
    "language" TEXT NOT NULL DEFAULT 'ja',
    "imageUrl" TEXT,
    "providerIds" JSONB,
    "trackOverride" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "purchasePricePerUnit" DECIMAL(12,2),
    "purchaseCurrency" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "condition" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL,
    "date" DATE NOT NULL,
    "priceNative" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "priceEur" DECIMAL(12,2) NOT NULL,
    "fxRate" DECIMAL(18,8) NOT NULL,
    "source" "PriceSource" NOT NULL,
    "sampleSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleObservation" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL,
    "saleDate" DATE NOT NULL,
    "priceNative" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "priceEur" DECIMAL(12,2) NOT NULL,
    "source" "PriceSource" NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "grade" "Grade",
    "targetPrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "cardsUpdated" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "status" "SyncStatus" NOT NULL DEFAULT 'running',

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "Card_setCode_idx" ON "Card"("setCode");

-- CreateIndex
CREATE INDEX "Card_rarity_idx" ON "Card"("rarity");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_userId_cardId_grade_key" ON "CollectionItem"("userId", "cardId", "grade");

-- CreateIndex
CREATE INDEX "PriceSnapshot_cardId_grade_idx" ON "PriceSnapshot"("cardId", "grade");

-- CreateIndex
CREATE UNIQUE INDEX "PriceSnapshot_cardId_grade_date_key" ON "PriceSnapshot"("cardId", "grade", "date");

-- CreateIndex
CREATE INDEX "SaleObservation_cardId_grade_idx" ON "SaleObservation"("cardId", "grade");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_cardId_key" ON "WatchlistItem"("userId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_date_currency_key" ON "FxRate"("date", "currency");

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleObservation" ADD CONSTRAINT "SaleObservation_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

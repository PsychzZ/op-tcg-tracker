-- Add PriceCharting as a price source
ALTER TYPE "PriceSource" ADD VALUE IF NOT EXISTS 'priceCharting';

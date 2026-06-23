import type { Grade } from "@/domain/card";
import type { PriceSource } from "@prisma/client";
import type { Card } from "@prisma/client";

export interface SaleObs {
  saleDate: Date;
  priceNative: number;
  currency: string;
  url?: string;
}

export interface ProviderPrice {
  grade: Grade;
  priceNative: number;
  currency: string;
  source: PriceSource;
  sampleSize?: number;
  observations?: SaleObs[];
}

export interface PriceProvider {
  name: PriceSource;
  getPrices(card: Card, grades: Grade[]): Promise<ProviderPrice[]>;
}

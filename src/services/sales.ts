import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Grade } from "@/domain/card";
import { realizedTotals, type RealizedTotals, type SaleTerms } from "@/domain/sale";

/** Sales of one user, newest first, with just enough card data for a list. */
export function getUserSales(userId: string) {
  return db.sale.findMany({
    where: { userId },
    orderBy: [{ soldAt: "desc" }, { createdAt: "desc" }],
    include: { card: { select: { id: true, name: true, setCode: true, number: true } } },
  });
}

export async function getRealizedTotals(userId: string): Promise<RealizedTotals> {
  const sales = await db.sale.findMany({
    where: { userId },
    select: { quantity: true, soldPricePerUnit: true, fees: true, costBasisPerUnit: true },
  });
  const terms: SaleTerms[] = sales.map((s) => ({
    quantity: s.quantity,
    soldPricePerUnit: Number(s.soldPricePerUnit),
    feesEur: s.fees === null ? null : Number(s.fees),
    costBasisPerUnit: s.costBasisPerUnit === null ? null : Number(s.costBasisPerUnit),
  }));
  return realizedTotals(terms);
}

export interface RecordSaleInput {
  userId: string;
  cardId: string;
  grade: Grade;
  quantity: number;
  soldPricePerUnit: number;
  soldAt: Date;
  feesEur?: number | null;
  note?: string | null;
}

export class SaleError extends Error {}

/** Prisma's "record not found" (P2025): the row was removed by a competing transaction. */
function isRecordNotFound(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}

/**
 * Records a sale and reduces (or removes) the matching holding in one transaction, so the collection
 * and the sale history can never disagree. The purchase price is copied onto the sale as its cost
 * basis — afterwards the CollectionItem may be gone, but the P/L is not.
 *
 * The holding is read *inside* the transaction and decremented relatively, so two submits racing
 * each other compose (2 held, sell 1 twice → 0 left and two sale rows) instead of one overwriting
 * the other's result. A decrement that would go negative rolls the whole transaction back.
 */
export async function recordSale(input: RecordSaleInput) {
  const { userId, cardId, grade, quantity, soldPricePerUnit, soldAt, feesEur, note } = input;
  if (!Number.isInteger(quantity) || quantity < 1) throw new SaleError("BAD_QUANTITY");

  return db.$transaction(async (tx) => {
    const item = await tx.collectionItem.findUnique({
      where: { userId_cardId_grade: { userId, cardId, grade } },
    });
    if (!item) throw new SaleError("NOT_OWNED");
    if (quantity > item.quantity) throw new SaleError("BAD_QUANTITY");

    const sale = await tx.sale.create({
      data: {
        userId,
        cardId,
        grade,
        quantity,
        soldPricePerUnit,
        fees: feesEur ?? null,
        soldAt,
        costBasisPerUnit: item.purchasePricePerUnit,
        note: note ?? null,
      },
    });

    let remaining: number;
    try {
      ({ quantity: remaining } = await tx.collectionItem.update({
        where: { id: item.id },
        data: { quantity: { decrement: quantity } },
      }));
    } catch (e) {
      // The row vanished underneath us (a competing sale of the last unit) — nothing left to sell.
      if (isRecordNotFound(e)) throw new SaleError("NOT_OWNED");
      throw e;
    }
    if (remaining < 0) throw new SaleError("BAD_QUANTITY");
    if (remaining === 0) {
      // A competing transaction may have removed the row first; the holding is gone either way,
      // which is exactly what this sale wanted.
      try {
        await tx.collectionItem.delete({ where: { id: item.id } });
      } catch (e) {
        if (!isRecordNotFound(e)) throw e;
      }
    }

    return sale;
  });
}

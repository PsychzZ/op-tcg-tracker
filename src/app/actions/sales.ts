"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { SaleError, recordSale } from "@/services/sales";
import { parsePriceInput } from "@/domain/money";
import type { Grade } from "@/domain/card";

const GRADES: Grade[] = ["raw", "psa9", "psa10"];

/** "YYYY-MM-DD" from an <input type="date"> → UTC midnight (Sale.soldAt is a DATE column). */
function parseSoldAt(raw: FormDataEntryValue | null): Date {
  const text = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(new Date().toISOString().slice(0, 10));
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? new Date(new Date().toISOString().slice(0, 10)) : parsed;
}

export async function recordSaleAction(formData: FormData) {
  const user = await requireUser();

  const cardId = String(formData.get("cardId") ?? "");
  const gradeRaw = String(formData.get("grade") ?? "");
  const grade = GRADES.includes(gradeRaw as Grade) ? (gradeRaw as Grade) : null;
  const quantity = Math.trunc(Number(formData.get("quantity") ?? 0));
  const soldPricePerUnit = parsePriceInput(String(formData.get("soldPrice") ?? ""));
  const feesEur = parsePriceInput(String(formData.get("fees") ?? ""));

  if (!cardId || !grade || !soldPricePerUnit || !Number.isInteger(quantity) || quantity < 1) return;

  try {
    await recordSale({
      userId: user.id,
      cardId,
      grade,
      quantity,
      soldPricePerUnit,
      soldAt: parseSoldAt(formData.get("soldAt")),
      feesEur,
      note: String(formData.get("note") ?? "").trim() || null,
    });
  } catch (e) {
    // Nothing to sell: the holding is gone or smaller than the requested quantity. The form only
    // lists real holdings, so this only happens on a stale page — leave the data untouched.
    if (e instanceof SaleError) return;
    throw e;
  }

  revalidatePath("/");
  revalidatePath("/sales");
  revalidatePath("/cards");
  revalidatePath(`/cards/${cardId}`);
}

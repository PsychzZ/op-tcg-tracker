"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { upsertCollectionItem, removeCollectionItem } from "@/services/collection";
import type { Grade } from "@/domain/card";

export async function addToCollectionAction(formData: FormData) {
  const user = await requireUser();
  const cardId = String(formData.get("cardId"));
  const grade = String(formData.get("grade")) as Grade;
  const quantity = Number(formData.get("quantity") ?? 1);
  const priceRaw = formData.get("purchasePrice");
  const purchasePricePerUnit = priceRaw ? Number(priceRaw) : null;
  await upsertCollectionItem({ userId: user.id, cardId, grade, quantity, purchasePricePerUnit });
  revalidatePath(`/cards/${cardId}`);
}

export async function removeFromCollectionAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const cardId = String(formData.get("cardId"));
  await removeCollectionItem(user.id, id);
  revalidatePath(`/cards/${cardId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { toggleWatch } from "@/services/watchlist";

export async function toggleWatchAction(formData: FormData) {
  const user = await requireUser();
  const cardId = String(formData.get("cardId"));
  await toggleWatch(user.id, cardId);
  revalidatePath("/watchlist");
  revalidatePath("/cards");
  revalidatePath(`/cards/${cardId}`);
}

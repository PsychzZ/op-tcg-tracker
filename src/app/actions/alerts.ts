"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { markAlertsSeen, setWatchTarget } from "@/services/alerts";
import { parsePriceInput } from "@/domain/money";
import type { Grade } from "@/domain/card";

const GRADES: Grade[] = ["raw", "psa9", "psa10"];

export async function setAlertTargetAction(formData: FormData) {
  const user = await requireUser();
  const cardId = String(formData.get("cardId") ?? "");
  if (!cardId) return;

  const gradeRaw = String(formData.get("grade") ?? "raw");
  const grade: Grade = GRADES.includes(gradeRaw as Grade) ? (gradeRaw as Grade) : "raw";
  const targetPriceEur = parsePriceInput(String(formData.get("targetPrice") ?? ""));

  await setWatchTarget(user.id, cardId, grade, targetPriceEur);

  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidatePath(`/cards/${cardId}`);
}

export async function markAlertsSeenAction() {
  const user = await requireUser();
  await markAlertsSeen(user.id);
  revalidatePath("/");
  revalidatePath("/watchlist");
}

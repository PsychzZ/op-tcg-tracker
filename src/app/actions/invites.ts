"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/session";
import { createInvite } from "@/services/auth-service";

export async function createInviteAction(formData: FormData) {
  const owner = await requireOwner();
  const note = String(formData.get("note") ?? "") || undefined;
  await createInvite(owner.id, note);
  revalidatePath("/settings/invites");
}

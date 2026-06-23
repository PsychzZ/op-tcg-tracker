"use server";

import { registerUser } from "@/services/auth-service";
import { signIn } from "@/auth";

export type ActionState = { error?: string } | null;

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await registerUser({
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      code: String(formData.get("code") ?? ""),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "INVALID_INVITE") return { error: "Ungültiger oder verbrauchter Invite-Code." };
    if (msg === "EMAIL_TAKEN") return { error: "Diese E-Mail ist bereits registriert." };
    return { error: "Registrierung fehlgeschlagen. Prüfe deine Eingaben." };
  }
  await signIn("credentials", {
    email: String(formData.get("email")),
    password: String(formData.get("password")),
    redirectTo: "/",
  });
  return null;
}

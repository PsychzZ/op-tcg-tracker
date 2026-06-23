"use client";

import { useActionState } from "react";
import { registerAction, type ActionState } from "@/app/actions/auth";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(registerAction, null);
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#1e1f22] text-[#f3f4f5] p-6">
      <form action={action} className="w-full max-w-sm space-y-4 border border-white/10 rounded-xl bg-[#26272b] p-6">
        <h1 className="text-lg font-semibold">Registrieren</h1>
        <p className="text-sm text-[#82858c]">Nur mit Einladungscode.</p>
        <input name="displayName" placeholder="Anzeigename" required className="w-full rounded-md bg-[#1e1f22] border border-white/10 px-3 py-2" />
        <input name="email" type="email" placeholder="E-Mail" required className="w-full rounded-md bg-[#1e1f22] border border-white/10 px-3 py-2" />
        <input name="password" type="password" placeholder="Passwort (min. 8 Zeichen)" required className="w-full rounded-md bg-[#1e1f22] border border-white/10 px-3 py-2" />
        <input name="code" placeholder="Invite-Code (OP-XXXXXX)" required className="w-full rounded-md bg-[#1e1f22] border border-white/10 px-3 py-2" />
        {state?.error && <p className="text-sm text-[#e08a8a]">{state.error}</p>}
        <button disabled={pending} className="w-full rounded-md bg-[#d8b143] text-[#0e0f13] font-medium py-2 disabled:opacity-60">
          {pending ? "..." : "Account erstellen"}
        </button>
        <a href="/login" className="block text-center text-sm text-[#b0b3b8]">Schon registriert? Login</a>
      </form>
    </main>
  );
}

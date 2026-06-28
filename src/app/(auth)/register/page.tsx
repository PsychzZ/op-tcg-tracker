"use client";

import { useActionState } from "react";
import { registerAction, type ActionState } from "@/app/actions/auth";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(registerAction, null);
  return (
    <main className="min-h-screen grid place-items-center bg-vault text-ink p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6 font-semibold text-lg tracking-tight">
          <span className="grid place-items-center w-7 h-7 rounded-md bg-gold text-vault text-sm font-bold">◆</span>
          OP&nbsp;Vault
        </div>
        <form action={action} className="space-y-3 rounded-xl border border-line bg-surface p-6 shadow-[var(--shadow-pop)]">
          <h1 className="text-lg font-semibold">Registrieren</h1>
          <p className="text-sm text-muted">Nur mit Einladungscode.</p>
          <Input name="displayName" placeholder="Anzeigename" required />
          <Input name="email" type="email" placeholder="E-Mail" required />
          <Input name="password" type="password" placeholder="Passwort (min. 8 Zeichen)" required />
          <Input name="code" placeholder="Invite-Code (OP-XXXXXX)" required />
          {state?.error && <p className="text-sm text-down">{state.error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "..." : "Account erstellen"}
          </Button>
          <a href="/login" className="block text-center text-sm text-muted hover:text-ink transition-colors">
            Schon registriert? Login
          </a>
        </form>
      </div>
    </main>
  );
}

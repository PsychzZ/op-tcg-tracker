"use client";

import { useActionState } from "react";
import { registerAction, type ActionState } from "@/app/actions/auth";
import { Input, Label } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
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
          <label className="block">
            <Label>Anzeigename</Label>
            <Input name="displayName" autoComplete="nickname" required />
          </label>
          <label className="block">
            <Label>E-Mail</Label>
            <Input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="block">
            <Label>Passwort (min. 8 Zeichen)</Label>
            <PasswordInput name="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label className="block">
            <Label>Invite-Code (OP-XXXXXX)</Label>
            <Input name="code" required />
          </label>
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

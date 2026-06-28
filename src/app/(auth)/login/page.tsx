import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Input, Label } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: String(formData.get("email")),
        password: String(formData.get("password")),
        redirectTo: "/",
      });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=1");
      throw e; // re-throw Next's redirect signal
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-vault text-ink p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6 font-semibold text-lg tracking-tight">
          <span className="grid place-items-center w-7 h-7 rounded-md bg-gold text-vault text-sm font-bold">◆</span>
          OP&nbsp;Vault
        </div>
        <form action={login} className="space-y-3 rounded-xl border border-line bg-surface p-6 shadow-[var(--shadow-pop)]">
          <h1 className="text-lg font-semibold">Login</h1>
          {error && (
            <p className="text-sm text-down" role="alert">
              E-Mail oder Passwort ist falsch.
            </p>
          )}
          <label className="block">
            <Label>E-Mail</Label>
            <Input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="block">
            <Label>Passwort</Label>
            <PasswordInput name="password" autoComplete="current-password" required />
          </label>
          <Button type="submit" className="w-full">Einloggen</Button>
          <a href="/register" className="block text-center text-sm text-muted hover:text-ink transition-colors">
            Mit Invite registrieren
          </a>
        </form>
      </div>
    </main>
  );
}

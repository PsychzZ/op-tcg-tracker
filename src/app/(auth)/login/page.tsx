import { signIn } from "@/auth";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  async function login(formData: FormData) {
    "use server";
    await signIn("credentials", {
      email: String(formData.get("email")),
      password: String(formData.get("password")),
      redirectTo: "/",
    });
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
          <Input name="email" type="email" placeholder="E-Mail" required />
          <Input name="password" type="password" placeholder="Passwort" required />
          <Button type="submit" className="w-full">Einloggen</Button>
          <a href="/register" className="block text-center text-sm text-muted hover:text-ink transition-colors">
            Mit Invite registrieren
          </a>
        </form>
      </div>
    </main>
  );
}

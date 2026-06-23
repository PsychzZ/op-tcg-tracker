import { signIn } from "@/auth";

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
    <main className="min-h-screen flex items-center justify-center bg-[#1e1f22] text-[#f3f4f5] p-6">
      <form action={login} className="w-full max-w-sm space-y-4 border border-white/10 rounded-xl bg-[#26272b] p-6">
        <h1 className="text-lg font-semibold">Login</h1>
        <input name="email" type="email" placeholder="E-Mail" required className="w-full rounded-md bg-[#1e1f22] border border-white/10 px-3 py-2" />
        <input name="password" type="password" placeholder="Passwort" required className="w-full rounded-md bg-[#1e1f22] border border-white/10 px-3 py-2" />
        <button className="w-full rounded-md bg-[#d8b143] text-[#0e0f13] font-medium py-2">Einloggen</button>
        <a href="/register" className="block text-center text-sm text-[#b0b3b8]">Mit Invite registrieren</a>
      </form>
    </main>
  );
}

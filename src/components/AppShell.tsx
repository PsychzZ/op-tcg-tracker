import Link from "next/link";
import { signOut } from "@/auth";
import { getCurrentUser } from "@/lib/session";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen bg-[#1e1f22] text-[#f3f4f5]">
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#26272b]">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 font-semibold">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#d8b143]" /> OP&nbsp;Vault
          </span>
          <nav className="flex gap-5 text-sm text-[#b0b3b8]">
            <Link href="/">Dashboard</Link>
            <Link href="/cards">Karten</Link>
            <Link href="/watchlist">Watchlist</Link>
            {user?.role === "owner" && <Link href="/settings/invites">Invites</Link>}
          </nav>
        </div>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="text-sm text-[#82858c] hover:text-[#f3f4f5]">Logout</button>
        </form>
      </header>
      <main className="p-8">{children}</main>
    </div>
  );
}

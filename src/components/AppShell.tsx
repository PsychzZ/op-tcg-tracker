import Link from "next/link";
import { signOut } from "@/auth";
import { getCurrentUser } from "@/lib/session";
import { MainNav } from "@/components/MainNav";
import { Button } from "@/components/ui/Button";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen bg-vault text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-vault/85 backdrop-blur supports-[backdrop-filter]:bg-vault/70">
        <div className="mx-auto max-w-[1200px] flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid place-items-center w-6 h-6 rounded-md bg-gold text-vault text-[13px] font-bold">◆</span>
              OP&nbsp;Vault
            </Link>
            <MainNav isOwner={user?.role === "owner"} />
          </div>
          <div className="flex items-center gap-3">
            {user ? <span className="text-xs text-dim hidden sm:block">{user.name ?? user.email}</span> : null}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button variant="ghost" size="sm">Logout</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-6 py-8">{children}</main>
    </div>
  );
}

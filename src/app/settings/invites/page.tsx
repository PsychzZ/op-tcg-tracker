import { requireOwner } from "@/lib/session";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createInviteAction } from "@/app/actions/invites";

export default async function InvitesPage() {
  await requireOwner();
  const invites = await db.inviteCode.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <AppShell>
      <PageHeader title="Invite-Codes" subtitle="Erstelle Codes, mit denen Freunde sich registrieren können." />

      <form action={createInviteAction} className="flex gap-2 mb-6 max-w-md">
        <Input name="note" placeholder="Notiz (z. B. 'für Tim')" />
        <Button type="submit" className="whitespace-nowrap">Code erstellen</Button>
      </form>

      {invites.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Codes erstellt.</p>
      ) : (
        <ul className="space-y-2 max-w-md">
          {invites.map((i) => (
            <Panel key={i.id} className="flex items-center justify-between px-3.5 py-2.5">
              <span className="font-mono text-sm text-gold">{i.code}</span>
              <span className="text-xs text-dim">
                {i.usesCount}/{i.maxUses} genutzt {i.note ? `· ${i.note}` : ""}
              </span>
            </Panel>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

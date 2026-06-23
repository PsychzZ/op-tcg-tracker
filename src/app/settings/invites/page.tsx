import { requireOwner } from "@/lib/session";
import { db } from "@/lib/db";
import { createInviteAction } from "@/app/actions/invites";

export default async function InvitesPage() {
  await requireOwner();
  const invites = await db.inviteCode.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="min-h-screen bg-[#1e1f22] text-[#f3f4f5] p-8">
      <h1 className="text-lg font-semibold mb-4">Invite-Codes</h1>
      <form action={createInviteAction} className="flex gap-2 mb-6">
        <input name="note" placeholder="Notiz (z. B. 'für Tim')" className="rounded-md bg-[#26272b] border border-white/10 px-3 py-2" />
        <button className="rounded-md bg-[#d8b143] text-[#0e0f13] font-medium px-4">Code erstellen</button>
      </form>
      <ul className="space-y-2 font-mono text-sm">
        {invites.map((i) => (
          <li key={i.id} className="flex justify-between border border-white/10 rounded-md bg-[#26272b] px-3 py-2">
            <span className="text-[#d8b143]">{i.code}</span>
            <span className="text-[#82858c]">
              {i.usesCount}/{i.maxUses} genutzt {i.note ? `· ${i.note}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}

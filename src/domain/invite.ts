export interface UsableInvite {
  usesCount: number;
  maxUses: number;
  expiresAt: Date | null;
}

export function isInviteUsable(invite: UsableInvite, now: Date): boolean {
  if (invite.usesCount >= invite.maxUses) return false;
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

/** Short, human-friendly invite code, e.g. "OP-7F3K9Q". */
export function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `OP-${s}`;
}

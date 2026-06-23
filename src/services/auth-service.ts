import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/domain/password";
import { isInviteUsable, generateInviteCode } from "@/domain/invite";

export const registerSchema = z.object({
  displayName: z.string().min(2).max(40),
  email: z.email(),
  password: z.string().min(8).max(100),
  code: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export async function registerUser(input: RegisterInput) {
  const data = registerSchema.parse(input);

  const invite = await db.inviteCode.findUnique({ where: { code: data.code } });
  if (!invite || !isInviteUsable(invite, new Date())) {
    throw new Error("INVALID_INVITE");
  }

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("EMAIL_TAKEN");

  const passwordHash = await hashPassword(data.password);
  const role: Role = data.email === process.env.OWNER_EMAIL ? Role.owner : Role.friend;

  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: data.email, displayName: data.displayName, passwordHash, role },
    });
    await tx.inviteCode.update({
      where: { id: invite.id },
      data: { usesCount: { increment: 1 } },
    });
    return user;
  });
}

export async function createInvite(ownerId: string, note?: string, maxUses = 1) {
  return db.inviteCode.create({
    data: { code: generateInviteCode(), createdById: ownerId, note, maxUses },
  });
}

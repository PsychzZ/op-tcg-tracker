import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/domain/password";

async function main() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) {
    throw new Error("Set OWNER_EMAIL and OWNER_PASSWORD in .env");
  }
  const passwordHash = await hashPassword(password);
  const user = await db.user.upsert({
    where: { email },
    update: { role: "owner" },
    create: { email, displayName: "Owner", passwordHash, role: "owner" },
  });
  console.log(`Owner ready: ${user.email} (${user.role})`);
}

main().finally(() => db.$disconnect());

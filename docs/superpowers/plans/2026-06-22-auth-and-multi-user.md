# Auth & Multi-User — Implementation Plan (2/5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invite-only registration + login with roles (owner/friend), JWT sessions carrying `userId`+`role`, route protection, and an owner-only invite-code generator — so friends can join privately.

**Architecture:** Auth.js (NextAuth v5) Credentials provider. Passwords hashed with `bcryptjs` (pure JS — no native build on Windows). Split config: `auth.config.ts` is edge-safe (used by middleware, no DB), `auth.ts` adds the DB-backed Credentials provider. Pure helpers (`password`, `invite`) live in `src/domain` and are unit-tested. DB-touching services live in `src/services`. The owner is seeded from env; friends register with a valid invite code.

**Tech Stack:** next-auth@5 (beta), bcryptjs, zod.

**Prerequisites:** Plan 1 complete (Prisma `User`/`InviteCode` models, `db` singleton, Vitest).

**Reference spec:** `docs/superpowers/specs/2026-06-22-op-tcg-tracker-design.md` (§3 Auth, §8 Auth & Rollen)

**Testing strategy:** Pure logic (`password`, `invite`) → Vitest unit tests (TDD). Auth/registration flow + route protection → manual verification steps against the dev DB. (Cross-user data isolation gets an integration test in Plan 5, once collections exist.)

---

## File Structure (created/modified by this plan)

- `src/domain/password.ts` (+ `.test.ts`) — hash/verify
- `src/domain/invite.ts` (+ `.test.ts`) — `isInviteUsable()`
- `src/types/next-auth.d.ts` — session/JWT type augmentation
- `src/auth.config.ts` — edge-safe NextAuth config (callbacks, pages)
- `src/auth.ts` — full NextAuth (Credentials provider w/ DB)
- `src/app/api/auth/[...nextauth]/route.ts` — auth handlers
- `middleware.ts` — protect pages
- `src/lib/session.ts` — `getCurrentUser()`, `requireUser()`, `requireOwner()`
- `src/services/auth-service.ts` — `registerUser()`, `createInvite()`
- `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx` — forms
- `src/app/actions/auth.ts` — `registerAction`
- `src/app/settings/invites/page.tsx` + `src/app/actions/invites.ts` — owner invite UI
- `scripts/seed-owner.ts` + `package.json` script — seed owner user
- `.env` / `.env.example` — `AUTH_SECRET`, `OWNER_EMAIL`, `OWNER_PASSWORD`

---

## Task 1: Install dependencies + env

**Files:** Modify `package.json`, `.env`, `.env.example`

- [ ] **Step 1: Install**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm install next-auth@beta bcryptjs zod
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Generate an auth secret**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npx auth secret
```

Expected: writes `AUTH_SECRET` into `.env` (or prints one to paste). If it only prints, add it manually.

- [ ] **Step 3: Add owner env vars**

Append to `.env`:

```
OWNER_EMAIL="maxel26402@gmail.com"
OWNER_PASSWORD="change-me-strong-password"
```

Append to `.env.example`:

```
AUTH_SECRET="generate-with-npx-auth-secret"
OWNER_EMAIL="you@example.com"
OWNER_PASSWORD="set-a-strong-password"
```

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
git add package.json package-lock.json .env.example
git commit -m "chore: add next-auth, bcryptjs, zod deps and auth env template"
```

---

## Task 2: Password hashing (TDD)

**Files:** Create `src/domain/password.ts`, `src/domain/password.test.ts`

- [ ] **Step 1: Write the failing test**

`src/domain/password.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hash differs from the plaintext", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash).not.toBe("hunter2");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("hunter2", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/domain/password.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/domain/password.ts`:

```ts
import bcrypt from "bcryptjs";

const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- src/domain/password.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/password.ts src/domain/password.test.ts
git commit -m "feat: add bcrypt password hashing helpers"
```

---

## Task 3: Invite usability rule (TDD)

**Files:** Create `src/domain/invite.ts`, `src/domain/invite.test.ts`

- [ ] **Step 1: Write the failing test**

`src/domain/invite.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isInviteUsable, type UsableInvite } from "./invite";

const NOW = new Date("2026-06-22T12:00:00Z");

function invite(o: Partial<UsableInvite> = {}): UsableInvite {
  return { usesCount: 0, maxUses: 1, expiresAt: null, ...o };
}

describe("isInviteUsable", () => {
  it("usable when uses remain and not expired", () => {
    expect(isInviteUsable(invite(), NOW)).toBe(true);
  });
  it("unusable when fully used", () => {
    expect(isInviteUsable(invite({ usesCount: 1, maxUses: 1 }), NOW)).toBe(false);
  });
  it("usable with multi-use remaining", () => {
    expect(isInviteUsable(invite({ usesCount: 2, maxUses: 5 }), NOW)).toBe(true);
  });
  it("unusable when expired", () => {
    expect(isInviteUsable(invite({ expiresAt: new Date("2026-06-01") }), NOW)).toBe(false);
  });
  it("usable when expiry is in the future", () => {
    expect(isInviteUsable(invite({ expiresAt: new Date("2026-07-01") }), NOW)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/domain/invite.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`src/domain/invite.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- src/domain/invite.test.ts
```

Expected: PASS. (`generateInviteCode` is covered indirectly; randomness is fine here.)

- [ ] **Step 5: Commit**

```bash
git add src/domain/invite.ts src/domain/invite.test.ts
git commit -m "feat: add invite usability rule and code generator"
```

---

## Task 4: NextAuth config + types + handlers

**Files:** Create `src/types/next-auth.d.ts`, `src/auth.config.ts`, `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Type augmentation**

`src/types/next-auth.d.ts`:

```ts
import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
```

- [ ] **Step 2: Edge-safe config**

`src/auth.config.ts`:

```ts
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // real provider added in auth.ts (kept out of edge middleware)
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublic =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register");
      if (isPublic) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
```

- [ ] **Step 3: Full auth with Credentials provider**

`src/auth.ts`:

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { verifyPassword } from "@/domain/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      authorize: async (credentials) => {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          role: user.role,
        };
      },
    }),
  ],
});
```

- [ ] **Step 4: Route handlers**

`src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/next-auth.d.ts src/auth.config.ts src/auth.ts "src/app/api/auth/[...nextauth]/route.ts"
git commit -m "feat: configure NextAuth credentials with role-aware JWT/session"
```

---

## Task 5: Route protection middleware + session helpers

**Files:** Create `middleware.ts`, `src/lib/session.ts`

- [ ] **Step 1: Middleware (pages only; API routes self-protect)**

`middleware.ts`:

```ts
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

// Exclude API, static assets, and image optimizer. API routes do their own auth.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Session helpers**

`src/lib/session.ts`:

```ts
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/");
  return user;
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts src/lib/session.ts
git commit -m "feat: add auth middleware and session helpers"
```

---

## Task 6: Auth service (register + create invite) + owner seed

**Files:** Create `src/services/auth-service.ts`, `scripts/seed-owner.ts`; modify `package.json`

- [ ] **Step 1: Auth service**

`src/services/auth-service.ts`:

```ts
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/domain/password";
import { isInviteUsable, generateInviteCode } from "@/domain/invite";

export const registerSchema = z.object({
  displayName: z.string().min(2).max(40),
  email: z.string().email(),
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
  const role = data.email === process.env.OWNER_EMAIL ? "owner" : "friend";

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
```

- [ ] **Step 2: Owner seed script**

`scripts/seed-owner.ts`:

```ts
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
```

- [ ] **Step 3: Add the seed script to `package.json`**

In `"scripts"`, add:

```json
"seed:owner": "tsx scripts/seed-owner.ts"
```

- [ ] **Step 4: Install tsx (script runner that reads `.env`)**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm install -D tsx dotenv
```

Then at the top of `scripts/seed-owner.ts`, ensure env is loaded by adding as the FIRST line:

```ts
import "dotenv/config";
```

- [ ] **Step 5: Seed the owner**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm run seed:owner
```

Expected: `Owner ready: maxel26402@gmail.com (owner)`.

- [ ] **Step 6: Commit**

```bash
git add src/services/auth-service.ts scripts/seed-owner.ts package.json package-lock.json
git commit -m "feat: add register/invite service and owner seed script"
```

---

## Task 7: Login & Register pages + register action

**Files:** Create `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/app/actions/auth.ts`

- [ ] **Step 1: Register server action**

`src/app/actions/auth.ts`:

```ts
"use server";

import { registerUser } from "@/services/auth-service";
import { signIn } from "@/auth";

export type ActionState = { error?: string } | null;

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await registerUser({
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      code: String(formData.get("code") ?? ""),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "INVALID_INVITE") return { error: "Ungültiger oder verbrauchter Invite-Code." };
    if (msg === "EMAIL_TAKEN") return { error: "Diese E-Mail ist bereits registriert." };
    return { error: "Registrierung fehlgeschlagen. Prüfe deine Eingaben." };
  }
  // Auto sign-in after successful registration; redirects to dashboard.
  await signIn("credentials", {
    email: String(formData.get("email")),
    password: String(formData.get("password")),
    redirectTo: "/",
  });
  return null;
}
```

- [ ] **Step 2: Register page**

`src/app/(auth)/register/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { registerAction, type ActionState } from "@/app/actions/auth";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(registerAction, null);
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#1e1f22] text-[#f3f4f5] p-6">
      <form action={action} className="w-full max-w-sm space-y-4 border border-white/10 rounded-xl bg-[#26272b] p-6">
        <h1 className="text-lg font-semibold">Registrieren</h1>
        <p className="text-sm text-[#82858c]">Nur mit Einladungscode.</p>
        <input name="displayName" placeholder="Anzeigename" required className="w-full rounded-md bg-[#1e1f22] border border-white/10 px-3 py-2" />
        <input name="email" type="email" placeholder="E-Mail" required className="w-full rounded-md bg-[#1e1f22] border border-white/10 px-3 py-2" />
        <input name="password" type="password" placeholder="Passwort (min. 8 Zeichen)" required className="w-full rounded-md bg-[#1e1f22] border border-white/10 px-3 py-2" />
        <input name="code" placeholder="Invite-Code (OP-XXXXXX)" required className="w-full rounded-md bg-[#1e1f22] border border-white/10 px-3 py-2" />
        {state?.error && <p className="text-sm text-[#e08a8a]">{state.error}</p>}
        <button disabled={pending} className="w-full rounded-md bg-[#d8b143] text-[#0e0f13] font-medium py-2 disabled:opacity-60">
          {pending ? "..." : "Account erstellen"}
        </button>
        <a href="/login" className="block text-center text-sm text-[#b0b3b8]">Schon registriert? Login</a>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Login page**

`src/app/(auth)/login/page.tsx`:

```tsx
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
```

- [ ] **Step 4: Verify login redirects unauthenticated users**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm run dev
```

Visit http://localhost:3000 → should redirect to `/login`. Log in with the owner credentials from `.env` → should redirect to `/` (the Next.js starter page for now). Stop the server.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)" src/app/actions/auth.ts
git commit -m "feat: add login and invite-based register pages"
```

---

## Task 8: Owner-only invite generator page

**Files:** Create `src/app/settings/invites/page.tsx`, `src/app/actions/invites.ts`

- [ ] **Step 1: Invite action (owner-only)**

`src/app/actions/invites.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/session";
import { createInvite } from "@/services/auth-service";

export async function createInviteAction(formData: FormData) {
  const owner = await requireOwner();
  const note = String(formData.get("note") ?? "") || undefined;
  await createInvite(owner.id, note);
  revalidatePath("/settings/invites");
}
```

- [ ] **Step 2: Invite page (owner-only, lists codes)**

`src/app/settings/invites/page.tsx`:

```tsx
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
```

- [ ] **Step 3: End-to-end manual verification**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm run dev
```

1. Log in as owner → visit `/settings/invites` → create a code → it appears (0/1 genutzt).
2. Open a private window → `/register` → register a friend with that code → lands on `/`.
3. Back as owner, reload `/settings/invites` → code shows `1/1 genutzt`.
4. Try registering again with the same code → error "Ungültiger oder verbrauchter Invite-Code." Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/invites/page.tsx src/app/actions/invites.ts
git commit -m "feat: add owner-only invite code generator page"
```

---

## Task 9: Final verification

- [ ] **Step 1: Tests, types, lint**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm test
npx tsc --noEmit
npm run lint
```

Expected: all unit tests pass; no type errors; lint clean.

- [ ] **Step 2: Confirm `.env` not tracked**

```bash
git status
```

Expected: `.env` not listed; working tree clean.

---

## Self-Review (completed by author)

- **Spec coverage:** Implements spec §8 (Auth.js Credentials, invite-only registration, owner/friend roles via `OWNER_EMAIL`, hashed passwords, all pages behind login) and the §6 "Login/Registrierung" + owner invite management. Per-user data isolation enforcement is wired via `requireUser()` and will be exercised when collections land in Plan 5 (integration test there).
- **Placeholder scan:** No TBD/TODO; every code/command step is complete.
- **Type consistency:** `role` typed as Prisma `Role`; session augmentation matches `auth.config.ts` callbacks; `registerUser`/`createInvite` names match their callers in actions; `isInviteUsable`/`generateInviteCode` match Task 3.
- **Note:** `tsx` + `dotenv/config` is used so the seed script reads `.env`. Middleware excludes `/api` so `/api/health` (Plan 1) and `/api/cron` (Plan 4) are not redirected; those routes self-protect.

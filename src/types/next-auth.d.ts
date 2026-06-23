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

// next-auth/jwt re-exports @auth/core/jwt, and the jwt/session callbacks are
// typed against @auth/core's JWT. Augment it directly so token.id/token.role
// are strongly typed inside the callbacks (otherwise they fall back to unknown).
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}

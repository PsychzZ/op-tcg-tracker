import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next.js 16 renamed the `middleware` file convention to `proxy`. Because this
// project uses a `src` directory, the file lives at `src/proxy.ts` (same level
// as `app`). The NextAuth `auth` helper is a Next middleware function; we
// re-export it as the required `proxy` export. The `authorized` callback in
// `authConfig` drives the access-control decision.
const { auth } = NextAuth(authConfig);

export const proxy = auth;

// Exclude API, static assets, and image optimizer. API routes do their own auth.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

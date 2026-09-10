import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  // Auth.js v5 only trusts the Host header in development unless told otherwise, and rejects the
  // request with "UntrustedHost" (a 500 on every /api/auth/* route) in production. This app is
  // self-hosted — the Pi's own port, or Vercel — so there is no untrusted proxy in front of it.
  trustHost: true,
  providers: [], // real provider added in auth.ts (kept out of edge proxy)
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

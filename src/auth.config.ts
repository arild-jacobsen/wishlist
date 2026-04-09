// Edge-safe NextAuth configuration.
//
// This file contains the NextAuth options that do NOT depend on Node.js-only
// modules (like better-sqlite3). It is imported by both:
//
//   - src/auth.ts        → the full auth setup with the Credentials provider's
//                           authorize() callback (which needs the database)
//   - src/middleware.ts   → route protection, which runs in the Edge Runtime
//                           and therefore cannot import Node.js modules
//
// If you need to change session strategy, callbacks, or pages, do it here.
// If you need to change the authorize() logic, do it in src/auth.ts.

import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export default {
  providers: [
    // Credentials is declared here so NextAuth knows the provider exists,
    // but authorize() is intentionally omitted — it is added in src/auth.ts
    // where database access is available.
    Credentials({
      id: "otp",
      name: "OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        token: { label: "OTP Code", type: "text" },
      },
    }),
  ],

  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },

    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

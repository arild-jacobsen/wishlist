// NextAuth v5 configuration — full version with database access.
//
// This file builds on the Edge-safe base config in src/auth.config.ts by adding
// the Credentials authorize() callback, which needs better-sqlite3 (a Node.js
// module). Because of that dependency, this file must NOT be imported from
// middleware — use auth.config.ts there instead.
//
// Exports used in different parts of the app:
//
//   handlers  → mounted as GET/POST in src/app/api/auth/[...nextauth]/route.ts
//   auth()    → called in server components and route handlers to read session
//   signIn()  → called from Client Components to initiate login
//   signOut() → called from Client Components to end the session

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@/lib/db";
import { verifyOTPToken, getOrCreateUser, isEmailAllowed } from "@/lib/auth";
import authConfig from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    // Override the base Credentials provider to add the authorize() callback,
    // which requires database access (not available in Edge Runtime).
    Credentials({
      id: "otp",
      name: "OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        token: { label: "OTP Code", type: "text" },
      },
      // authorize() runs on the server when signIn("otp", { email, token }) is called.
      // Return a user object to approve login; return null to reject.
      async authorize(credentials) {
        const email = credentials?.email as string;
        const token = credentials?.token as string;
        if (!email || !token) return null;

        // Double-check whitelist here even though it was checked at OTP request time.
        if (!isEmailAllowed(email)) return null;

        const db = getDb();
        // Verify the code and mark it as used to prevent replay.
        const valid = verifyOTPToken(db, email, token);
        if (!valid) return null;

        // Create the user row if this is their first login.
        const user = getOrCreateUser(db, email);

        // NextAuth expects id to be a string.
        return { id: String(user.id), email: user.email };
      },
    }),
  ],
});

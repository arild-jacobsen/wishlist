// NextAuth v5 configuration — full version with database access.
//
// This file builds on the Edge-safe base config in src/auth.config.ts by adding:
//   - The Google OAuth provider (whitelist enforced in the signIn callback)
//   - The Credentials authorize() callback for OTP login (needs better-sqlite3)
//
// Because of the better-sqlite3 dependency, this file must NOT be imported from
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
import Google from "next-auth/providers/google";
import { getDb } from "@/lib/db";
import { verifyOTPToken, getOrCreateUser, isEmailAllowed } from "@/lib/auth";
import authConfig from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    // Google OAuth — whitelist check and DB user creation happen in the
    // signIn callback below. Credentials come from GOOGLE_CLIENT_ID and
    // GOOGLE_CLIENT_SECRET environment variables, passed explicitly because
    // NextAuth v5's auto-detection looks for AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

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

  callbacks: {
    // Spread the jwt and session callbacks from authConfig so they still run.
    ...authConfig.callbacks,

    // signIn runs after OAuth completes but before the JWT is created.
    // Not called for Credentials — those go through authorize() above.
    async signIn({ user, account }) {
      // Only apply extra checks to Google sign-ins.
      if (account?.provider !== "google") return true;

      // Enforce the whitelist — non-whitelisted Google accounts are rejected.
      if (!user.email || !isEmailAllowed(user.email)) return false;

      // Look up or create the user row, then overwrite user.id with our
      // database integer ID (as a string). The jwt callback in auth.config.ts
      // will pick this up and store it in the token, just like for OTP logins.
      const db = getDb();
      const dbUser = getOrCreateUser(db, user.email);
      user.id = String(dbUser.id);

      return true;
    },
  },
});

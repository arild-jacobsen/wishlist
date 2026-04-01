// NextAuth v5 configuration.
//
// This file is the single source of truth for authentication. It exports four
// things used in different parts of the app:
//
//   handlers  → mounted as GET/POST in src/app/api/auth/[...nextauth]/route.ts
//               (NextAuth's own endpoints for session cookies, CSRF, sign-out)
//
//   auth()    → called in server components and route handlers to read the
//               current user's session. Returns null if not logged in.
//
//   signIn()  → called from the browser (Client Components) to initiate login.
//               Used in src/app/login/page.tsx.
//
//   signOut() → called from the browser to end the session.
//               Used in src/components/SignOutButton.tsx.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@/lib/db";
import { verifyOTPToken, getOrCreateUser, isEmailAllowed } from "@/lib/auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // "Credentials" is NextAuth's escape hatch for custom auth logic.
    // Here we use it to verify an OTP code instead of a password.
    Credentials({
      id: "otp",
      name: "OTP",
      // These fields are passed from the signIn() call in login/page.tsx.
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

  // Store session data in a signed JWT cookie (no session table needed).
  session: { strategy: "jwt" },

  // Override the default /auth/signin URL to our custom login page.
  pages: {
    signIn: "/login",
  },

  callbacks: {
    // jwt() runs whenever a JWT is created (login) or verified (each request).
    // We copy id and email from the user object (available only on login) into
    // the persistent token so they survive across requests.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },

    // session() runs when auth() is called in server components or route handlers.
    // It shapes the session object that the app receives. We copy id and email
    // from the JWT token into session.user so pages can access them.
    //
    // Note: session.user.id is a STRING (NextAuth convention), not a number.
    // Always convert with Number(session.user.id) before using as a database ID.
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
});

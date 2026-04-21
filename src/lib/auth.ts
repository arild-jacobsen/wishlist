// Authentication business logic.
//
// This module handles:
//   - The email whitelist (who is allowed to log in)
//   - OTP generation and verification
//   - User creation on first login
//
// It does NOT handle sessions or JWTs — that is NextAuth's job (see src/auth.ts).
// These functions are called from the NextAuth `authorize` callback and from the
// /api/auth/request-otp route handler.

import type { Db } from "@/lib/db";

// The complete list of email addresses that are allowed to create accounts.
// Add or remove addresses here to control access.
// Comparisons are case-insensitive (see isEmailAllowed below).
export const ALLOWED_EMAILS = [
  "jacobsen.arild@gmail.com",
  "arild.jacobsen@outlook.com",
];

// Returns true if the email is on the whitelist. Case-insensitive.
// Called before generating an OTP and again inside the NextAuth authorize callback.
export function isEmailAllowed(email: string): boolean {
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}

// Generates a random 6-digit string, e.g. "483921".
// Math.floor(100000 + random * 900000) gives a number in [100000, 999999],
// which is always exactly 6 digits.
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Creates a new OTP token for the given email, stores it in the database,
// and returns the token string.
//
// Tokens expire after 15 minutes. The expiry is stored as an ISO 8601 string
// so it can be compared against SQLite's strftime function (see verifyOTPToken).
export function createOTPToken(db: Db, email: string): string {
  const token = generateOTP();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare(
    "INSERT INTO otp_tokens (email, token, expires_at) VALUES (?, ?, ?)"
  ).run(email, token, expiresAt);
  return token;
}

// Verifies an OTP token and returns true if valid, false otherwise.
//
// A token is valid if:
//   1. It exists in the database for the given email
//   2. It has not already been used (used = 0)
//   3. It has not expired (expires_at > now)
//
// If valid, the token is immediately marked as used (used = 1) to prevent
// replay attacks — the same code cannot be used twice.
//
// The strftime format matches JavaScript's toISOString() output so that
// string comparison works correctly. Using datetime('now') would produce a
// different format and cause the comparison to fail.
export function verifyOTPToken(db: Db, email: string, token: string): boolean {
  const row = db
    .prepare(
      `SELECT id FROM otp_tokens
       WHERE email = ? AND token = ? AND used = 0
         AND expires_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`
    )
    .get(email, token) as { id: number } | undefined;

  if (!row) return false;

  // Mark as used so the same code cannot be entered again.
  db.prepare("UPDATE otp_tokens SET used = 1 WHERE id = ?").run(row.id);
  return true;
}

// Sends the OTP code to the user's email.
//
// In production (RESEND_API_KEY set): delivers via Resend.
// In development (no API key): falls back to logging the code to the console
// so the dev server remains usable without email credentials.
export async function sendOTPEmail(email: string, token: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev fallback — log the code so it can be copied from the server console.
    console.log(`[OTP] Sending code ${token} to ${email}`);
    return token;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: "Wishlist <noreply@" + (process.env.RESEND_DOMAIN ?? "wishlist.app") + ">",
    to: email,
    subject: "Your login code",
    html: `
      <p>Your login code for Wishlist is:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:4px">${token}</p>
      <p>This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
    `,
  });

  return token;
}

// Shape of a user row returned from the database.
export interface User {
  id: number;
  email: string;
  created_at: string;
}

// Returns the user for the given email, creating them if they don't exist yet.
//
// This is called after OTP verification succeeds. The user row is created on
// first login — there is no separate "registration" step.
export function getOrCreateUser(db: Db, email: string): User {
  const existing = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email) as User | undefined;
  if (existing) return existing;

  // RETURNING * lets us get the inserted row (including the auto-generated id)
  // without a separate SELECT query.
  const result = db
    .prepare("INSERT INTO users (email) VALUES (?) RETURNING *")
    .get(email) as User;
  return result;
}

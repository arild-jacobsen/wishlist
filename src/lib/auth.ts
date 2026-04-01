import type { Db } from "@/lib/db";

export const ALLOWED_EMAILS = [
  "jacobsen.arild@gmail.com",
  "arild.jacobsen@outlook.com",
];

export function isEmailAllowed(email: string): boolean {
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function createOTPToken(db: Db, email: string): string {
  const token = generateOTP();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare(
    "INSERT INTO otp_tokens (email, token, expires_at) VALUES (?, ?, ?)"
  ).run(email, token, expiresAt);
  return token;
}

export function verifyOTPToken(db: Db, email: string, token: string): boolean {
  const row = db
    .prepare(
      `SELECT id FROM otp_tokens
       WHERE email = ? AND token = ? AND used = 0
         AND expires_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`
    )
    .get(email, token) as { id: number } | undefined;

  if (!row) return false;

  db.prepare("UPDATE otp_tokens SET used = 1 WHERE id = ?").run(row.id);
  return true;
}

export function sendOTPEmail(email: string, token: string): string {
  // Mock implementation — log to console instead of sending a real email
  console.log(`[OTP] Sending code ${token} to ${email}`);
  return token;
}

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export function getOrCreateUser(db: Db, email: string): User {
  const existing = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email) as User | undefined;
  if (existing) return existing;

  const result = db
    .prepare("INSERT INTO users (email) VALUES (?) RETURNING *")
    .get(email) as User;
  return result;
}

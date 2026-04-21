import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "@/test/helpers";
import type { Db } from "@/lib/db";
import {
  isEmailAllowed,
  generateOTP,
  createOTPToken,
  verifyOTPToken,
  sendOTPEmail,
  getOrCreateUser,
} from "@/lib/auth";

let db: Db;

beforeEach(() => {
  db = createTestDb();
});

describe("isEmailAllowed", () => {
  it("allows whitelisted emails", () => {
    expect(isEmailAllowed("jacobsen.arild@gmail.com")).toBe(true);
    expect(isEmailAllowed("arild.jacobsen@outlook.com")).toBe(true);
  });

  it("rejects non-whitelisted emails", () => {
    expect(isEmailAllowed("stranger@example.com")).toBe(false);
    expect(isEmailAllowed("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isEmailAllowed("JACOBSEN.ARILD@GMAIL.COM")).toBe(true);
  });
});

describe("generateOTP", () => {
  it("returns a 6-digit string", () => {
    const otp = generateOTP();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("generates different codes each call (statistically)", () => {
    const otps = new Set(Array.from({ length: 20 }, () => generateOTP()));
    expect(otps.size).toBeGreaterThan(1);
  });
});

describe("createOTPToken", () => {
  it("stores an OTP token in the database", () => {
    const token = createOTPToken(db, "jacobsen.arild@gmail.com");
    expect(token).toMatch(/^\d{6}$/);

    const row = db
      .prepare("SELECT * FROM otp_tokens WHERE email = ?")
      .get("jacobsen.arild@gmail.com") as { token: string; used: number } | undefined;
    expect(row).toBeDefined();
    expect(row!.token).toBe(token);
    expect(row!.used).toBe(0);
  });

  it("sets expiry 15 minutes in the future", () => {
    createOTPToken(db, "jacobsen.arild@gmail.com");
    const row = db
      .prepare("SELECT expires_at FROM otp_tokens WHERE email = ?")
      .get("jacobsen.arild@gmail.com") as { expires_at: string } | undefined;
    expect(row).toBeDefined();
    const expiresAt = new Date(row!.expires_at).getTime();
    const now = Date.now();
    expect(expiresAt).toBeGreaterThan(now + 14 * 60 * 1000);
    expect(expiresAt).toBeLessThan(now + 16 * 60 * 1000);
  });
});

describe("verifyOTPToken", () => {
  it("returns true for a valid, unused, non-expired token", () => {
    const token = createOTPToken(db, "jacobsen.arild@gmail.com");
    expect(verifyOTPToken(db, "jacobsen.arild@gmail.com", token)).toBe(true);
  });

  it("marks the token as used after verification", () => {
    const token = createOTPToken(db, "jacobsen.arild@gmail.com");
    verifyOTPToken(db, "jacobsen.arild@gmail.com", token);
    const row = db
      .prepare("SELECT used FROM otp_tokens WHERE email = ? AND token = ?")
      .get("jacobsen.arild@gmail.com", token) as { used: number } | undefined;
    expect(row!.used).toBe(1);
  });

  it("returns false for an already-used token", () => {
    const token = createOTPToken(db, "jacobsen.arild@gmail.com");
    verifyOTPToken(db, "jacobsen.arild@gmail.com", token);
    expect(verifyOTPToken(db, "jacobsen.arild@gmail.com", token)).toBe(false);
  });

  it("returns false for a wrong token", () => {
    createOTPToken(db, "jacobsen.arild@gmail.com");
    expect(verifyOTPToken(db, "jacobsen.arild@gmail.com", "000000")).toBe(false);
  });

  it("returns false for an expired token", () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    db.prepare(
      "INSERT INTO otp_tokens (email, token, expires_at) VALUES (?, ?, ?)"
    ).run("jacobsen.arild@gmail.com", "123456", pastDate);
    expect(verifyOTPToken(db, "jacobsen.arild@gmail.com", "123456")).toBe(false);
  });
});

describe("sendOTPEmail", () => {
  it("returns the token (dev fallback, no RESEND_API_KEY set)", async () => {
    const result = await sendOTPEmail("jacobsen.arild@gmail.com", "123456");
    expect(result).toBe("123456");
  });
});

describe("getOrCreateUser", () => {
  it("creates a new user if they don't exist", () => {
    const user = getOrCreateUser(db, "jacobsen.arild@gmail.com");
    expect(user.id).toBeDefined();
    expect(user.email).toBe("jacobsen.arild@gmail.com");
  });

  it("returns existing user on subsequent calls", () => {
    const user1 = getOrCreateUser(db, "jacobsen.arild@gmail.com");
    const user2 = getOrCreateUser(db, "jacobsen.arild@gmail.com");
    expect(user1.id).toBe(user2.id);
  });
});

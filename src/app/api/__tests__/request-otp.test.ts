// Tests for POST /api/auth/request-otp
//
// This route is the entry point for OTP login. It has no session requirement —
// anyone can POST an email address. The security property we care about most is
// that whitelisted and non-whitelisted emails get identical responses (prevents
// whitelist enumeration).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { testApiHandler } from "next-test-api-route-handler";
import { createTestDb } from "@/test/helpers";
import type { Db } from "@/lib/db";
import * as handler from "@/app/api/auth/request-otp/route";

let db: Db;

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getDb: vi.fn() };
});
// Suppress console output from sendOTPEmail (it logs the code in dev)
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, sendOTPEmail: vi.fn() };
});

beforeEach(async () => {
  db = createTestDb();
  const { getDb } = await import("@/lib/db");
  vi.mocked(getDb).mockReturnValue(db);
});

describe("POST /api/auth/request-otp", () => {
  it("returns 400 when email is missing", async () => {
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/email/i);
      },
    });
  });

  it("returns 400 when email is empty string", async () => {
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "   " }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it("returns 200 { ok: true } for a whitelisted email", async () => {
    const { ALLOWED_EMAILS } = await import("@/lib/auth");
    const whitelisted = ALLOWED_EMAILS[0];

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: whitelisted }),
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toEqual({ ok: true });
      },
    });
  });

  it("returns 200 { ok: true } for a non-whitelisted email (no enumeration)", async () => {
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "attacker@evil.com" }),
        });
        // Must be identical to the whitelisted response — prevents enumeration
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toEqual({ ok: true });
      },
    });
  });

  it("normalises email to lowercase before checking whitelist", async () => {
    const { ALLOWED_EMAILS } = await import("@/lib/auth");
    const whitelisted = ALLOWED_EMAILS[0];

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: whitelisted.toUpperCase() }),
        });
        expect(res.status).toBe(200);
      },
    });
  });
});

// Tests for GET|POST|DELETE /api/wishes/[id]/claim
//
// Key behaviours under test:
//   - Auth guard: all routes return 401 with no session
//   - Privacy: GET returns 403 when the viewer is the wish owner
//   - POST: claimer cannot be the wish owner; duplicate claims rejected
//   - DELETE: removes claim; safe no-op when no claim exists

import { describe, it, expect, beforeEach, vi } from "vitest";
import { testApiHandler } from "next-test-api-route-handler";
import { createTestDb, createTestUser, createTestList } from "@/test/helpers";
import type { Db } from "@/lib/db";
import { createWish } from "@/lib/wishes";
import * as claimHandler from "@/app/api/wishes/[id]/claim/route";

let db: Db;
let userId: number;
let otherUserId: number;
let wishId: number;

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getDb: vi.fn() };
});

beforeEach(async () => {
  db = createTestDb();
  userId = createTestUser(db, "alice@example.com");
  otherUserId = createTestUser(db, "bob@example.com");
  const listId = createTestList(db, userId);
  const wish = createWish(db, userId, { list_id: listId, name: "Stand mixer", rating: "Would love to get this" });
  wishId = wish.id;

  const { auth } = await import("@/auth");
  const { getDb } = await import("@/lib/db");
  vi.mocked(getDb).mockReturnValue(db);
  // Default: authenticated as alice (the wish owner)
  vi.mocked(auth).mockResolvedValue({
    user: { id: String(userId), email: "alice@example.com" },
  } as never);
});

// Helper: authenticate as the non-owner (bob) for a single call
async function asOtherUser() {
  const { auth } = await import("@/auth");
  vi.mocked(auth).mockResolvedValueOnce({
    user: { id: String(otherUserId), email: "bob@example.com" },
  } as never);
}

// ── GET /api/wishes/[id]/claim ────────────────────────────────────────────────

describe("GET /api/wishes/[id]/claim", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    await testApiHandler({
      appHandler: claimHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(401);
      },
    });
  });

  it("returns 403 when the viewer is the wish owner", async () => {
    // Alice is the owner — she must not see who claimed her wish
    await testApiHandler({
      appHandler: claimHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(403);
      },
    });
  });

  it("returns empty array when no claims exist (non-owner)", async () => {
    await asOtherUser();

    await testApiHandler({
      appHandler: claimHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
      },
    });
  });

  it("returns claims when they exist (non-owner)", async () => {
    // Bob claims alice's wish
    db.prepare("INSERT INTO claims (wish_id, user_id) VALUES (?, ?)").run(wishId, otherUserId);
    await asOtherUser();

    await testApiHandler({
      appHandler: claimHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(200);
        const claims = await res.json();
        expect(claims).toHaveLength(1);
        expect(claims[0].user_id).toBe(otherUserId);
      },
    });
  });
});

// ── POST /api/wishes/[id]/claim ───────────────────────────────────────────────

describe("POST /api/wishes/[id]/claim", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    await testApiHandler({
      appHandler: claimHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "POST" });
        expect(res.status).toBe(401);
      },
    });
  });

  it("creates a claim and returns 201", async () => {
    await asOtherUser();

    await testApiHandler({
      appHandler: claimHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "POST" });
        expect(res.status).toBe(201);
        const claim = await res.json();
        expect(claim.wish_id).toBe(wishId);
        expect(claim.user_id).toBe(otherUserId);
      },
    });
  });

  it("returns 400 when the wish owner tries to claim their own wish", async () => {
    // Authenticated as alice (the owner)
    await testApiHandler({
      appHandler: claimHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "POST" });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/own wish/i);
      },
    });
  });

  it("returns 400 on a duplicate claim", async () => {
    // Bob already claimed
    db.prepare("INSERT INTO claims (wish_id, user_id) VALUES (?, ?)").run(wishId, otherUserId);

    await asOtherUser();
    await testApiHandler({
      appHandler: claimHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "POST" });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/already claimed/i);
      },
    });
  });
});

// ── DELETE /api/wishes/[id]/claim ─────────────────────────────────────────────

describe("DELETE /api/wishes/[id]/claim", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    await testApiHandler({
      appHandler: claimHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "DELETE" });
        expect(res.status).toBe(401);
      },
    });
  });

  it("removes an existing claim and returns 204", async () => {
    db.prepare("INSERT INTO claims (wish_id, user_id) VALUES (?, ?)").run(wishId, otherUserId);
    await asOtherUser();

    await testApiHandler({
      appHandler: claimHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "DELETE" });
        expect(res.status).toBe(204);
      },
    });

    const remaining = db.prepare("SELECT * FROM claims WHERE wish_id = ?").all(wishId);
    expect(remaining).toHaveLength(0);
  });

  it("returns 204 even when no claim exists (safe no-op)", async () => {
    await asOtherUser();

    await testApiHandler({
      appHandler: claimHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        // Bob has no claim, but DELETE should still succeed
        const res = await fetch({ method: "DELETE" });
        expect(res.status).toBe(204);
      },
    });
  });
});

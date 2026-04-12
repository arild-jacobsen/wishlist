// Tests for GET /api/users and GET /api/users/[id]/wishes
//
// Key behaviours under test:
//   - Auth guard: both routes return 401 with no session
//   - GET /api/users: returns all users with their wish counts
//   - GET /api/users/[id]/wishes: returns wishes with claim info attached;
//     when viewer is the wish owner, claims field is null (privacy rule)

import { describe, it, expect, beforeEach, vi } from "vitest";
import { testApiHandler } from "next-test-api-route-handler";
import { createTestDb, createTestUser, createTestList } from "@/test/helpers";
import type { Db } from "@/lib/db";
import { createWish } from "@/lib/wishes";
import * as usersHandler from "@/app/api/users/route";
import * as userWishesHandler from "@/app/api/users/[id]/wishes/route";

let db: Db;
let userId: number;
let otherUserId: number;
let listId: number;
let otherListId: number;

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getDb: vi.fn() };
});

beforeEach(async () => {
  db = createTestDb();
  userId = createTestUser(db, "alice@example.com");
  otherUserId = createTestUser(db, "bob@example.com");
  listId = createTestList(db, userId);
  otherListId = createTestList(db, otherUserId);

  const { auth } = await import("@/auth");
  const { getDb } = await import("@/lib/db");
  vi.mocked(getDb).mockReturnValue(db);
  // Default: authenticated as alice
  vi.mocked(auth).mockResolvedValue({
    user: { id: String(userId), email: "alice@example.com" },
  } as never);
});

// ── GET /api/users ─────────────────────────────────────────────────────────────

describe("GET /api/users", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    await testApiHandler({
      appHandler: usersHandler,
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(401);
      },
    });
  });

  it("returns all users with wishCount", async () => {
    // Alice has 1 wish, Bob has 0
    createWish(db, userId, { list_id: listId, name: "Camera", rating: "Would love to get this" });

    await testApiHandler({
      appHandler: usersHandler,
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(200);
        const users = await res.json();
        expect(users).toHaveLength(2);

        const alice = users.find((u: { email: string }) => u.email === "alice@example.com");
        const bob = users.find((u: { email: string }) => u.email === "bob@example.com");
        expect(alice.wishCount).toBe(1);
        expect(bob.wishCount).toBe(0);
      },
    });
  });

  it("returns users ordered by email", async () => {
    await testApiHandler({
      appHandler: usersHandler,
      test: async ({ fetch }) => {
        const res = await fetch();
        const users = await res.json();
        const emails = users.map((u: { email: string }) => u.email);
        expect(emails).toEqual([...emails].sort());
      },
    });
  });
});

// ── GET /api/users/[id]/wishes ─────────────────────────────────────────────────

describe("GET /api/users/[id]/wishes", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    await testApiHandler({
      appHandler: userWishesHandler,
      params: { id: String(otherUserId) },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(401);
      },
    });
  });

  it("returns empty array when the user has no wishes", async () => {
    await testApiHandler({
      appHandler: userWishesHandler,
      params: { id: String(otherUserId) },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
      },
    });
  });

  it("returns bob's wishes when viewed by alice (non-owner)", async () => {
    createWish(db, otherUserId, { list_id: otherListId, name: "Keyboard", rating: "Would love to get this" });

    await testApiHandler({
      appHandler: userWishesHandler,
      params: { id: String(otherUserId) },
      test: async ({ fetch }) => {
        const res = await fetch(); // authenticated as alice
        expect(res.status).toBe(200);
        const wishes = await res.json();
        expect(wishes).toHaveLength(1);
        expect(wishes[0].name).toBe("Keyboard");
      },
    });
  });

  it("attaches claims array when viewer is not the wish owner", async () => {
    const wish = createWish(db, otherUserId, {
      list_id: otherListId,
      name: "Headphones",
      rating: "It'd be nice",
    });
    // Alice claims Bob's wish
    db.prepare("INSERT INTO claims (wish_id, user_id) VALUES (?, ?)").run(wish.id, userId);

    await testApiHandler({
      appHandler: userWishesHandler,
      params: { id: String(otherUserId) },
      test: async ({ fetch }) => {
        const res = await fetch(); // authenticated as alice (non-owner)
        const wishes = await res.json();
        expect(wishes[0].claims).toHaveLength(1);
        expect(wishes[0].claims[0].user_id).toBe(userId);
      },
    });
  });

  it("attaches null for claims when viewer is the wish owner (privacy rule)", async () => {
    // Alice viewing her own wishes — claims must be null so the gift stays secret
    createWish(db, userId, { list_id: listId, name: "Stand mixer", rating: "Would love to get this" });

    await testApiHandler({
      appHandler: userWishesHandler,
      params: { id: String(userId) },
      test: async ({ fetch }) => {
        const res = await fetch(); // authenticated as alice, viewing alice's wishes
        const wishes = await res.json();
        expect(wishes[0].claims).toBeNull();
      },
    });
  });
});

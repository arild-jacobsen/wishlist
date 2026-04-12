// Tests for GET|POST /api/wishes and GET|PATCH|DELETE /api/wishes/[id]
//
// Key behaviours under test:
//   - Auth guard: all routes return 401 with no session
//   - GET /api/wishes: returns only the current user's wishes
//   - POST /api/wishes: validates list_id, name, and rating
//   - GET /api/wishes/[id]: any authenticated user can read any wish
//   - PATCH /api/wishes/[id]: only owner can update
//   - DELETE /api/wishes/[id]: only owner can delete; cascades claims/comments

import { describe, it, expect, beforeEach, vi } from "vitest";
import { testApiHandler } from "next-test-api-route-handler";
import { createTestDb, createTestUser, createTestList } from "@/test/helpers";
import type { Db } from "@/lib/db";
import { createWish } from "@/lib/wishes";
import * as wishesHandler from "@/app/api/wishes/route";
import * as wishByIdHandler from "@/app/api/wishes/[id]/route";

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
  vi.mocked(auth).mockResolvedValue({
    user: { id: String(userId), email: "alice@example.com" },
  } as never);
});

// ── GET /api/wishes ───────────────────────────────────────────────────────────

describe("GET /api/wishes", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    await testApiHandler({
      appHandler: wishesHandler,
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(401);
      },
    });
  });

  it("returns empty array when user has no wishes", async () => {
    await testApiHandler({
      appHandler: wishesHandler,
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
      },
    });
  });

  it("returns only the current user's wishes", async () => {
    createWish(db, userId, { list_id: listId, name: "My wish", rating: "It'd be nice" });
    createWish(db, otherUserId, { list_id: otherListId, name: "Bob's wish", rating: "It'd be nice" });

    await testApiHandler({
      appHandler: wishesHandler,
      test: async ({ fetch }) => {
        const wishes = await (await fetch()).json();
        expect(wishes).toHaveLength(1);
        expect(wishes[0].name).toBe("My wish");
      },
    });
  });
});

// ── POST /api/wishes ──────────────────────────────────────────────────────────

describe("POST /api/wishes", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    await testApiHandler({
      appHandler: wishesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: "POST", body: JSON.stringify({}) });
        expect(res.status).toBe(401);
      },
    });
  });

  it("creates a wish and returns 201", async () => {
    await testApiHandler({
      appHandler: wishesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            list_id: listId,
            name: "New bicycle",
            description: "A red one",
            links: ["https://example.com"],
            rating: "Would love to get this",
          }),
        });
        expect(res.status).toBe(201);
        const wish = await res.json();
        expect(wish.name).toBe("New bicycle");
        expect(wish.rating).toBe("Would love to get this");
        expect(wish.links).toEqual(["https://example.com"]);
        expect(wish.user_id).toBe(userId);
      },
    });
  });

  it("returns 400 when list_id is missing", async () => {
    await testApiHandler({
      appHandler: wishesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "No list", rating: "It'd be nice" }),
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/list_id/i);
      },
    });
  });

  it("returns 400 when name is empty", async () => {
    await testApiHandler({
      appHandler: wishesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ list_id: listId, name: "", rating: "It'd be nice" }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it("returns 400 when rating is invalid", async () => {
    await testApiHandler({
      appHandler: wishesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ list_id: listId, name: "Gadget", rating: "meh" }),
        });
        expect(res.status).toBe(400);
      },
    });
  });
});

// ── GET /api/wishes/[id] ──────────────────────────────────────────────────────

describe("GET /api/wishes/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);
    const wish = createWish(db, userId, { list_id: listId, name: "Test", rating: "It'd be nice" });

    await testApiHandler({
      appHandler: wishByIdHandler,
      params: { id: String(wish.id) },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(401);
      },
    });
  });

  it("returns the wish", async () => {
    const wish = createWish(db, userId, { list_id: listId, name: "Book", rating: "Would make me happy" });

    await testApiHandler({
      appHandler: wishByIdHandler,
      params: { id: String(wish.id) },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.name).toBe("Book");
      },
    });
  });

  it("returns 404 for an unknown id", async () => {
    await testApiHandler({
      appHandler: wishByIdHandler,
      params: { id: "9999" },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(404);
      },
    });
  });

  it("allows a non-owner to read another user's wish", async () => {
    const wish = createWish(db, otherUserId, { list_id: otherListId, name: "Bob's wish", rating: "It'd be nice" });

    await testApiHandler({
      appHandler: wishByIdHandler,
      params: { id: String(wish.id) },
      test: async ({ fetch }) => {
        const res = await fetch(); // authenticated as alice
        expect(res.status).toBe(200);
      },
    });
  });
});

// ── PATCH /api/wishes/[id] ────────────────────────────────────────────────────

describe("PATCH /api/wishes/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);
    const wish = createWish(db, userId, { list_id: listId, name: "Test", rating: "It'd be nice" });

    await testApiHandler({
      appHandler: wishByIdHandler,
      params: { id: String(wish.id) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "PATCH", body: JSON.stringify({ name: "X" }) });
        expect(res.status).toBe(401);
      },
    });
  });

  it("updates the wish when called by the owner", async () => {
    const wish = createWish(db, userId, { list_id: listId, name: "Old name", rating: "It'd be nice" });

    await testApiHandler({
      appHandler: wishByIdHandler,
      params: { id: String(wish.id) },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New name", rating: "Would make me happy" }),
        });
        expect(res.status).toBe(200);
        const updated = await res.json();
        expect(updated.name).toBe("New name");
        expect(updated.rating).toBe("Would make me happy");
      },
    });
  });

  it("returns 400 when a non-owner tries to update", async () => {
    const wish = createWish(db, otherUserId, { list_id: otherListId, name: "Bob's", rating: "It'd be nice" });

    await testApiHandler({
      appHandler: wishByIdHandler,
      params: { id: String(wish.id) },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Hacked" }),
        });
        expect(res.status).toBe(400);
      },
    });
  });
});

// ── DELETE /api/wishes/[id] ───────────────────────────────────────────────────

describe("DELETE /api/wishes/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);
    const wish = createWish(db, userId, { list_id: listId, name: "Test", rating: "It'd be nice" });

    await testApiHandler({
      appHandler: wishByIdHandler,
      params: { id: String(wish.id) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "DELETE" });
        expect(res.status).toBe(401);
      },
    });
  });

  it("deletes the wish and returns 204", async () => {
    const wish = createWish(db, userId, { list_id: listId, name: "Delete me", rating: "It'd be nice" });

    await testApiHandler({
      appHandler: wishByIdHandler,
      params: { id: String(wish.id) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "DELETE" });
        expect(res.status).toBe(204);
      },
    });
  });

  it("returns 400 when a non-owner tries to delete", async () => {
    const wish = createWish(db, otherUserId, { list_id: otherListId, name: "Bob's", rating: "It'd be nice" });

    await testApiHandler({
      appHandler: wishByIdHandler,
      params: { id: String(wish.id) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "DELETE" });
        expect(res.status).toBe(400);
      },
    });
  });

  it("cascades: claims and comments are deleted with the wish", async () => {
    const wish = createWish(db, userId, { list_id: listId, name: "Claimed wish", rating: "It'd be nice" });
    // Add a claim and comment from the other user
    db.prepare("INSERT INTO claims (wish_id, user_id) VALUES (?, ?)").run(wish.id, otherUserId);
    db.prepare("INSERT INTO secret_comments (wish_id, user_id, content) VALUES (?, ?, ?)").run(
      wish.id, otherUserId, "I'll get this"
    );

    await testApiHandler({
      appHandler: wishByIdHandler,
      params: { id: String(wish.id) },
      test: async ({ fetch }) => {
        await fetch({ method: "DELETE" });
      },
    });

    // Verify cascade removed the claim and comment
    const claims = db.prepare("SELECT * FROM claims WHERE wish_id = ?").all(wish.id);
    const comments = db.prepare("SELECT * FROM secret_comments WHERE wish_id = ?").all(wish.id);
    expect(claims).toHaveLength(0);
    expect(comments).toHaveLength(0);
  });
});

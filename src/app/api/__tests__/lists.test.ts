// Tests for GET|POST /api/lists and GET|PATCH|DELETE /api/lists/[id]
//
// Key behaviours under test:
//   - Auth guard: all routes return 401 with no session
//   - GET /api/lists: returns only the current user's lists
//   - POST /api/lists: creates a list; validates name
//   - GET /api/lists/[id]: any authenticated user can read any list
//   - PATCH /api/lists/[id]: only owner can update; name cannot be blank
//   - DELETE /api/lists/[id]: only owner can delete; 409 when wishes exist

import { describe, it, expect, beforeEach, vi } from "vitest";
import { testApiHandler } from "next-test-api-route-handler";
import { createTestDb, createTestUser, createTestList } from "@/test/helpers";
import type { Db } from "@/lib/db";
import * as listsHandler from "@/app/api/lists/route";
import * as listByIdHandler from "@/app/api/lists/[id]/route";

let db: Db;
let userId: number;
let otherUserId: number;

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getDb: vi.fn() };
});

beforeEach(async () => {
  db = createTestDb();
  userId = createTestUser(db, "alice@example.com");
  otherUserId = createTestUser(db, "bob@example.com");

  const { auth } = await import("@/auth");
  const { getDb } = await import("@/lib/db");
  vi.mocked(getDb).mockReturnValue(db);
  vi.mocked(auth).mockResolvedValue({
    user: { id: String(userId), email: "alice@example.com" },
  } as never);
});

// ── GET /api/lists ────────────────────────────────────────────────────────────

describe("GET /api/lists", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    await testApiHandler({
      appHandler: listsHandler,
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(401);
      },
    });
  });

  it("returns empty array when user has no lists", async () => {
    await testApiHandler({
      appHandler: listsHandler,
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
      },
    });
  });

  it("returns only the current user's lists", async () => {
    createTestList(db, userId, "Alice's list");
    createTestList(db, otherUserId, "Bob's list");

    await testApiHandler({
      appHandler: listsHandler,
      test: async ({ fetch }) => {
        const res = await fetch();
        const lists = await res.json();
        expect(lists).toHaveLength(1);
        expect(lists[0].name).toBe("Alice's list");
      },
    });
  });
});

// ── POST /api/lists ───────────────────────────────────────────────────────────

describe("POST /api/lists", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    await testApiHandler({
      appHandler: listsHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: "POST", body: JSON.stringify({ name: "Test" }) });
        expect(res.status).toBe(401);
      },
    });
  });

  it("creates a list and returns 201 with the new list", async () => {
    await testApiHandler({
      appHandler: listsHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Birthday", description: "Gifts for my birthday" }),
        });
        expect(res.status).toBe(201);
        const list = await res.json();
        expect(list.name).toBe("Birthday");
        expect(list.description).toBe("Gifts for my birthday");
        expect(list.id).toBeDefined();
        expect(list.user_id).toBe(userId);
      },
    });
  });

  it("returns 400 when name is missing", async () => {
    await testApiHandler({
      appHandler: listsHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: "No name" }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it("returns 400 when name is blank", async () => {
    await testApiHandler({
      appHandler: listsHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "   " }),
        });
        expect(res.status).toBe(400);
      },
    });
  });
});

// ── GET /api/lists/[id] ───────────────────────────────────────────────────────

describe("GET /api/lists/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);
    const listId = createTestList(db, userId);

    await testApiHandler({
      appHandler: listByIdHandler,
      params: { id: String(listId) },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(401);
      },
    });
  });

  it("returns the list by id", async () => {
    const listId = createTestList(db, userId, "Kitchen");

    await testApiHandler({
      appHandler: listByIdHandler,
      params: { id: String(listId) },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(200);
        const list = await res.json();
        expect(list.name).toBe("Kitchen");
      },
    });
  });

  it("returns 404 for an unknown id", async () => {
    await testApiHandler({
      appHandler: listByIdHandler,
      params: { id: "9999" },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(404);
      },
    });
  });

  it("allows a non-owner to read another user's list", async () => {
    const listId = createTestList(db, otherUserId, "Bob's list");

    await testApiHandler({
      appHandler: listByIdHandler,
      params: { id: String(listId) },
      test: async ({ fetch }) => {
        // Authenticated as alice, reading bob's list
        const res = await fetch();
        expect(res.status).toBe(200);
      },
    });
  });
});

// ── PATCH /api/lists/[id] ─────────────────────────────────────────────────────

describe("PATCH /api/lists/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);
    const listId = createTestList(db, userId);

    await testApiHandler({
      appHandler: listByIdHandler,
      params: { id: String(listId) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "PATCH", body: JSON.stringify({ name: "X" }) });
        expect(res.status).toBe(401);
      },
    });
  });

  it("updates the list name when called by the owner", async () => {
    const listId = createTestList(db, userId, "Old name");

    await testApiHandler({
      appHandler: listByIdHandler,
      params: { id: String(listId) },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New name" }),
        });
        expect(res.status).toBe(200);
        const list = await res.json();
        expect(list.name).toBe("New name");
      },
    });
  });

  it("returns 400 when a non-owner tries to update", async () => {
    const listId = createTestList(db, otherUserId, "Bob's list");

    await testApiHandler({
      appHandler: listByIdHandler,
      params: { id: String(listId) },
      test: async ({ fetch }) => {
        // Authenticated as alice, trying to update bob's list
        const res = await fetch({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Hacked" }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it("returns 400 when updating name to blank", async () => {
    const listId = createTestList(db, userId, "My list");

    await testApiHandler({
      appHandler: listByIdHandler,
      params: { id: String(listId) },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "  " }),
        });
        expect(res.status).toBe(400);
      },
    });
  });
});

// ── DELETE /api/lists/[id] ────────────────────────────────────────────────────

describe("DELETE /api/lists/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);
    const listId = createTestList(db, userId);

    await testApiHandler({
      appHandler: listByIdHandler,
      params: { id: String(listId) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "DELETE" });
        expect(res.status).toBe(401);
      },
    });
  });

  it("deletes an empty list and returns 204", async () => {
    const listId = createTestList(db, userId, "Empty");

    await testApiHandler({
      appHandler: listByIdHandler,
      params: { id: String(listId) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "DELETE" });
        expect(res.status).toBe(204);
      },
    });
  });

  it("returns 400 when a non-owner tries to delete", async () => {
    const listId = createTestList(db, otherUserId, "Bob's list");

    await testApiHandler({
      appHandler: listByIdHandler,
      params: { id: String(listId) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "DELETE" });
        expect(res.status).toBe(400);
      },
    });
  });

  it("returns 409 when the list still has wishes", async () => {
    const listId = createTestList(db, userId, "Has wishes");
    // Insert a wish directly so we don't need to import createWish
    db.prepare(
      `INSERT INTO wishes (user_id, list_id, name, links, rating)
       VALUES (?, ?, 'A wish', '[]', 'It''d be nice')`
    ).run(userId, listId);

    await testApiHandler({
      appHandler: listByIdHandler,
      params: { id: String(listId) },
      test: async ({ fetch }) => {
        const res = await fetch({ method: "DELETE" });
        expect(res.status).toBe(409);
        const data = await res.json();
        expect(data.error).toMatch(/wishes/i);
      },
    });
  });
});

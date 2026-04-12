// Tests for GET|POST /api/wishes/[id]/comments
//
// Key behaviours under test:
//   - Auth guard: both routes return 401 with no session
//   - Privacy: GET returns 403 when the viewer is the wish owner
//   - POST: owner cannot comment on their own wish; empty content rejected

import { describe, it, expect, beforeEach, vi } from "vitest";
import { testApiHandler } from "next-test-api-route-handler";
import { createTestDb, createTestUser, createTestList } from "@/test/helpers";
import type { Db } from "@/lib/db";
import { createWish } from "@/lib/wishes";
import * as commentsHandler from "@/app/api/wishes/[id]/comments/route";

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

// ── GET /api/wishes/[id]/comments ─────────────────────────────────────────────

describe("GET /api/wishes/[id]/comments", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    await testApiHandler({
      appHandler: commentsHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(401);
      },
    });
  });

  it("returns 403 when the viewer is the wish owner", async () => {
    // Alice is the owner — she must not see secret coordination
    await testApiHandler({
      appHandler: commentsHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(403);
      },
    });
  });

  it("returns empty array when no comments exist (non-owner)", async () => {
    await asOtherUser();

    await testApiHandler({
      appHandler: commentsHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
      },
    });
  });

  it("returns comments in chronological order (non-owner)", async () => {
    db.prepare("INSERT INTO secret_comments (wish_id, user_id, content) VALUES (?, ?, ?)").run(
      wishId, otherUserId, "First comment"
    );
    db.prepare("INSERT INTO secret_comments (wish_id, user_id, content) VALUES (?, ?, ?)").run(
      wishId, otherUserId, "Second comment"
    );
    await asOtherUser();

    await testApiHandler({
      appHandler: commentsHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch();
        const comments = await res.json();
        expect(comments).toHaveLength(2);
        expect(comments[0].content).toBe("First comment");
        expect(comments[1].content).toBe("Second comment");
      },
    });
  });
});

// ── POST /api/wishes/[id]/comments ────────────────────────────────────────────

describe("POST /api/wishes/[id]/comments", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    await testApiHandler({
      appHandler: commentsHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Hello" }),
        });
        expect(res.status).toBe(401);
      },
    });
  });

  it("adds a comment and returns 201", async () => {
    await asOtherUser();

    await testApiHandler({
      appHandler: commentsHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "I'll split the cost with you!" }),
        });
        expect(res.status).toBe(201);
        const comment = await res.json();
        expect(comment.content).toBe("I'll split the cost with you!");
        expect(comment.wish_id).toBe(wishId);
        expect(comment.user_id).toBe(otherUserId);
      },
    });
  });

  it("returns 400 when the wish owner tries to comment on their own wish", async () => {
    // Authenticated as alice (the owner)
    await testApiHandler({
      appHandler: commentsHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "My own wish!" }),
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/owner/i);
      },
    });
  });

  it("returns 400 when content is empty", async () => {
    await asOtherUser();

    await testApiHandler({
      appHandler: commentsHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "" }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it("returns 400 when content is whitespace only", async () => {
    await asOtherUser();

    await testApiHandler({
      appHandler: commentsHandler,
      params: { id: String(wishId) },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "   " }),
        });
        expect(res.status).toBe(400);
      },
    });
  });
});

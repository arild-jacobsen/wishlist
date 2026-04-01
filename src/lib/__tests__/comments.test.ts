import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, createTestUser } from "@/test/helpers";
import type { Db } from "@/lib/db";
import { createWish } from "@/lib/wishes";
import {
  addSecretComment,
  getSecretComments,
} from "@/lib/comments";

let db: Db;
let ownerId: number;
let commenterId: number;
let anotherUserId: number;
let wishId: number;

beforeEach(() => {
  db = createTestDb();
  ownerId = createTestUser(db, "jacobsen.arild@gmail.com");
  commenterId = createTestUser(db, "arild.jacobsen@outlook.com");
  anotherUserId = createTestUser(db, "third@example.com");
  const wish = createWish(db, ownerId, {
    name: "Surprise gift",
    rating: "Would love to get this",
  });
  wishId = wish.id;
});

describe("addSecretComment", () => {
  it("lets a non-owner add a secret comment", () => {
    const comment = addSecretComment(db, wishId, commenterId, "I'll get this!");
    expect(comment.id).toBeDefined();
    expect(comment.wish_id).toBe(wishId);
    expect(comment.user_id).toBe(commenterId);
    expect(comment.content).toBe("I'll get this!");
  });

  it("throws if the wish owner tries to comment", () => {
    expect(() =>
      addSecretComment(db, wishId, ownerId, "My own comment")
    ).toThrow();
  });

  it("requires non-empty content", () => {
    expect(() => addSecretComment(db, wishId, commenterId, "")).toThrow();
    expect(() => addSecretComment(db, wishId, commenterId, "   ")).toThrow();
  });

  it("allows multiple comments from different users", () => {
    addSecretComment(db, wishId, commenterId, "I'm in!");
    addSecretComment(db, wishId, anotherUserId, "Me too!");
    const comments = getSecretComments(db, wishId, commenterId);
    expect(comments).toHaveLength(2);
  });
});

describe("getSecretComments", () => {
  it("returns comments for non-owner viewers", () => {
    addSecretComment(db, wishId, commenterId, "Secret plan");
    const comments = getSecretComments(db, wishId, anotherUserId);
    expect(comments).toHaveLength(1);
    expect(comments![0].content).toBe("Secret plan");
  });

  it("returns null when the viewer is the wish owner", () => {
    addSecretComment(db, wishId, commenterId, "Secret plan");
    const comments = getSecretComments(db, wishId, ownerId);
    expect(comments).toBeNull();
  });

  it("returns empty array when no comments exist (non-owner viewer)", () => {
    const comments = getSecretComments(db, wishId, commenterId);
    expect(comments).toEqual([]);
  });

  it("returns comments in chronological order", () => {
    addSecretComment(db, wishId, commenterId, "First");
    addSecretComment(db, wishId, anotherUserId, "Second");
    const comments = getSecretComments(db, wishId, commenterId);
    expect(comments![0].content).toBe("First");
    expect(comments![1].content).toBe("Second");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, createTestUser, createTestList } from "@/test/helpers";
import type { Db } from "@/lib/db";
import { createList, getListsByUser, getListById, updateList, deleteList } from "@/lib/lists";
import { createWish } from "@/lib/wishes";

let db: Db;
let userId: number;
let otherUserId: number;

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db, "jacobsen.arild@gmail.com");
  otherUserId = createTestUser(db, "arild.jacobsen@outlook.com");
});

describe("createList", () => {
  it("creates a list with required fields", () => {
    const list = createList(db, userId, { name: "Birthday" });
    expect(list.id).toBeDefined();
    expect(list.name).toBe("Birthday");
    expect(list.description).toBeNull();
    expect(list.user_id).toBe(userId);
  });

  it("creates a list with a description", () => {
    const list = createList(db, userId, { name: "Kitchen", description: "Cooking stuff" });
    expect(list.description).toBe("Cooking stuff");
  });

  it("trims whitespace from name", () => {
    const list = createList(db, userId, { name: "  Hobbies  " });
    expect(list.name).toBe("Hobbies");
  });

  it("rejects empty name", () => {
    expect(() => createList(db, userId, { name: "" })).toThrow();
  });

  it("rejects whitespace-only name", () => {
    expect(() => createList(db, userId, { name: "   " })).toThrow();
  });
});

describe("getListsByUser", () => {
  it("returns all lists for a user", () => {
    createList(db, userId, { name: "List A" });
    createList(db, userId, { name: "List B" });
    const lists = getListsByUser(db, userId);
    expect(lists).toHaveLength(2);
  });

  it("does not return lists from other users", () => {
    createList(db, userId, { name: "Mine" });
    createList(db, otherUserId, { name: "Theirs" });
    const lists = getListsByUser(db, userId);
    expect(lists).toHaveLength(1);
    expect(lists[0].name).toBe("Mine");
  });

  it("returns empty array when user has no lists", () => {
    expect(getListsByUser(db, userId)).toEqual([]);
  });
});

describe("getListById", () => {
  it("returns the list by id", () => {
    const created = createList(db, userId, { name: "Tech" });
    const found = getListById(db, created.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("Tech");
  });

  it("returns undefined for unknown id", () => {
    expect(getListById(db, 999)).toBeUndefined();
  });
});

describe("updateList", () => {
  it("updates the name", () => {
    const list = createList(db, userId, { name: "Old name" });
    const updated = updateList(db, list.id, userId, { name: "New name" });
    expect(updated.name).toBe("New name");
  });

  it("updates the description", () => {
    const list = createList(db, userId, { name: "Gadgets" });
    const updated = updateList(db, list.id, userId, { description: "Electronics and tech" });
    expect(updated.description).toBe("Electronics and tech");
    // Name should be unchanged
    expect(updated.name).toBe("Gadgets");
  });

  it("throws when a non-owner tries to update", () => {
    const list = createList(db, userId, { name: "Mine" });
    expect(() => updateList(db, list.id, otherUserId, { name: "Hacked" })).toThrow();
  });

  it("throws when resulting name would be empty", () => {
    const list = createList(db, userId, { name: "Valid" });
    expect(() => updateList(db, list.id, userId, { name: "" })).toThrow();
  });
});

describe("deleteList", () => {
  it("deletes an empty list owned by the user", () => {
    const list = createList(db, userId, { name: "Temp" });
    deleteList(db, list.id, userId);
    expect(getListById(db, list.id)).toBeUndefined();
  });

  it("throws when a non-owner tries to delete", () => {
    const list = createList(db, userId, { name: "Mine" });
    expect(() => deleteList(db, list.id, otherUserId)).toThrow();
  });

  it("throws when the list still has wishes (FK RESTRICT)", () => {
    // createTestList uses raw SQL; use createList here so we have the full object
    const list = createList(db, userId, { name: "Has wishes" });
    createWish(db, userId, { list_id: list.id, name: "Wish", rating: "It'd be nice" });
    expect(() => deleteList(db, list.id, userId)).toThrow();
  });
});

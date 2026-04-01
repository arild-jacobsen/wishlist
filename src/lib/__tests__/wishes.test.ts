import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, createTestUser } from "@/test/helpers";
import type { Db } from "@/lib/db";
import {
  createWish,
  getWishesByUser,
  getWishById,
  deleteWish,
  updateWish,
  type WishRating,
} from "@/lib/wishes";

let db: Db;
let userId: number;
let otherUserId: number;

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db, "jacobsen.arild@gmail.com");
  otherUserId = createTestUser(db, "arild.jacobsen@outlook.com");
});

describe("createWish", () => {
  it("creates a wish with required fields", () => {
    const wish = createWish(db, userId, {
      name: "New bicycle",
      rating: "Would make me happy",
    });
    expect(wish.id).toBeDefined();
    expect(wish.name).toBe("New bicycle");
    expect(wish.rating).toBe("Would make me happy");
    expect(wish.description).toBeNull();
    expect(wish.links).toEqual([]);
    expect(wish.user_id).toBe(userId);
  });

  it("creates a wish with all fields", () => {
    const wish = createWish(db, userId, {
      name: "Fancy coffee machine",
      description: "The one with the milk frother",
      links: ["https://example.com/coffee"],
      rating: "Would love to get this",
    });
    expect(wish.description).toBe("The one with the milk frother");
    expect(wish.links).toEqual(["https://example.com/coffee"]);
    expect(wish.rating).toBe("Would love to get this");
  });

  it("rejects invalid ratings", () => {
    expect(() =>
      createWish(db, userId, {
        name: "Test",
        rating: "meh" as WishRating,
      })
    ).toThrow();
  });

  it("requires a name", () => {
    expect(() =>
      createWish(db, userId, {
        name: "",
        rating: "It'd be nice",
      })
    ).toThrow();
  });
});

describe("getWishesByUser", () => {
  it("returns all wishes for a user", () => {
    createWish(db, userId, { name: "Wish 1", rating: "It'd be nice" });
    createWish(db, userId, { name: "Wish 2", rating: "Would make me happy" });
    const wishes = getWishesByUser(db, userId);
    expect(wishes).toHaveLength(2);
  });

  it("does not return wishes from other users", () => {
    createWish(db, userId, { name: "My wish", rating: "It'd be nice" });
    createWish(db, otherUserId, { name: "Their wish", rating: "It'd be nice" });
    const wishes = getWishesByUser(db, userId);
    expect(wishes).toHaveLength(1);
    expect(wishes[0].name).toBe("My wish");
  });

  it("returns empty array when user has no wishes", () => {
    const wishes = getWishesByUser(db, userId);
    expect(wishes).toEqual([]);
  });
});

describe("getWishById", () => {
  it("returns the wish by id", () => {
    const created = createWish(db, userId, {
      name: "Book",
      rating: "It'd be nice",
    });
    const found = getWishById(db, created.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("Book");
  });

  it("returns undefined for unknown id", () => {
    expect(getWishById(db, 999)).toBeUndefined();
  });
});

describe("deleteWish", () => {
  it("deletes a wish owned by the user", () => {
    const wish = createWish(db, userId, {
      name: "Delete me",
      rating: "It'd be nice",
    });
    deleteWish(db, wish.id, userId);
    expect(getWishById(db, wish.id)).toBeUndefined();
  });

  it("throws when a non-owner tries to delete", () => {
    const wish = createWish(db, userId, {
      name: "Mine",
      rating: "It'd be nice",
    });
    expect(() => deleteWish(db, wish.id, otherUserId)).toThrow();
  });
});

describe("updateWish", () => {
  it("updates wish fields", () => {
    const wish = createWish(db, userId, {
      name: "Old name",
      rating: "It'd be nice",
    });
    const updated = updateWish(db, wish.id, userId, { name: "New name" });
    expect(updated.name).toBe("New name");
  });

  it("throws when a non-owner tries to update", () => {
    const wish = createWish(db, userId, {
      name: "Mine",
      rating: "It'd be nice",
    });
    expect(() =>
      updateWish(db, wish.id, otherUserId, { name: "Hacked" })
    ).toThrow();
  });
});

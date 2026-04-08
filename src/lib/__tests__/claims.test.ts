import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, createTestUser, createTestList } from "@/test/helpers";
import type { Db } from "@/lib/db";
import { createWish } from "@/lib/wishes";
import {
  claimWish,
  unclaimWish,
  getClaimsForWish,
  isWishClaimed,
} from "@/lib/claims";

let db: Db;
let ownerId: number;
let claimerId: number;
let anotherUserId: number;
let wishId: number;

beforeEach(() => {
  db = createTestDb();
  ownerId = createTestUser(db, "jacobsen.arild@gmail.com");
  claimerId = createTestUser(db, "arild.jacobsen@outlook.com");
  anotherUserId = createTestUser(db, "third@example.com");
  const listId = createTestList(db, ownerId);
  const wish = createWish(db, ownerId, {
    list_id: listId,
    name: "Nice bike",
    rating: "Would love to get this",
  });
  wishId = wish.id;
});

describe("claimWish", () => {
  it("lets a non-owner claim a wish", () => {
    const claim = claimWish(db, wishId, claimerId);
    expect(claim.wish_id).toBe(wishId);
    expect(claim.user_id).toBe(claimerId);
  });

  it("throws if the owner tries to claim their own wish", () => {
    expect(() => claimWish(db, wishId, ownerId)).toThrow();
  });

  it("throws if the same user claims the same wish twice", () => {
    claimWish(db, wishId, claimerId);
    expect(() => claimWish(db, wishId, claimerId)).toThrow();
  });
});

describe("unclaimWish", () => {
  it("removes an existing claim", () => {
    claimWish(db, wishId, claimerId);
    unclaimWish(db, wishId, claimerId);
    expect(isWishClaimed(db, wishId)).toBe(false);
  });

  it("does nothing if there is no claim", () => {
    expect(() => unclaimWish(db, wishId, claimerId)).not.toThrow();
  });
});

describe("getClaimsForWish", () => {
  it("returns claims for non-owner viewers", () => {
    claimWish(db, wishId, claimerId);
    const claims = getClaimsForWish(db, wishId, anotherUserId);
    expect(claims).toHaveLength(1);
    expect(claims![0].user_id).toBe(claimerId);
  });

  it("returns null when the viewer is the wish owner", () => {
    claimWish(db, wishId, claimerId);
    const claims = getClaimsForWish(db, wishId, ownerId);
    expect(claims).toBeNull();
  });

  it("returns empty array when no claims exist (non-owner viewer)", () => {
    const claims = getClaimsForWish(db, wishId, claimerId);
    expect(claims).toEqual([]);
  });
});

describe("isWishClaimed", () => {
  it("returns false when not claimed", () => {
    expect(isWishClaimed(db, wishId)).toBe(false);
  });

  it("returns true after a claim", () => {
    claimWish(db, wishId, claimerId);
    expect(isWishClaimed(db, wishId)).toBe(true);
  });

  it("returns false after unclaim", () => {
    claimWish(db, wishId, claimerId);
    unclaimWish(db, wishId, claimerId);
    expect(isWishClaimed(db, wishId)).toBe(false);
  });
});

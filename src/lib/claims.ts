// Claim management — "I intend to buy this wish".
//
// A claim links a user to a wish they plan to purchase as a gift.
// The core privacy rule: the wish owner must never see who has claimed
// their wish (so the gift remains a surprise).
//
// Privacy enforcement: getClaimsForWish returns null when the viewer is
// the wish owner. null means "forbidden to see this", [] means "allowed
// to see but nothing here yet". API route handlers convert null to 403.
// See docs/privacy-model.md for the full explanation.

import type { Db } from "@/lib/db";
import { getWishById } from "@/lib/wishes";

// Shape of a claim row from the database.
export interface Claim {
  id: number;
  wish_id: number;
  user_id: number;   // The user who made the claim (intends to buy)
  created_at: string;
}

// Records that `claimerId` intends to buy the wish identified by `wishId`.
// Returns the new claim row.
//
// Throws if:
//   - The wish does not exist
//   - The claimer is the wish owner (can't buy your own wish)
//   - The claimer has already claimed this wish (UNIQUE constraint)
export function claimWish(db: Db, wishId: number, claimerId: number): Claim {
  const wish = getWishById(db, wishId);
  if (!wish) throw new Error("Wish not found");
  if (wish.user_id === claimerId) {
    throw new Error("Cannot claim your own wish");
  }

  try {
    const row = db
      .prepare(
        `INSERT INTO claims (wish_id, user_id) VALUES (?, ?) RETURNING *`
      )
      .get(wishId, claimerId) as Claim;
    return row;
  } catch {
    // The UNIQUE(wish_id, user_id) constraint fires when a user tries to
    // claim the same wish a second time. Re-throw with a readable message.
    throw new Error("Wish already claimed by this user");
  }
}

// Removes `claimerId`'s claim on `wishId`. Safe to call even if no claim exists
// (DELETE on a non-existent row is a no-op in SQLite).
export function unclaimWish(db: Db, wishId: number, claimerId: number): void {
  db.prepare("DELETE FROM claims WHERE wish_id = ? AND user_id = ?").run(
    wishId,
    claimerId
  );
}

// Returns the list of claims for a wish, or null if the viewer is the wish owner.
//
// null  → viewer is the owner; they must not see this data (surprise protection)
// []    → viewer is not the owner; no claims have been made yet
// [...] → viewer is not the owner; here are the claims
//
// Callers must distinguish null from [] — they mean different things.
export function getClaimsForWish(
  db: Db,
  wishId: number,
  viewerId: number
): Claim[] | null {
  const wish = getWishById(db, wishId);
  if (!wish) throw new Error("Wish not found");

  // Privacy rule: return null so callers know to deny access, not just show empty.
  if (wish.user_id === viewerId) return null;

  const rows = db
    .prepare("SELECT * FROM claims WHERE wish_id = ? ORDER BY created_at ASC")
    .all(wishId) as Claim[];
  return rows;
}

// Returns true if at least one user has claimed this wish.
// Used in the dashboard to show the "Claimed" badge (only to non-owners).
export function isWishClaimed(db: Db, wishId: number): boolean {
  const row = db
    .prepare("SELECT id FROM claims WHERE wish_id = ? LIMIT 1")
    .get(wishId);
  return row !== undefined;
}

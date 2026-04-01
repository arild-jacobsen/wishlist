import type { Db } from "@/lib/db";
import { getWishById } from "@/lib/wishes";

export interface Claim {
  id: number;
  wish_id: number;
  user_id: number;
  created_at: string;
}

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
    throw new Error("Wish already claimed by this user");
  }
}

export function unclaimWish(db: Db, wishId: number, claimerId: number): void {
  db.prepare("DELETE FROM claims WHERE wish_id = ? AND user_id = ?").run(
    wishId,
    claimerId
  );
}

export function getClaimsForWish(
  db: Db,
  wishId: number,
  viewerId: number
): Claim[] | null {
  const wish = getWishById(db, wishId);
  if (!wish) throw new Error("Wish not found");

  // Owner cannot see claims (surprise protection)
  if (wish.user_id === viewerId) return null;

  const rows = db
    .prepare("SELECT * FROM claims WHERE wish_id = ? ORDER BY created_at ASC")
    .all(wishId) as Claim[];
  return rows;
}

export function isWishClaimed(db: Db, wishId: number): boolean {
  const row = db
    .prepare("SELECT id FROM claims WHERE wish_id = ? LIMIT 1")
    .get(wishId);
  return row !== undefined;
}

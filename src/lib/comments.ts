// Secret comment management.
//
// Secret comments let non-owners coordinate on a wish without the wish owner
// knowing. The owner cannot read OR write these comments.
//
// The same null convention as claims.ts applies:
//   null  → viewer is the owner (forbidden)
//   []    → viewer is not the owner; no comments yet
//   [...] → viewer is not the owner; here are the comments
//
// See docs/privacy-model.md for full details.

import type { Db } from "@/lib/db";
import { getWishById } from "@/lib/wishes";

// Shape of a secret_comments row from the database.
export interface SecretComment {
  id: number;
  wish_id: number;
  user_id: number;   // The user who wrote this comment
  content: string;
  created_at: string;
}

// Adds a secret comment on a wish. Returns the created comment.
//
// Throws if:
//   - The wish does not exist
//   - The commenter is the wish owner (owner must not see their own surprise)
//   - content is empty or whitespace-only
export function addSecretComment(
  db: Db,
  wishId: number,
  commenterId: number,
  content: string
): SecretComment {
  const wish = getWishById(db, wishId);
  if (!wish) throw new Error("Wish not found");
  if (wish.user_id === commenterId) {
    throw new Error("Wish owner cannot add secret comments");
  }
  if (!content || content.trim() === "") {
    throw new Error("Comment content is required");
  }

  // content.trim() strips leading/trailing whitespace before storing.
  const row = db
    .prepare(
      `INSERT INTO secret_comments (wish_id, user_id, content)
       VALUES (?, ?, ?) RETURNING *`
    )
    .get(wishId, commenterId, content.trim()) as SecretComment;
  return row;
}

// Returns the secret comments for a wish, or null if the viewer is the owner.
//
// Comments are ordered oldest-first (chronological) so conversations read
// naturally top-to-bottom.
//
// null  → viewer is the owner; they must not see these comments
// []    → viewer is not the owner; no comments exist yet
// [...] → viewer is not the owner; comments in chronological order
export function getSecretComments(
  db: Db,
  wishId: number,
  viewerId: number
): SecretComment[] | null {
  const wish = getWishById(db, wishId);
  if (!wish) throw new Error("Wish not found");

  // Privacy rule: owner cannot see the coordination happening behind the scenes.
  if (wish.user_id === viewerId) return null;

  const rows = db
    .prepare(
      "SELECT * FROM secret_comments WHERE wish_id = ? ORDER BY created_at ASC"
    )
    .all(wishId) as SecretComment[];
  return rows;
}

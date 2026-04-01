import type { Db } from "@/lib/db";
import { getWishById } from "@/lib/wishes";

export interface SecretComment {
  id: number;
  wish_id: number;
  user_id: number;
  content: string;
  created_at: string;
}

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

  const row = db
    .prepare(
      `INSERT INTO secret_comments (wish_id, user_id, content)
       VALUES (?, ?, ?) RETURNING *`
    )
    .get(wishId, commenterId, content.trim()) as SecretComment;
  return row;
}

export function getSecretComments(
  db: Db,
  wishId: number,
  viewerId: number
): SecretComment[] | null {
  const wish = getWishById(db, wishId);
  if (!wish) throw new Error("Wish not found");

  // Owner cannot see secret comments
  if (wish.user_id === viewerId) return null;

  const rows = db
    .prepare(
      "SELECT * FROM secret_comments WHERE wish_id = ? ORDER BY created_at ASC"
    )
    .all(wishId) as SecretComment[];
  return rows;
}

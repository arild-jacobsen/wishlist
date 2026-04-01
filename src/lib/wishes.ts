import type { Db } from "@/lib/db";

export type WishRating =
  | "It'd be nice"
  | "Would make me happy"
  | "Would love to get this";

export const WISH_RATINGS: WishRating[] = [
  "It'd be nice",
  "Would make me happy",
  "Would love to get this",
];

export interface Wish {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  links: string[];
  rating: WishRating;
  created_at: string;
}

interface WishRow {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  links: string;
  rating: WishRating;
  created_at: string;
}

function parseWish(row: WishRow): Wish {
  return { ...row, links: JSON.parse(row.links) };
}

export interface CreateWishInput {
  name: string;
  description?: string;
  links?: string[];
  rating: WishRating;
}

export function createWish(
  db: Db,
  userId: number,
  input: CreateWishInput
): Wish {
  if (!input.name || input.name.trim() === "") {
    throw new Error("Wish name is required");
  }
  if (!WISH_RATINGS.includes(input.rating)) {
    throw new Error(`Invalid rating: ${input.rating}`);
  }

  const row = db
    .prepare(
      `INSERT INTO wishes (user_id, name, description, links, rating)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(
      userId,
      input.name.trim(),
      input.description ?? null,
      JSON.stringify(input.links ?? []),
      input.rating
    ) as WishRow;

  return parseWish(row);
}

export function getWishesByUser(db: Db, userId: number): Wish[] {
  const rows = db
    .prepare("SELECT * FROM wishes WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as WishRow[];
  return rows.map(parseWish);
}

export function getWishById(db: Db, id: number): Wish | undefined {
  const row = db
    .prepare("SELECT * FROM wishes WHERE id = ?")
    .get(id) as WishRow | undefined;
  return row ? parseWish(row) : undefined;
}

export function deleteWish(db: Db, id: number, userId: number): void {
  const wish = getWishById(db, id);
  if (!wish || wish.user_id !== userId) {
    throw new Error("Wish not found or not owned by user");
  }
  db.prepare("DELETE FROM wishes WHERE id = ?").run(id);
}

export function updateWish(
  db: Db,
  id: number,
  userId: number,
  input: Partial<CreateWishInput>
): Wish {
  const wish = getWishById(db, id);
  if (!wish || wish.user_id !== userId) {
    throw new Error("Wish not found or not owned by user");
  }

  const updated = {
    name: input.name ?? wish.name,
    description: input.description ?? wish.description,
    links: input.links ?? wish.links,
    rating: input.rating ?? wish.rating,
  };

  if (!updated.name || updated.name.trim() === "") {
    throw new Error("Wish name is required");
  }
  if (!WISH_RATINGS.includes(updated.rating)) {
    throw new Error(`Invalid rating: ${updated.rating}`);
  }

  const row = db
    .prepare(
      `UPDATE wishes SET name = ?, description = ?, links = ?, rating = ?
       WHERE id = ?
       RETURNING *`
    )
    .get(
      updated.name.trim(),
      updated.description,
      JSON.stringify(updated.links),
      updated.rating,
      id
    ) as WishRow;

  return parseWish(row);
}

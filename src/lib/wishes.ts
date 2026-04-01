// Wish CRUD operations.
//
// A "wish" belongs to one user and represents something they'd like to receive.
// It has a name, optional description and links, and a required rating.
//
// Ownership rules enforced here:
//   - Only the owner can update or delete their wish.
// Visibility of claims and comments is NOT enforced here; see claims.ts and
// comments.ts for those rules.

import type { Db } from "@/lib/db";

// The three allowed values for a wish's rating, in ascending order of desire.
// Stored as-is in the database (enforced by a CHECK constraint).
export type WishRating =
  | "It'd be nice"
  | "Would make me happy"
  | "Would love to get this";

// Ordered array of ratings, used for UI (radio buttons) and validation.
export const WISH_RATINGS: WishRating[] = [
  "It'd be nice",
  "Would make me happy",
  "Would love to get this",
];

// The shape returned by all public functions in this module.
// `links` is a parsed string[] — callers never see the raw JSON string.
export interface Wish {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  links: string[];       // Parsed from the JSON string stored in SQLite
  rating: WishRating;
  created_at: string;
}

// Internal type that mirrors the raw database row.
// `links` is still a JSON string here; it gets parsed by parseWish before
// leaving this module.
interface WishRow {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  links: string;         // Raw JSON string, e.g. '["https://example.com"]'
  rating: WishRating;
  created_at: string;
}

// Converts a raw database row to the public Wish shape by parsing the JSON links.
// All functions that read from the database call this before returning.
function parseWish(row: WishRow): Wish {
  return { ...row, links: JSON.parse(row.links) };
}

// Input accepted by createWish. description, links are optional.
export interface CreateWishInput {
  name: string;
  description?: string;
  links?: string[];
  rating: WishRating;
}

// Creates a new wish owned by `userId`. Returns the created wish.
// Throws if name is empty or rating is not one of the three valid values.
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

  // RETURNING * gives us the full inserted row including the auto-generated id
  // and created_at timestamp, so we don't need a follow-up SELECT.
  const row = db
    .prepare(
      `INSERT INTO wishes (user_id, name, description, links, rating)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(
      userId,
      input.name.trim(),
      input.description ?? null,         // NULL stored when no description given
      JSON.stringify(input.links ?? []), // Always store valid JSON, default to empty array
      input.rating
    ) as WishRow;

  return parseWish(row);
}

// Returns all wishes belonging to `userId`, newest first.
export function getWishesByUser(db: Db, userId: number): Wish[] {
  const rows = db
    .prepare("SELECT * FROM wishes WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as WishRow[];
  return rows.map(parseWish);
}

// Returns a single wish by ID, or undefined if not found.
// Callers should check for undefined before using the result.
export function getWishById(db: Db, id: number): Wish | undefined {
  const row = db
    .prepare("SELECT * FROM wishes WHERE id = ?")
    .get(id) as WishRow | undefined;
  return row ? parseWish(row) : undefined;
}

// Deletes a wish. Throws if the wish doesn't exist or is not owned by `userId`.
// Because of ON DELETE CASCADE in the schema, all claims and secret comments
// for this wish are also deleted automatically.
export function deleteWish(db: Db, id: number, userId: number): void {
  const wish = getWishById(db, id);
  if (!wish || wish.user_id !== userId) {
    throw new Error("Wish not found or not owned by user");
  }
  db.prepare("DELETE FROM wishes WHERE id = ?").run(id);
}

// Partially updates a wish. Only the wish owner can do this.
// Any fields omitted from `input` keep their current values.
// Returns the updated wish.
// Throws if the wish doesn't exist, is not owned by `userId`, or if the
// resulting name would be empty or the rating invalid.
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

  // Merge: use provided values where given, fall back to current values.
  const updated = {
    name: input.name ?? wish.name,
    description: input.description ?? wish.description,
    links: input.links ?? wish.links,
    rating: input.rating ?? wish.rating,
  };

  // Re-validate after merge in case caller passed an empty name or bad rating.
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

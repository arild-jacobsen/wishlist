// List CRUD operations.
//
// A "list" belongs to one user and groups related wishes (e.g. "Birthday",
// "Kitchen"). Every wish must belong to exactly one list.
//
// Ownership rules enforced here:
//   - Only the owner can update or delete their list.
// Deletion is further restricted at the database level: ON DELETE RESTRICT on
// wishes.list_id means SQLite will reject the DELETE if any wishes still
// reference the list. The API layer converts that error to 409 Conflict.

import type { Db } from "@/lib/db";

export interface List {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface CreateListInput {
  name: string;
  description?: string;
}

// Creates a new list owned by `userId`. Returns the created list.
// Throws if name is empty.
export function createList(db: Db, userId: number, input: CreateListInput): List {
  if (!input.name || input.name.trim() === "") {
    throw new Error("List name is required");
  }

  // RETURNING * gives us the full inserted row including id and created_at.
  return db
    .prepare(
      `INSERT INTO lists (user_id, name, description)
       VALUES (?, ?, ?)
       RETURNING *`
    )
    .get(
      userId,
      input.name.trim(),
      input.description ?? null
    ) as List;
}

// Returns all lists belonging to `userId`, newest first.
export function getListsByUser(db: Db, userId: number): List[] {
  return db
    .prepare("SELECT * FROM lists WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as List[];
}

// Returns a single list by ID, or undefined if not found.
export function getListById(db: Db, id: number): List | undefined {
  return db
    .prepare("SELECT * FROM lists WHERE id = ?")
    .get(id) as List | undefined;
}

// Partially updates a list. Only the owner can do this.
// Any fields omitted from `input` keep their current values.
// Returns the updated list.
// Throws if the list doesn't exist, is not owned by `userId`, or if the
// resulting name would be empty.
export function updateList(
  db: Db,
  id: number,
  userId: number,
  input: Partial<CreateListInput>
): List {
  const list = getListById(db, id);
  if (!list || list.user_id !== userId) {
    throw new Error("List not found or not owned by user");
  }

  const updated = {
    name: input.name ?? list.name,
    description: input.description ?? list.description,
  };

  if (!updated.name || updated.name.trim() === "") {
    throw new Error("List name is required");
  }

  return db
    .prepare(
      `UPDATE lists SET name = ?, description = ?
       WHERE id = ?
       RETURNING *`
    )
    .get(updated.name.trim(), updated.description, id) as List;
}

// Deletes a list. Throws if the list doesn't exist or is not owned by `userId`.
// If the list still has wishes, SQLite's ON DELETE RESTRICT will throw — let
// that error propagate; the API layer converts it to 409 Conflict.
export function deleteList(db: Db, id: number, userId: number): void {
  const list = getListById(db, id);
  if (!list || list.user_id !== userId) {
    throw new Error("List not found or not owned by user");
  }
  db.prepare("DELETE FROM lists WHERE id = ?").run(id);
}

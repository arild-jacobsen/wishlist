import Database from "better-sqlite3";
import { createSchema, type Db } from "@/lib/db";

export function createTestDb(): Db {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);
  return db;
}

export function createTestUser(db: Db, email: string): number {
  const result = db
    .prepare("INSERT INTO users (email) VALUES (?) RETURNING id")
    .get(email) as { id: number };
  return result.id;
}

// Creates a list owned by `userId` and returns its id.
// Used in test beforeEach blocks that need a list before creating wishes.
export function createTestList(db: Db, userId: number, name = "Test List"): number {
  const result = db
    .prepare("INSERT INTO lists (user_id, name) VALUES (?, ?) RETURNING id")
    .get(userId, name) as { id: number };
  return result.id;
}

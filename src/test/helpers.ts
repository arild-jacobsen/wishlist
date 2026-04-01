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

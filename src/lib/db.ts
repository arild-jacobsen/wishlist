import Database from "better-sqlite3";
import path from "path";

export type Db = Database.Database;

export function createSchema(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS otp_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      links TEXT NOT NULL DEFAULT '[]',
      rating TEXT NOT NULL CHECK (rating IN ('It''d be nice', 'Would make me happy', 'Would love to get this')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wish_id INTEGER NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(wish_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS secret_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wish_id INTEGER NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

let _db: Db | null = null;

export function getDb(): Db {
  if (!_db) {
    const dbPath =
      process.env.DATABASE_URL ||
      path.join(process.cwd(), "wishlist.db");
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    createSchema(_db);
  }
  return _db;
}

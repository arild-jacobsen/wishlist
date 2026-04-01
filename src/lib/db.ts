// Database connection and schema setup.
//
// better-sqlite3 is a synchronous SQLite driver — all queries are blocking.
// This is intentional: Next.js server components and route handlers are async,
// but SQLite operations are fast enough that async is not needed. Avoiding
// async removes a layer of complexity.
//
// The exported `Db` type is used as a parameter type throughout src/lib/ so
// that test code can pass an in-memory database and production code can pass
// the real file-backed database. See src/test/helpers.ts for the test version.

import Database from "better-sqlite3";
import path from "path";

// Re-export the Database type under a shorter alias.
// All library functions accept `db: Db` as their first parameter.
export type Db = Database.Database;

// Creates all tables if they don't already exist.
// Called once when the database is first opened (see getDb below).
// Also called in tests to set up an in-memory database.
export function createSchema(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- One-time password tokens for passwordless login.
    -- email is not a foreign key here because the user row may not exist yet
    -- when the token is created (the user row is created on first successful login).
    -- used = 0 means the token is still valid; used = 1 means it has been consumed.
    CREATE TABLE IF NOT EXISTS otp_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,      -- ISO 8601 string; compared against SQLite's strftime
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- links is a JSON-encoded array of URL strings, e.g. '["https://...","https://..."]'.
    -- SQLite does not have a native array type, so JSON in TEXT is the simplest option.
    -- The application layer parses it back to string[] — see parseWish() in wishes.ts.
    -- rating uses a CHECK constraint so the database rejects invalid values even if
    -- the application layer fails to validate.
    CREATE TABLE IF NOT EXISTS wishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      links TEXT NOT NULL DEFAULT '[]',
      rating TEXT NOT NULL CHECK (rating IN ('It''d be nice', 'Would make me happy', 'Would love to get this')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- A claim means "I intend to buy this wish for its owner".
    -- UNIQUE(wish_id, user_id) prevents a user from claiming the same wish twice.
    -- The restriction that the owner cannot claim their own wish is enforced in
    -- src/lib/claims.ts, not here.
    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wish_id INTEGER NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(wish_id, user_id)
    );

    -- Secret comments are hidden from the wish owner so that other users can
    -- coordinate surprise gifts. The visibility restriction is enforced in
    -- src/lib/comments.ts, not here.
    CREATE TABLE IF NOT EXISTS secret_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wish_id INTEGER NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// Module-level singleton. null until the first call to getDb().
let _db: Db | null = null;

// Returns the database connection, opening it on the first call.
// Subsequent calls return the same instance (singleton pattern).
//
// The database file path comes from DATABASE_URL env var, falling back to
// wishlist.db in the project root. Tests use createTestDb() from
// src/test/helpers.ts instead of this function.
export function getDb(): Db {
  if (!_db) {
    const dbPath =
      process.env.DATABASE_URL ||
      path.join(process.cwd(), "wishlist.db");
    _db = new Database(dbPath);
    // WAL mode: allows concurrent readers alongside a single writer.
    // Better performance than the default journal mode for web apps.
    _db.pragma("journal_mode = WAL");
    // Without this pragma, SQLite ignores REFERENCES constraints entirely.
    _db.pragma("foreign_keys = ON");
    createSchema(_db);
  }
  return _db;
}

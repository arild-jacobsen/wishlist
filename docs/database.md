# Database

## Engine and configuration

The app uses **SQLite** via the `better-sqlite3` npm package. SQLite is a
file-based database — no separate server process is required. The database file
is stored at `./wishlist.db` in the project root (excluded from git via
`.gitignore`).

Two pragmas are set on every connection:

```sql
PRAGMA journal_mode = WAL;   -- Write-Ahead Logging: better read concurrency
PRAGMA foreign_keys = ON;    -- Enforce referential integrity
```

For tests, an **in-memory database** (`:memory:`) is used so each test suite
starts clean with no state from previous runs. See `src/test/helpers.ts`.

## Connection management

`src/lib/db.ts` exports a `getDb()` function that returns a singleton database
instance. The first call opens the file and runs `createSchema()` to ensure all
tables exist; subsequent calls return the same connection.

```
getDb()  →  opens wishlist.db (once)  →  runs createSchema()  →  returns Db instance
```

In tests, `createTestDb()` from `src/test/helpers.ts` creates a fresh in-memory
database for each test case.

## Schema

### `users`

Stores registered users. A user row is created the first time a whitelisted
email successfully logs in (see `getOrCreateUser` in `src/lib/auth.ts`).

```sql
CREATE TABLE users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `otp_tokens`

Stores one-time password codes. Each login request creates a new row.
Tokens expire after 15 minutes and are marked `used = 1` after verification
to prevent replay attacks.

```sql
CREATE TABLE otp_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL,             -- Not a FK — user may not exist yet
  token      TEXT NOT NULL,             -- 6-digit string
  expires_at TEXT NOT NULL,             -- ISO 8601 datetime string
  used       INTEGER NOT NULL DEFAULT 0, -- 0 = unused, 1 = consumed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Note: `email` is not a foreign key here because a token is created before the
user row exists (the user row is only created on successful verification).

### `lists`

Groups related wishes for one user (e.g. "Birthday", "Kitchen"). Every wish
must belong to exactly one list — there is no concept of a loose, unassigned
wish.

```sql
CREATE TABLE lists (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `wishes`

Stores each wish. `links` is a JSON-encoded array of URL strings stored in a
TEXT column. The `rating` column has a CHECK constraint enforcing the three
allowed values. `list_id` references `lists(id)` with `ON DELETE RESTRICT` —
a list cannot be deleted while it still has wishes.

```sql
CREATE TABLE wishes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  list_id     INTEGER NOT NULL REFERENCES lists(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  description TEXT,                        -- Nullable; omitted if not provided
  links       TEXT NOT NULL DEFAULT '[]',  -- JSON array: '["https://..."]'
  rating      TEXT NOT NULL CHECK (rating IN (
                'It''d be nice',
                'Would make me happy',
                'Would love to get this'
              )),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

The `links` JSON array is parsed back to `string[]` by the `parseWish` helper
in `src/lib/wishes.ts` so callers always receive a proper TypeScript array.

### `claims`

Records which user intends to buy which wish. The `UNIQUE(wish_id, user_id)`
constraint prevents a user from claiming the same wish twice. The wish owner
is prevented at the application layer (not the database layer) from claiming
their own wish.

```sql
CREATE TABLE claims (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  wish_id    INTEGER NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(wish_id, user_id)
);
```

### `secret_comments`

Stores comments that are hidden from the wish owner. Enforcement is at the
application layer — see `src/lib/comments.ts`.

```sql
CREATE TABLE secret_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  wish_id    INTEGER NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Cascade deletes and restrictions

| Action | Effect |
|---|---|
| Delete a user | Cascades to delete their lists, wishes (via `user_id`), claims, and comments |
| Delete a list | **Restricted** if any wishes still reference it (`ON DELETE RESTRICT`). The API returns `409 Conflict` in this case. Once empty, the list can be deleted freely. |
| Delete a wish | Cascades to delete its claims and comments |

## Datetime storage

All timestamps are stored as ISO 8601 strings (e.g. `2024-01-15T10:30:00.000Z`)
rather than Unix integers. This is human-readable in database viewers.

**Important:** The OTP expiry check in `src/lib/auth.ts` compares against
`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` rather than `datetime('now')` to
ensure the format matches the ISO strings written by JavaScript's
`new Date().toISOString()`.

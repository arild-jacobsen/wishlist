# Testing

## Philosophy

Tests cover three layers:

1. **Business logic** (`src/lib/`) — functions that enforce the app's rules
2. **API routes** (`src/app/api/`) — HTTP contract: status codes, auth guards, ownership rules, validation
3. **Components** (`src/components/`) — user-facing behaviour: rendering, interactions, API calls, navigation

All tests follow **TDD order**: tests are written before the implementation,
confirmed to fail, then the implementation is written to make them pass.

## Running tests

```bash
npm test              # Run all tests once (CI mode)
npm run test:watch    # Watch mode — re-runs on file changes
npx vitest run src/lib/__tests__/auth.test.ts   # Run a single file
```

## Test infrastructure

### `src/test/setup.ts`

Imported by Vitest before every test file. Currently just imports
`@testing-library/jest-dom` to add custom DOM matchers (e.g. `toBeInTheDocument`).

### `src/test/helpers.ts`

Helper functions shared across test files:

**`createTestDb()`**
Creates a fresh in-memory SQLite database with the full schema applied.
Use this in `beforeEach` to ensure each test starts with a clean database:

```typescript
let db: Db;
beforeEach(() => {
  db = createTestDb();
});
```

**`createTestUser(db, email)`**
Inserts a user row and returns their integer ID. Used to set up test data
without going through the full auth flow:

```typescript
const userId = createTestUser(db, "jacobsen.arild@gmail.com");
```

**`createTestList(db, userId, name?)`**
Inserts a list owned by `userId` and returns its integer ID. Required before
creating wishes in tests, since every wish must belong to a list. `name`
defaults to `"Test List"` if omitted:

```typescript
const listId = createTestList(db, userId);
// or with a custom name:
const listId = createTestList(db, userId, "Birthday");
```

## Lib tests (`src/lib/__tests__/`)

### `auth.test.ts`

| Test group | What it covers |
|---|---|
| `isEmailAllowed` | Whitelist check, case-insensitivity, rejection of unknown emails |
| `generateOTP` | 6-digit format, statistical uniqueness |
| `createOTPToken` | Token stored in DB, expiry set to 15 minutes from now |
| `verifyOTPToken` | Valid token, marks used, rejects used/wrong/expired tokens |
| `sendOTPEmail` | Mock returns the token (smoke test) |
| `getOrCreateUser` | Creates on first call, returns same row on second call |

### `lists.test.ts`

| Test group | What it covers |
|---|---|
| `createList` | Required fields, optional description, whitespace trimming, empty/blank name throws |
| `getListsByUser` | Returns own lists only, handles empty list |
| `getListById` | Returns list, undefined for unknown ID |
| `updateList` | Updates name and description independently, non-owner throws, empty name throws |
| `deleteList` | Owner can delete empty list, non-owner throws, throws when list still has wishes (FK RESTRICT) |

### `wishes.test.ts`

| Test group | What it covers |
|---|---|
| `createWish` | Required/optional fields, invalid rating throws, empty name throws |
| `getWishesByUser` | Returns only own wishes, handles empty list |
| `getWishById` | Returns wish, undefined for unknown ID |
| `deleteWish` | Owner can delete, non-owner throws |
| `updateWish` | Updates fields, non-owner throws |

### `claims.test.ts`

| Test group | What it covers |
|---|---|
| `claimWish` | Non-owner can claim, owner throws, duplicate throws |
| `unclaimWish` | Removes claim, no error if no claim exists |
| `getClaimsForWish` | Returns claims for non-owners, `null` for owner |
| `isWishClaimed` | false when unclaimed, true after claim, false after unclaim |

### `comments.test.ts`

| Test group | What it covers |
|---|---|
| `addSecretComment` | Non-owner can comment, owner throws, empty content throws, multiple users |
| `getSecretComments` | Returns comments for non-owners, `null` for owner, chronological order |

## API route tests (`src/app/api/__tests__/`)

Each file mocks `@/auth` (session) and `@/lib/db` (database) using Vitest's
`vi.mock`. The `@/lib/db` mock uses `importOriginal` to preserve `createSchema`
while replacing only `getDb`. Tests use `next-test-api-route-handler`'s
`testApiHandler` to exercise routes as real HTTP handlers without a running server.

### Mock pattern

```typescript
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getDb: vi.fn() };
});

beforeEach(async () => {
  db = createTestDb();
  userId = createTestUser(db, "alice@example.com");
  const { auth } = await import("@/auth");
  const { getDb } = await import("@/lib/db");
  vi.mocked(getDb).mockReturnValue(db);
  vi.mocked(auth).mockResolvedValue({ user: { id: String(userId) } } as never);
});
```

To test the unauthenticated path, use `mockResolvedValueOnce(null)` before the call.

### `request-otp.test.ts`

| What it covers |
|---|
| 400 for missing or empty email |
| 200 `{ok:true}` for whitelisted and non-whitelisted emails (no enumeration) |
| Email normalised to lowercase before whitelist check |

### `lists.test.ts`

| Route | What it covers |
|---|---|
| `GET /api/lists` | 401, empty array, isolation (only own lists returned) |
| `POST /api/lists` | 401, 201 + new list, missing name → 400, blank name → 400 |
| `GET /api/lists/[id]` | 401, 200, 404, non-owner can read |
| `PATCH /api/lists/[id]` | 401, owner updates name, non-owner → 400, blank name → 400 |
| `DELETE /api/lists/[id]` | 401, 204 for empty list, non-owner → 400, 409 when list has wishes |

### `wishes.test.ts`

| Route | What it covers |
|---|---|
| `GET /api/wishes` | 401, empty, isolation |
| `POST /api/wishes` | 401, 201 with all fields, missing list_id → 400, empty name → 400, invalid rating → 400 |
| `GET /api/wishes/[id]` | 401, 200, 404, non-owner can read |
| `PATCH /api/wishes/[id]` | 401, owner updates, non-owner → 400 |
| `DELETE /api/wishes/[id]` | 401, 204, non-owner → 400, cascade removes claims + comments |

### `claims.test.ts`

| Route | What it covers |
|---|---|
| `GET /api/wishes/[id]/claim` | 401, 403 for owner (privacy rule), empty array, existing claims |
| `POST /api/wishes/[id]/claim` | 401, 201, own wish → 400, duplicate → 400 |
| `DELETE /api/wishes/[id]/claim` | 401, 204, safe no-op when no claim exists |

### `comments.test.ts`

| Route | What it covers |
|---|---|
| `GET /api/wishes/[id]/comments` | 401, 403 for owner (privacy rule), empty array, chronological order |
| `POST /api/wishes/[id]/comments` | 401, 201, owner → 400, empty body → 400, whitespace-only → 400 |

### `users.test.ts`

| Route | What it covers |
|---|---|
| `GET /api/users` | 401, all users with wish counts, ordered by email |
| `GET /api/users/[id]/wishes` | 401, empty array, wishes with claims attached, `null` claims for owner (privacy rule) |

## Component tests (`src/components/__tests__/`)

Component tests use `@testing-library/react` with `@testing-library/user-event`
for realistic user interactions. `next/navigation` is mocked to capture `push`
and `refresh` calls. `global.fetch` is spied on per-test with `vi.spyOn`.

### `SignOutButton.test.tsx`

Verifies the button renders and calls `signOut({ callbackUrl: "/login" })` on click.

### `ThemeToggle.test.tsx`

Verifies initial theme detection (localStorage, OS preference fallback),
`dark` class toggling on `document.documentElement`, localStorage persistence,
and sun/moon icon switching. `window.matchMedia` is stubbed via `vi.stubGlobal`
since jsdom doesn't implement it.

### `ListSelect.test.tsx`

Verifies placeholder option, one option per list, pre-selection via `value` prop,
numeric `onChange` call, "Create new list" link, and empty state.

### `WishActions.test.tsx`

Verifies claim/unclaim button labels, correct HTTP method (POST/DELETE) to the
claim endpoint, `router.refresh()` after success, and error message on failure.

### `SecretCommentForm.test.tsx`

Verifies input + submit render, POST to comments endpoint, input cleared after
success, `router.refresh()` called, error message on failure, and error cleared
on retry.

### `EditWishForm.test.tsx`

Verifies pre-populated form fields (name, description, links, rating, list picker),
PATCH on submit + navigation to wish page, error message on PATCH failure,
DELETE + navigation to dashboard, and cancel-confirm leaves wish untouched.

## Vitest configuration

`vitest.config.ts` sets up:

- **Environment:** `jsdom` — simulates a browser DOM for component tests
- **Globals:** `true` — `describe`, `it`, `expect` etc. are available without imports
- **Setup file:** `src/test/setup.ts`
- **Path alias:** `@` → `src/` (mirrors the TypeScript `paths` config)

## Adding new tests

**Lib tests:** create `src/lib/__tests__/<module>.test.ts`. Use `createTestDb` and
`createTestUser` from `@/test/helpers`. Use `beforeEach` to reset the database.

**API route tests:** create `src/app/api/__tests__/<route>.test.ts`. Mock `@/auth`
and `@/lib/db` using the pattern above. Use `testApiHandler` from
`next-test-api-route-handler`.

**Component tests:** create `src/components/__tests__/<Component>.test.tsx`. Mock
`next/navigation`, spy on `global.fetch`, and use `@testing-library/user-event`
for interactions.

Always write the test first and confirm it fails before writing the implementation.
Test behaviour (return values, thrown errors, DOM output, API calls) — not
internals (SQL strings, class names).

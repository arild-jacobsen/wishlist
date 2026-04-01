# Testing

## Philosophy

Tests cover the **business logic layer** (`src/lib/`) — the functions that
enforce the rules of the app. The Next.js pages and API routes are not
unit-tested; they are thin wrappers that delegate to the library functions.

All tests follow **TDD order**: tests were written before the implementation,
confirmed to fail, then the implementation was written to make them pass.

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

Two helper functions shared across test files:

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

## Test files

### `src/lib/__tests__/auth.test.ts`

Tests the authentication functions in `src/lib/auth.ts`.

| Test group | What it covers |
|---|---|
| `isEmailAllowed` | Whitelist check, case-insensitivity, rejection of unknown emails |
| `generateOTP` | 6-digit format, statistical uniqueness |
| `createOTPToken` | Token stored in DB, expiry set to 15 minutes from now |
| `verifyOTPToken` | Valid token, marks used, rejects used/wrong/expired tokens |
| `sendOTPEmail` | Mock returns the token (smoke test) |
| `getOrCreateUser` | Creates on first call, returns same row on second call |

### `src/lib/__tests__/wishes.test.ts`

Tests `src/lib/wishes.ts`.

| Test group | What it covers |
|---|---|
| `createWish` | Required/optional fields, invalid rating throws, empty name throws |
| `getWishesByUser` | Returns only own wishes, handles empty list |
| `getWishById` | Returns wish, undefined for unknown ID |
| `deleteWish` | Owner can delete, non-owner throws |
| `updateWish` | Updates fields, non-owner throws |

### `src/lib/__tests__/claims.test.ts`

Tests `src/lib/claims.ts`.

| Test group | What it covers |
|---|---|
| `claimWish` | Non-owner can claim, owner throws, duplicate throws |
| `unclaimWish` | Removes claim, no error if no claim exists |
| `getClaimsForWish` | Returns claims for non-owners, `null` for owner |
| `isWishClaimed` | false when unclaimed, true after claim, false after unclaim |

### `src/lib/__tests__/comments.test.ts`

Tests `src/lib/comments.ts`.

| Test group | What it covers |
|---|---|
| `addSecretComment` | Non-owner can comment, owner throws, empty content throws, multiple users |
| `getSecretComments` | Returns comments for non-owners, `null` for owner, chronological order |

## Vitest configuration

`vitest.config.ts` sets up:

- **Environment:** `jsdom` — simulates a browser DOM (needed if component tests are added)
- **Globals:** `true` — `describe`, `it`, `expect` etc. are available without imports
- **Setup file:** `src/test/setup.ts`
- **Path alias:** `@` → `src/` (mirrors the TypeScript `paths` config)

## Adding new tests

1. Create a file at `src/lib/__tests__/<module>.test.ts`.
2. Import `createTestDb` and `createTestUser` from `@/test/helpers`.
3. Use `beforeEach` to reset the database.
4. Write tests that fail first, then implement the feature.

Avoid testing database internals (e.g. checking exact SQL). Test behaviour:
what does the function return, what does it throw, what state change occurs?

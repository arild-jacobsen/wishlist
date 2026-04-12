# Testing Strategy & TDD Guide

Notes on testing approach for this codebase. Reference when writing or reviewing tests.

---

## Current State

**Tool stack already in place:**
- **Vitest** — test runner, fast, native ESM, good TS support
- **jsdom** — simulated browser environment for component tests
- **@testing-library/jest-dom** — DOM matchers (`toBeInTheDocument`, etc.)
- **better-sqlite3 `:memory:`** — in-memory SQLite for fast, isolated lib tests

**What's tested:**
| File | Coverage |
|---|---|
| `src/lib/__tests__/auth.test.ts` | OTP generation/verification, user creation, email whitelist |
| `src/lib/__tests__/wishes.test.ts` | CRUD, ownership enforcement, rating validation |
| `src/lib/__tests__/lists.test.ts` | CRUD, ownership enforcement |
| `src/lib/__tests__/claims.test.ts` | Claim/unclaim, privacy rule (null for owner) |
| `src/lib/__tests__/comments.test.ts` | Add comments, owner blocked, privacy rule |

**What's not yet tested:**
- API route handlers (`src/app/api/**`)
- React components (`src/app/**/page.tsx`, `src/components/**`)
- Auth middleware (`src/middleware.ts`, `src/auth.config.ts`)
- Full user journeys (login → add wish → claim)

---

## Testing Pyramid for This App

```
         ┌──────────────┐
         │   E2E (few)  │  Playwright — login, full wish flow
         │              │  critical paths only, slow
         ├──────────────┤
         │  Integration │  API route handlers, auth-protected routes
         │  (some)      │  use next-test-api-route-handler
         ├──────────────┤
         │  Unit (many) │  lib functions, React components (Client only)
         │              │  fast, isolated, in-memory SQLite
         └──────────────┘
```

**Guiding rule:** Push as much as possible into unit tests. Add integration tests for API contracts. Add E2E tests only for flows that can't be verified at a lower level (async Server Components, full auth flows, real cookie handling).

---

## TDD: Red → Green → Refactor

### The cycle

1. **RED** — Write a failing test that describes the next desired behaviour. Don't write any production code yet. The test should fail for the right reason (not a syntax error).
2. **GREEN** — Write the simplest code that makes the test pass. Don't worry about elegance — just make it green.
3. **REFACTOR** — Clean up both the test and the production code. Remove duplication, improve naming. Keep all tests green throughout.

### Applied to this codebase

**For a new lib function (e.g. a new `getWishesByList` query):**
```
RED:   Add test to wishes.test.ts expecting getWishesByList(db, listId) to return the right wishes
GREEN: Export getWishesByList from wishes.ts with the minimal SQL query
REFACTOR: Check edge cases, error handling, naming
```

**For a new API route (e.g. `GET /api/lists/[id]`):**
```
RED:   Add test using testApiHandler, expect 200 + JSON body for valid id, 404 for unknown
GREEN: Create route.ts, return mock JSON that satisfies the test
REFACTOR: Replace mock with real DB call, add auth check, handle errors
```

**For a new React component:**
```
RED:   Render component, query by role/text, assert expected UI state exists
GREEN: Create component with hardcoded output that passes the assertion
REFACTOR: Replace hardcoded content with real props/logic
```

### When TDD is worth it here

✅ New lib functions (pure logic, easy to test in isolation)
✅ New API route handlers (clear input/output contract)
✅ Bug fixes (write a test that reproduces the bug first, then fix)
✅ Anything involving the privacy model (claims/comments visibility)
✅ Input validation (error paths are easy to forget without a failing test)

⚠️ Complex async Server Component pages — harder to unit test; use E2E instead, or extract the logic into a testable lib function
⚠️ Pure layout/styling changes — not worth testing

---

## Patterns for Each Layer

### Lib functions (existing pattern — keep using this)

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, createTestUser, createTestList } from "@/test/helpers";

let db: Db;
beforeEach(() => {
  db = createTestDb(); // fresh in-memory DB each test
  // ... seed minimal data
});

describe("functionName", () => {
  it("does the expected thing given normal input", () => {
    // Arrange
    const input = ...;
    // Act
    const result = functionName(db, input);
    // Assert
    expect(result).toMatchObject({ ... });
  });

  it("throws / returns null / returns [] for edge case", () => { ... });
});
```

**Key rules:**
- One `beforeEach` that creates a clean DB + minimal seed
- One `describe` per exported function
- Each `it` tests one specific behaviour
- Never share mutable state between tests

### API route handlers

Install first: `npm install --save-dev next-test-api-route-handler`

```typescript
import { testApiHandler } from "next-test-api-route-handler";
import { GET, POST } from "@/app/api/wishes/route";
import { createTestDb, createTestUser, createTestList } from "@/test/helpers";

// Route handlers read auth from the session (mock it)
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "1", email: "test@example.com" } }),
}));
// Route handlers call getDb() — point it at a test DB
vi.mock("@/lib/db", () => {
  const db = createTestDb();
  createTestUser(db, "test@example.com"); // seed user id=1
  return { getDb: () => db };
});

describe("GET /api/wishes", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null); // override for this test
    await testApiHandler({
      appHandler: GET,
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(401);
      },
    });
  });

  it("returns wishes for authenticated user", async () => {
    await testApiHandler({
      appHandler: GET,
      test: async ({ fetch }) => {
        const res = await fetch();
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
      },
    });
  });
});
```

### React components (Client Components only)

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignOutButton } from "@/components/SignOutButton";

// Mock next-auth/react for components that call signOut/signIn
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
  signIn: vi.fn(),
}));

describe("SignOutButton", () => {
  it("calls signOut when clicked", async () => {
    const { signOut } = await import("next-auth/react");
    render(<SignOutButton />);

    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
```

**Query priority (use in this order):**
1. `getByRole` — semantic, accessible, most reliable
2. `getByLabelText` — for form fields
3. `getByText` — for static text
4. `getByPlaceholderText` — fallback for inputs
5. `data-testid` — last resort only (ties tests to implementation)

**Use `userEvent` not `fireEvent`** — userEvent simulates real user behaviour (focus, keyboard, pointer events), fireEvent fires synthetic DOM events which can miss real-world edge cases.

### Async Server Component pages

Don't try to unit test these — they're async, depend on DB/auth, and jsdom can't run them.

**Instead:**
1. Extract the data-fetching/logic into a lib function → unit test the lib function
2. Write E2E tests with Playwright for the full rendered page

---

## Test Naming Conventions

```
describe("functionName / ComponentName / endpoint", () => {
  it("should [expected behaviour] when [condition]", () => { ... });
  it("returns [value] for [input]", () => { ... });
  it("throws when [bad condition]", () => { ... });
});
```

**Good names:**
```
✓ returns null when viewer is the wish owner
✓ throws when non-owner tries to delete
✓ creates wish with all optional fields
✓ returns 401 when session is missing
✓ shows claimed badge for other users' wishes
```

**Bad names:**
```
✗ should work
✗ test 1
✗ handles the database
✗ validates stuff
```

---

## What to Add Next (Priority Order)

1. **API route tests** — the routes have meaningful logic (auth checks, input validation, ownership rules) and zero test coverage. Start with `GET /api/wishes` and `POST /api/wishes`.
2. **Component tests** — `SignOutButton`, `WishActions`, `SecretCommentForm`, `ThemeToggle` are all Client Components with user interactions worth testing.
3. **E2E tests (Playwright)** — login flow (OTP + Google SSO), full "add a wish" journey, claim toggle. Add once the unit/integration layer is solid.

---

## Quick Reference

### Mocking in Vitest

```typescript
vi.mock("@/auth", () => ({ auth: vi.fn() }));     // module-level mock
vi.mocked(auth).mockResolvedValue({ user: ... });  // set return value
vi.mocked(auth).mockResolvedValueOnce(null);       // override once
vi.clearAllMocks();                                // in afterEach/beforeEach
```

### Test helpers (src/test/helpers.ts)

```typescript
createTestDb()                      // fresh in-memory SQLite DB with schema
createTestUser(db, email)           // returns userId
createTestList(db, userId, name?)   // returns listId
```

### AAA structure reminder

```typescript
it("description", () => {
  // Arrange — set up data
  const db = createTestDb();
  const userId = createTestUser(db, "a@example.com");

  // Act — run the code under test
  const result = someFunction(db, userId, input);

  // Assert — check outcome
  expect(result).toEqual(expected);
});
```

### FIRST principles checklist

- **F**ast — in-memory DB, no real network calls, mock external dependencies
- **I**ndependent — `beforeEach` creates fresh DB, no shared mutable state
- **R**epeatable — no `Date.now()` or random values without mocking, no test order dependence
- **S**elf-checking — explicit `expect()` assertions, no manual inspection
- **T**imely — write the test before (TDD) or immediately alongside the production code

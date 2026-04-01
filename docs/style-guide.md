# Code Style Guide

This guide documents the conventions used in this codebase. Follow them when
adding or modifying code so the project stays consistent.

---

## TypeScript

### Strictness

`strict: true` is set in `tsconfig.json`. This enables all strict checks
including `strictNullChecks`. Do not suppress TypeScript errors with `as any`
or `// @ts-ignore` — fix the type instead.

### Explicit types on exported functions

Always annotate return types on exported functions. Inline inference is fine for
local variables.

```typescript
// Good
export function getWishById(db: Db, id: number): Wish | undefined { ... }

// Avoid — callers can't see the return type without jumping to implementation
export function getWishById(db: Db, id: number) { ... }
```

### Type aliases over inline object types

Define named types/interfaces for data shapes. Use `interface` for object
shapes, `type` for unions and aliases.

```typescript
// Good
export interface Wish { id: number; name: string; ... }
export type WishRating = "It'd be nice" | "Would make me happy" | "Would love to get this";

// Avoid
function createWish(db: Db, input: { name: string; rating: string }): { id: number; name: string } { ... }
```

### Type assertions

Use `as Type` sparingly, only at database query boundaries where TypeScript
cannot infer the row shape. Always cast to a specific named type, never `any`.

```typescript
// Acceptable: at DB boundary
const row = db.prepare("SELECT * FROM wishes WHERE id = ?").get(id) as WishRow | undefined;

// Never do this
const row = db.prepare("...").get(id) as any;
```

### Avoiding `!` non-null assertions

Prefer an early return or explicit check over `!`.

```typescript
// Good
const wish = getWishById(db, id);
if (!wish) return undefined;
return wish.name; // TypeScript knows it's non-null here

// Avoid
return getWishById(db, id)!.name;
```

---

## Functions and modules

### One concern per library file

Each file in `src/lib/` handles one domain:
- `db.ts` — database connection only
- `auth.ts` — authentication only
- `wishes.ts` — wish CRUD only
- `claims.ts` — claim logic only
- `comments.ts` — comment logic only

Do not mix concerns. If auth logic needs to read wishes, import from `wishes.ts`.

### Throw for business rule violations

Library functions throw an `Error` when a caller violates a business rule.
API route handlers catch these errors and return `400 Bad Request`.

```typescript
// Good — library throws
export function deleteWish(db: Db, id: number, userId: number): void {
  const wish = getWishById(db, id);
  if (!wish || wish.user_id !== userId) {
    throw new Error("Wish not found or not owned by user");
  }
  db.prepare("DELETE FROM wishes WHERE id = ?").run(id);
}

// API handler catches
try {
  deleteWish(db, Number(id), Number(session.user.id));
  return new NextResponse(null, { status: 204 });
} catch (e) {
  return NextResponse.json({ error: (e as Error).message }, { status: 400 });
}
```

### `null` for "not allowed to see" vs `undefined` for "not found"

- `undefined` — the resource does not exist (e.g. `getWishById` returns
  `undefined` for an unknown ID).
- `null` — the resource exists but the caller is not permitted to see it
  (e.g. `getClaimsForWish` returns `null` when the viewer is the wish owner).

```typescript
// null = forbidden
function getClaimsForWish(db, wishId, viewerId): Claim[] | null

// undefined = not found
function getWishById(db, id): Wish | undefined
```

---

## Database access

### All queries go in `src/lib/`

Never write raw SQL in pages or API routes. All database access must go through
the library functions in `src/lib/`. This keeps SQL in one place and makes it
easy to test.

### Prepared statements

Always use `db.prepare(sql).get(...)` or `db.prepare(sql).all(...)` or
`db.prepare(sql).run(...)`. Never use string interpolation to build SQL queries
— this prevents SQL injection.

```typescript
// Good
db.prepare("SELECT * FROM wishes WHERE user_id = ?").all(userId);

// Never do this
db.exec(`SELECT * FROM wishes WHERE user_id = ${userId}`);
```

### `RETURNING *` for insert/update

Use `RETURNING *` with `.get()` when you need the created/updated row back.
This avoids a second query to fetch the row.

```typescript
const row = db
  .prepare("INSERT INTO wishes (...) VALUES (?) RETURNING *")
  .get(...) as WishRow;
```

### Parse JSON fields at the boundary

The `links` field is stored as a JSON string in SQLite. Always parse it
immediately when reading, using the `parseWish` helper in `src/lib/wishes.ts`.
Never pass raw `WishRow` objects outside of `src/lib/wishes.ts`.

---

## Next.js conventions

### Server Components for data, Client Components for interactivity

- Pages that only need to display data should be Server Components (no
  `"use client"` directive). They can call library functions directly.
- Components that need `useState`, `useEffect`, event handlers, or browser APIs
  must be Client Components (`"use client"` at top of file).
- When a page needs both data and interactivity, make the page a Server Component
  and extract the interactive part into a small Client Component.

```
dashboard/page.tsx (Server — reads DB directly)
  └── SignOutButton.tsx (Client — needs onClick)
  └── WishActions.tsx (Client — needs useState and fetch)
```

### `auth()` for session access

In server components and route handlers, use `auth()` from `@/auth` to read
the current session. Do not use `getServerSession` (NextAuth v4 API).

```typescript
import { auth } from "@/auth";

const session = await auth();
const userId = Number(session!.user!.id);
```

### `params` is a Promise in Next.js 15

In route handlers and dynamic pages, `params` is asynchronous and must be
awaited:

```typescript
// Correct (Next.js 15)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
}
```

### `router.refresh()` after mutations

After a Client Component mutates data via fetch, call `router.refresh()` inside
`startTransition` to re-render the server components with fresh data:

```typescript
import { useTransition } from "react";
const [pending, startTransition] = useTransition();

// After successful fetch:
startTransition(() => router.refresh());
```

---

## API routes

### Always check auth first

Every route handler (except `/api/auth/*`) must begin with an auth check:

```typescript
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Return consistent error shapes

All error responses return a JSON body with an `error` string:

```json
{ "error": "Wish not found or not owned by user" }
```

Use the error message from the thrown `Error` object where possible.

### HTTP status codes

| Situation | Status |
|---|---|
| Missing/invalid session | 401 |
| Owner trying to see claims/comments | 403 |
| Resource not found | 404 |
| Business rule violation (wrong owner, invalid data) | 400 |
| Created successfully | 201 |
| Deleted successfully | 204 (no body) |

---

## Styling

### Tailwind only

All styling is done with Tailwind utility classes. Do not add custom CSS files
or `<style>` blocks. `globals.css` only contains the Tailwind directives.

### Responsive design

The layout uses `max-w-2xl` and `max-w-4xl` containers with `px-6` padding.
No mobile-specific breakpoints have been added, but Tailwind's responsive
prefixes (`sm:`, `md:`, `lg:`) should be used if breakpoints are needed.

### Color meanings

The three rating levels map to consistent colors throughout the UI:

| Rating | Color |
|---|---|
| "It'd be nice" | Gray (`bg-gray-100 text-gray-600`) |
| "Would make me happy" | Yellow (`bg-yellow-100 text-yellow-700`) |
| "Would love to get this" | Rose (`bg-rose-100 text-rose-700`) |

Keep this mapping consistent when adding new places where ratings are displayed.

---

## Testing conventions

### One `describe` per function

Group tests under a `describe` block named after the function being tested.
This makes it easy to find tests for a specific function.

```typescript
describe("createWish", () => { ... });
describe("getWishesByUser", () => { ... });
```

### `beforeEach` resets the database

Always create a fresh in-memory database in `beforeEach`, never share state
between tests:

```typescript
let db: Db;
beforeEach(() => {
  db = createTestDb();
});
```

### Test behaviour, not implementation

Tests should assert what a function *does* (return values, thrown errors,
observable state changes), not *how* it does it. Do not assert SQL queries or
internal implementation details.

### Test file location

Test files live at `src/lib/__tests__/<module>.test.ts`, mirroring the module
they test. The double underscore `__tests__` convention makes it easy to exclude
test files from production builds.

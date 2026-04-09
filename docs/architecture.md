# Architecture

## Layer overview

```
Browser
  │
  ├── /login          → src/app/login/page.tsx          (Client Component)
  ├── /dashboard      → src/app/dashboard/page.tsx      (Server Component)
  ├── /lists/new      → src/app/lists/new/page.tsx       (Client Component)
  ├── /wishes/new     → src/app/wishes/new/page.tsx      (Client Component)
  ├── /wishes/[id]    → src/app/wishes/[id]/page.tsx    (Server Component)
  └── /wishes/[id]/edit → src/app/wishes/[id]/edit/page.tsx (Server + Client)
        │
        └── React components in src/components/
              WishActions.tsx       (Client — claim toggle)
              SecretCommentForm.tsx (Client — comment form)
              EditWishForm.tsx      (Client — edit/delete form)
              ListSelect.tsx        (Client — list picker dropdown)
              SignOutButton.tsx     (Client — sign-out)
  │
  ├── src/middleware.ts   ← Runs on every request; redirects to /login if not authenticated
  │
  └── API Routes (src/app/api/)
        POST /api/auth/request-otp        ← Request an OTP code
        GET|POST /api/auth/[...nextauth]  ← NextAuth session endpoints
        GET|POST /api/lists               ← List / create lists
        GET|PATCH|DELETE /api/lists/[id]  ← Read / update / delete a list
        GET|POST /api/wishes              ← List / create wishes
        GET|PATCH|DELETE /api/wishes/[id] ← Read / update / delete a wish
        GET|POST|DELETE /api/wishes/[id]/claim    ← Claim management
        GET|POST /api/wishes/[id]/comments        ← Secret comments
        GET /api/users                    ← List users
        GET /api/users/[id]/wishes        ← Another user's wishes
              │
              └── Business logic libraries in src/lib/
                    db.ts       ← Database connection and schema
                    auth.ts     ← OTP logic, whitelist, user lookup
                    lists.ts    ← List CRUD
                    wishes.ts   ← Wish CRUD
                    claims.ts   ← Claim rules and queries
                    comments.ts ← Secret comment rules and queries
                    │
                    └── SQLite database file (wishlist.db at project root)
```

## Server vs. Client Components

Next.js App Router distinguishes between Server Components (render on the server,
can access the database directly) and Client Components (run in the browser, must
use `fetch` to call API routes).

**Server Components** (no `"use client"` directive):
- `dashboard/page.tsx` — reads users, lists, and wishes directly from SQLite
- `wishes/[id]/page.tsx` — reads wish, claims, comments directly
- `wishes/[id]/edit/page.tsx` — reads wish to pre-populate form

**Client Components** (`"use client"` at top):
- `login/page.tsx` — manages multi-step form state
- `lists/new/page.tsx` — handles list creation via fetch
- `wishes/new/page.tsx` — fetches user's lists, handles wish creation via fetch
- `components/WishActions.tsx` — toggles claims via fetch
- `components/SecretCommentForm.tsx` — submits comments via fetch
- `components/EditWishForm.tsx` — fetches user's lists, submits updates/deletes via fetch
- `components/ListSelect.tsx` — reusable list picker, no direct fetch (receives lists as props)
- `components/SignOutButton.tsx` — triggers NextAuth signOut

The pattern is: **Server Components own the data-fetching; Client Components own
the interactivity.** This means most pages are fast (no client-side loading
state) and only specific interactive widgets require JavaScript bundles.

## Data flow for a typical page render

Using `/dashboard` as an example:

1. Browser requests `/dashboard`.
2. Middleware (`src/middleware.ts`) reads the JWT cookie. If missing, redirects
   to `/login`.
3. Next.js renders `dashboard/page.tsx` on the server.
4. The page calls `auth()` to get the current user's ID from the JWT.
5. The page calls `getDb()` to get the SQLite connection (singleton).
6. It queries all users, then their lists and wishes, groups wishes by `list_id`,
   and calls `getClaimsForWish` for each wish to determine claim status.
7. The rendered HTML (with all data embedded) is sent to the browser.
8. Client-side JavaScript is minimal — only hydrates the interactive components.

## Request flow for a claim toggle

1. User clicks "I'll get this!" button in `WishActions.tsx` (Client Component).
2. `WishActions` calls `fetch('POST /api/wishes/[id]/claim')`.
3. The route handler in `src/app/api/wishes/[id]/claim/route.ts` runs.
4. It calls `auth()` to verify the session and get `viewerId`.
5. It calls `claimWish(db, wishId, viewerId)` from `src/lib/claims.ts`.
6. `claimWish` checks the wish owner and inserts a row into the `claims` table.
7. The handler returns the new claim row as JSON.
8. `WishActions` calls `router.refresh()` to re-render the server components
   with fresh data (no full page reload).

## Authentication flow

See `docs/auth.md` for the detailed OTP flow. At a structural level:

- `src/auth.config.ts` is the Edge-safe base NextAuth config (session strategy,
  callbacks, pages). It has no Node.js-only imports, so the middleware can use it.
- `src/auth.ts` spreads the base config and adds the Credentials `authorize()`
  callback (which needs `better-sqlite3`). It exports `{ handlers, signIn,
  signOut, auth }`.
- `src/middleware.ts` creates its own NextAuth instance from `auth.config.ts`
  so it can run in the Edge Runtime without pulling in `better-sqlite3`.
- `handlers` are used in `src/app/api/auth/[...nextauth]/route.ts`.
- `auth()` is called in every server component and route handler that needs
  the current user.
- `signIn` / `signOut` are used in Client Components via `next-auth/react`.

## File naming conventions

| Pattern | Meaning |
|---|---|
| `src/app/**/page.tsx` | Next.js page (renders a URL) |
| `src/app/**/route.ts` | Next.js API route handler |
| `src/lib/*.ts` | Pure business logic, no Next.js dependencies |
| `src/components/*.tsx` | Reusable React components (all Client Components) |
| `src/lib/__tests__/*.test.ts` | Unit tests for business logic |
| `src/test/*.ts` | Test infrastructure (setup, helpers) |

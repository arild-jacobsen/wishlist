# Test Coverage Plan

## Current state

64 tests, all in `src/lib/__tests__/`, covering all five library modules.  
No tests exist for API routes, React components, or auth/middleware.

```
src/lib/auth.ts          ✅ covered (22 tests)
src/lib/lists.ts         ✅ covered (13 tests)
src/lib/wishes.ts        ✅ covered (13 tests)
src/lib/claims.ts        ✅ covered (10 tests)
src/lib/comments.ts      ✅ covered (8 tests)

src/app/api/**           ❌ 0 tests (10 route files)
src/components/**        ❌ 0 tests (7 components)
src/middleware.ts        ❌ 0 tests
src/auth.ts              ❌ 0 tests
```

---

## Tooling to add before starting

```bash
npm install --save-dev next-test-api-route-handler @testing-library/user-event
```

- **`next-test-api-route-handler`** — calls App Router handlers in isolation without a running server
- **`@testing-library/user-event`** — simulates real user interactions (type, click, tab) for component tests

---

## Phase 1 — API route handlers
**Priority: high.** Routes contain the real business logic: auth guards, ownership rules, the privacy model, and input validation. These are the highest-value tests in the codebase.

New test file location: `src/app/api/__tests__/`

Each test file will:
- Mock `@/auth` to return a controllable session
- Mock `@/lib/db` to return a fresh in-memory test DB seeded with two users
- Use `testApiHandler` to call the handler directly
- Cover: happy path, unauthenticated (401), bad input (400), ownership/privacy violations

### 1a. OTP request — `request-otp.test.ts`
Target: `src/app/api/auth/request-otp/route.ts`

| Test | Expect |
|---|---|
| Missing email in body | 400 |
| Whitelisted email | 200, `{ ok: true }` |
| Non-whitelisted email | 200, `{ ok: true }` (identical response — avoids whitelist enumeration) |

### 1b. Lists — `lists.test.ts`
Target: `src/app/api/lists/route.ts` + `src/app/api/lists/[id]/route.ts`

| Test | Expect |
|---|---|
| GET /api/lists — no session | 401 |
| GET /api/lists — returns user's lists only | 200, array |
| POST /api/lists — no session | 401 |
| POST /api/lists — creates list | 201, list object |
| POST /api/lists — missing name | 400 |
| GET /api/lists/[id] — no session | 401 |
| GET /api/lists/[id] — returns list | 200 |
| GET /api/lists/[id] — not found | 404 |
| PATCH /api/lists/[id] — owner can update | 200, updated object |
| PATCH /api/lists/[id] — non-owner blocked | 400 |
| DELETE /api/lists/[id] — owner can delete empty list | 204 |
| DELETE /api/lists/[id] — blocked when list has wishes | 409 |
| DELETE /api/lists/[id] — non-owner blocked | 400 |

### 1c. Wishes — `wishes.test.ts`
Target: `src/app/api/wishes/route.ts` + `src/app/api/wishes/[id]/route.ts`

| Test | Expect |
|---|---|
| GET /api/wishes — no session | 401 |
| GET /api/wishes — returns user's wishes | 200, array |
| POST /api/wishes — creates wish | 201, wish object |
| POST /api/wishes — missing list_id | 400 |
| POST /api/wishes — invalid rating | 400 |
| GET /api/wishes/[id] — returns wish | 200 |
| GET /api/wishes/[id] — not found | 404 |
| PATCH /api/wishes/[id] — owner can update | 200 |
| PATCH /api/wishes/[id] — non-owner blocked | 400 |
| DELETE /api/wishes/[id] — owner can delete | 204 |
| DELETE /api/wishes/[id] — non-owner blocked | 400 |

### 1d. Claims — `claims.test.ts`
Target: `src/app/api/wishes/[id]/claim/route.ts`

| Test | Expect |
|---|---|
| GET — viewer is not owner, no claims | 200, `[]` |
| GET — viewer is not owner, with claims | 200, array |
| GET — viewer is wish owner | 403 (privacy rule) |
| POST — claim a wish | 201, claim object |
| POST — owner tries to claim own wish | 400 |
| POST — duplicate claim | 400 |
| DELETE — removes claim | 204 |
| DELETE — no existing claim (safe no-op) | 204 |

### 1e. Comments — `comments.test.ts`
Target: `src/app/api/wishes/[id]/comments/route.ts`

| Test | Expect |
|---|---|
| GET — viewer is not owner | 200, array |
| GET — viewer is wish owner | 403 (privacy rule) |
| POST — adds comment | 201, comment object |
| POST — owner tries to comment on own wish | 400 |
| POST — empty content | 400 |
| POST — whitespace-only content | 400 |

### 1f. Users — `users.test.ts`
Target: `src/app/api/users/route.ts` + `src/app/api/users/[id]/wishes/route.ts`

| Test | Expect |
|---|---|
| GET /api/users — no session | 401 |
| GET /api/users — returns all users with wishCount | 200, array with wishCount |
| GET /api/users/[id]/wishes — viewer sees own wishes (claims: null) | 200, claims null |
| GET /api/users/[id]/wishes — viewer sees other's wishes (claims: []) | 200, claims array |

---

## Phase 2 — React components
**Priority: medium.** Client Components have user interactions (clicks, form submits, API calls) that are worth pinning down.

New test file location: `src/components/__tests__/`

All component tests use React Testing Library + `userEvent`. Mock `next-auth/react`, `next/navigation`, and `fetch` as needed.

### 2a. `SignOutButton.test.tsx`
Simple warm-up. Verify clicking the button calls `signOut({ callbackUrl: "/login" })`.

### 2b. `ThemeToggle.test.tsx`
- Renders null on first render (before mount)
- After mount with `localStorage.theme = "light"`, shows moon icon (click to go dark)
- After mount with `localStorage.theme = "dark"`, shows sun icon (click to go light)
- Clicking toggles `dark` class on `document.documentElement`
- Clicking writes updated preference to `localStorage`
- No stored preference: falls back to `window.matchMedia` OS preference

### 2c. `ListSelect.test.tsx`
- Renders all lists as `<option>` elements
- Calls `onChange` with the selected list's ID when changed
- Shows "Create new list" link pointing to `/lists/new`

### 2d. `SecretCommentForm.test.tsx`
- Renders a text input and Send button
- Submits to `POST /api/wishes/[id]/comments` with the typed content
- Clears the input after successful submission
- Calls `router.refresh()` after success
- Shows error message on API failure
- Does not submit empty content (HTML5 `required` blocks it)

### 2e. `WishActions.test.tsx`
- Renders "I'll get this!" when `isClaimed = false`
- Renders "Remove my claim" when `isClaimed = true`
- Click when unclaimed → `POST /api/wishes/[id]/claim`
- Click when claimed → `DELETE /api/wishes/[id]/claim`
- Calls `router.refresh()` after success
- Shows error message on API failure
- Button disabled while pending

### 2f. `EditWishForm.test.tsx`
More involved — fetches lists on mount.

- On mount: fetches `/api/lists`, populates ListSelect
- All fields pre-filled from `wish` prop
- Submit → `PATCH /api/wishes/[id]` with updated values → redirects to wish detail
- Delete: shows browser confirm, on confirm → `DELETE /api/wishes/[id]` → redirects to dashboard
- Shows error message on API failure

---

## Phase 3 — Auth & middleware
**Priority: lower.** Harder to unit test (Edge Runtime, NextAuth internals), so coverage is less exhaustive here. Focus on the extractable logic.

### 3a. Middleware redirect logic — `middleware.test.ts`

Extract the URL-pattern matching logic into a pure function, unit test it:

```typescript
// src/lib/is-public-path.ts (to extract)
export function isPublicPath(pathname: string): boolean { ... }
```

| Test | Expect |
|---|---|
| `/login` | public (no redirect) |
| `/api/auth/callback/google` | public (no redirect) |
| `/api/auth/session` | public (no redirect) |
| `/dashboard` | protected (redirect to login) |
| `/wishes/42` | protected |
| `/api/wishes` | protected |

Full redirect behaviour (session cookie present/absent) stays in E2E.

### 3b. Auth config callbacks — `auth.config.test.ts`

Test the `jwt` and `session` callbacks in `auth.config.ts` directly:

| Test | Expect |
|---|---|
| `jwt` callback: user present → adds `id` and `email` to token | token has id + email |
| `jwt` callback: no user → passes token through unchanged | token unchanged |
| `session` callback: copies token id + email to session.user | session.user has id + email |

---

## Phase 4 — End-to-end (Playwright)
**Priority: future.** Only warranted once Phase 1 + 2 are done. Covers async Server Components and real cookie/redirect flows that can't be unit tested.

Install: `npm install --save-dev @playwright/test && npx playwright install chromium`

| Journey | What it validates |
|---|---|
| OTP login | Full login flow end-to-end, session cookie set, redirect to dashboard |
| Google SSO | OAuth redirect, whitelist enforcement, session creation |
| Add a wish | Login → dashboard → new wish form → submit → see wish on dashboard |
| Claim a wish | Login as user A, view user B's wish, click claim, badge appears |
| Secret comment | Post a comment, verify visible to non-owner, invisible to owner |
| Dark mode persistence | Toggle, reload, verify mode is preserved |

---

## TDD approach going forward

Write tests before (or alongside) each new feature:

1. Start in Phase 1 — pick one route file, write all its tests first (they'll fail), then implement or verify the route passes them.
2. When fixing a bug — write a test that reproduces the bug first, then fix.
3. When adding a new API endpoint — write the test contract first, then the handler.
4. When adding a new component interaction — write the RTL test first, then wire up the handler.

---

## Suggested order

```
Week 1:  Tooling install → 1b (lists routes) → 1c (wishes routes)
Week 2:  1d (claims) → 1e (comments) → 1f (users)
Week 3:  1a (request-otp) → 2a (SignOutButton) → 2b (ThemeToggle)
Week 4:  2c (ListSelect) → 2d (SecretCommentForm) → 2e (WishActions)
Week 5:  2f (EditWishForm) → 3a (middleware) → 3b (auth callbacks)
Future:  Phase 4 Playwright E2E
```

# Wishlist App — Overview

A small, invite-only web app that lets a group of people share wish lists with
each other. The key privacy rules are:

- When someone marks that they intend to buy a wish ("claims" it), the person
  who created the wish (the "owner") cannot see this — so gifts stay a surprise.
- Other users can leave secret comments on a wish to coordinate privately. The
  wish owner cannot see those comments either.

## Who can access it

Access is restricted to a hardcoded email whitelist in `src/lib/auth.ts`:

```
jacobsen.arild@gmail.com
arild.jacobsen@outlook.com
```

Anyone not on the list is silently rejected during the login flow.

## How login works

There are no passwords. Login is OTP-based (one-time password):

1. User enters their email address.
2. The app generates a random 6-digit code, stores it in the database with a
   15-minute expiry, and "sends" it to the user.
   - In the current (mock) implementation, the code is printed to the server
     console instead of being emailed. See `src/lib/auth.ts → sendOTPEmail`.
3. User types the code into the app.
4. The app verifies the code (not expired, not already used) and creates a
   JWT session via NextAuth.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Full-stack React with server components and route handlers |
| Language | TypeScript | Type safety across the whole codebase |
| Database | SQLite via better-sqlite3 | Zero-infrastructure, synchronous API, easy to run locally |
| Auth | NextAuth v5 (beta) | Handles JWT sessions, CSRF, and callbacks |
| Styling | Tailwind CSS v3 | Utility-first, no separate CSS files needed |
| Testing | Vitest + Testing Library | Fast, Vite-native test runner |

## Running the app

```bash
npm run dev        # Start dev server on http://localhost:3000
npm run build      # Production build
npm run start      # Start production server
npm test           # Run all tests once
npm run test:watch # Run tests in watch mode
```

The `.env.local` file must contain `AUTH_SECRET`. A placeholder is already
committed; replace it with a random string for any real deployment:

```
AUTH_SECRET=change-me-to-a-random-secret-in-production
```

## Key documentation files

| File | Contents |
|---|---|
| `docs/overview.md` | This file — high-level introduction |
| `docs/architecture.md` | How the layers fit together, request flow |
| `docs/database.md` | Schema, table descriptions, data decisions |
| `docs/auth.md` | OTP flow, NextAuth config, session structure |
| `docs/api.md` | All REST endpoints, request/response shapes |
| `docs/privacy-model.md` | How claim and comment visibility is enforced |
| `docs/testing.md` | Test strategy, helpers, how to run tests |
| `docs/style-guide.md` | Code conventions for this project |

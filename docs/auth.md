# Authentication

## Strategy

The app uses **OTP (One-Time Password)** based login — there are no passwords.
Every login attempt generates a fresh 6-digit code that expires in 15 minutes.

Session state is stored in a **JWT cookie** managed by NextAuth v5. No session
table is needed in the database.

## Email whitelist

Only specific email addresses are allowed to create accounts. The list is
hardcoded in `src/lib/auth.ts`:

```typescript
export const ALLOWED_EMAILS = [
  "jacobsen.arild@gmail.com",
  "arild.jacobsen@outlook.com",
];
```

`isEmailAllowed(email)` performs a case-insensitive check against this list.
To add more users, add their email to this array and redeploy.

## OTP login flow (step by step)

```
1. User submits email at /login
        │
        ▼
2. POST /api/auth/request-otp
   - Silently returns { ok: true } for non-whitelisted emails
     (avoids leaking which emails are valid)
   - For whitelisted emails:
       a. Generates a 6-digit code via generateOTP()
       b. Stores the code in otp_tokens with a 15-minute expiry
       c. Calls sendOTPEmail() — currently logs code to the server console
        │
        ▼
3. User sees the "enter your code" step in the UI
        │
        ▼
4. User submits the 6-digit code
        │
        ▼
5. signIn("otp", { email, token }) — NextAuth Credentials provider
        │
        ▼
6. authorize() in src/auth.ts:
   - Checks isEmailAllowed(email)
   - Calls verifyOTPToken(db, email, token):
       a. Looks up token WHERE email = ? AND token = ? AND used = 0
          AND expires_at > now
       b. Marks token as used (used = 1) to prevent replay
       c. Returns true/false
   - If valid: calls getOrCreateUser(db, email) to create user row if needed
   - Returns { id, email } to NextAuth
        │
        ▼
7. NextAuth creates a JWT containing { id, email }
   Stored in a secure HTTP-only cookie
        │
        ▼
8. Browser is redirected to /dashboard
```

## Mock email sending

`sendOTPEmail()` in `src/lib/auth.ts` is a stub. It logs the code to the server
console and returns the token. When running in development:

```
[OTP] Sending code 483921 to jacobsen.arild@gmail.com
```

To implement real email delivery, replace the body of `sendOTPEmail` with calls
to a service like Resend, SendGrid, or Nodemailer. The function signature should
stay the same.

## NextAuth configuration (split files)

The auth config is split into two files to support the Edge Runtime:

| File | Purpose |
|---|---|
| `src/auth.config.ts` | Edge-safe base config: session strategy, JWT/session callbacks, pages. No Node.js-only imports. |
| `src/auth.ts` | Full config: spreads the base config and adds the Credentials `authorize()` callback, which needs `better-sqlite3`. |

The middleware imports from `auth.config.ts`; everything else imports from
`auth.ts`. This split is necessary because Next.js middleware runs in the Edge
Runtime, which does not support Node.js modules like `fs` (required by
`better-sqlite3`).

`src/auth.ts` exports four things used across the app:

| Export | Used in |
|---|---|
| `handlers` | `src/app/api/auth/[...nextauth]/route.ts` — mounts NextAuth endpoints |
| `auth()` | Server components and route handlers — reads current session |
| `signIn()` | `src/app/login/page.tsx` — signs user in from the browser |
| `signOut()` | `src/components/SignOutButton.tsx` — signs user out |

### JWT and session callbacks

Defined in `src/auth.config.ts` (shared by both middleware and full auth).

NextAuth's `jwt` callback runs when a JWT is created or refreshed. It copies
the user's `id` from the `authorize()` return value into the token:

```typescript
jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    token.email = user.email;
  }
  return token;
}
```

The `session` callback runs when a server component calls `auth()`. It copies
`id` and `email` from the token into the session object so pages can access them:

```typescript
session({ session, token }) {
  session.user.id = token.id as string;
  session.user.email = token.email as string;
  return session;
}
```

**Note:** NextAuth's default `Session` type doesn't include `id`. The app uses
the fact that `better-sqlite3` returns integer IDs, but NextAuth stores them as
strings in the JWT. When converting back to a database ID, always use
`Number(session.user.id)`.

## Route protection (middleware)

`src/middleware.ts` creates its own NextAuth instance from the Edge-safe base
config (`auth.config.ts`) and uses the `auth()` wrapper to protect routes:

```typescript
import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");

  if (!isLoggedIn && !isLoginPage && !isApiAuth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});
```

The middleware runs on all requests except `_next/static`, `_next/image`, and
`favicon.ico` (configured via the `matcher` export).

Result: any unauthenticated request to any app page or API (other than the auth
endpoints) is redirected to `/login`.

# Authentication

## Strategy

The app supports two login methods, both managed by NextAuth v5:

1. **Google SSO** — click "Sign in with Google", complete Google OAuth, land on dashboard.
2. **OTP (One-Time Password)** — enter email, receive a 6-digit code, enter code.

In both cases the email whitelist is enforced before a session is granted. Session
state is stored in a **JWT cookie** — no session table is needed in the database.

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

## Google SSO flow (step by step)

```
1. User clicks "Sign in with Google" on /login
        │
        ▼
2. signIn("google", { callbackUrl: "/dashboard" }) — NextAuth redirects to Google
        │
        ▼
3. User completes Google OAuth consent
        │
        ▼
4. Google redirects back to /api/auth/callback/google
        │
        ▼
5. signIn callback in src/auth.ts:
   - Checks isEmailAllowed(user.email) → returns false (rejected) if not on list
   - Calls getOrCreateUser(db, email) to create the user row if needed
   - Overwrites user.id with our database integer ID (as a string)
        │
        ▼
6. jwt callback in src/auth.config.ts:
   - Copies user.id and user.email into the token (same as OTP flow)
        │
        ▼
7. Browser is redirected to /dashboard with a JWT cookie
```

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
       c. Awaits sendOTPEmail() — delivers via Resend in production,
          logs code to the server console in development
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

## Email delivery

`sendOTPEmail()` in `src/lib/auth.ts` is an async function with two modes:

**Development** (no `RESEND_API_KEY`): logs the code to the server console so
you can copy it during local development:

```
[OTP] Sending code 483921 to jacobsen.arild@gmail.com
```

**Production** (`RESEND_API_KEY` set): delivers the code via
[Resend](https://resend.com). The `from` address uses the `RESEND_DOMAIN`
env var (`noreply@<RESEND_DOMAIN>`). The domain must be verified in your
Resend account before emails will be delivered.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `AUTH_SECRET` | Yes | Random string used to sign JWT cookies. Generate with `openssl rand -base64 32`. |
| `AUTH_TRUST_HOST` | Yes (production) | Set to `true` when running behind a reverse proxy (e.g. Railway). Tells NextAuth to trust the forwarded host header. |
| `GOOGLE_CLIENT_ID` | Yes (for Google SSO) | OAuth client ID from Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | Yes (for Google SSO) | OAuth client secret from Google Cloud Console. |
| `RESEND_API_KEY` | Yes (for OTP email) | API key from resend.com. Without this, OTP codes are only logged to the server console. |
| `RESEND_DOMAIN` | Yes (for OTP email) | Verified sending domain, e.g. `mail.yourdomain.com`. Used as the `from` address: `noreply@<RESEND_DOMAIN>`. |
| `DATABASE_URL` | No | Path to the SQLite file. Defaults to `wishlist.db` in the project root. Set this when using a Railway Volume for persistence. |

To set up Google OAuth credentials:
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (type: Web application)
3. Add `http://localhost:3000/api/auth/callback/google` as an authorised redirect URI (for local dev)
4. Copy the client ID and secret into `.env.local`

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
| `signIn()` | `src/app/login/page.tsx` — initiates Google SSO or OTP sign-in |
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

// Determines whether a given URL pathname is publicly accessible without a session.
//
// Used by src/middleware.ts to decide whether to redirect unauthenticated users
// to /login. Extracted into a pure function so it can be unit-tested without
// needing the Edge Runtime or NextAuth internals.
//
// Public paths:
//   /login          — the login page itself
//   /api/auth/*     — NextAuth's own endpoints (session, CSRF, sign-out, callback)

export function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth")
  );
}

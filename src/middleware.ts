// Route protection middleware.
//
// Next.js middleware runs on the Edge (before the page renders) for every
// request that matches the `config.matcher` below. Here we use it to redirect
// unauthenticated users to /login.
//
// The `auth` wrapper from NextAuth adds `req.auth` to the request object.
// req.auth is the decoded session (or null if there is no valid JWT cookie).

import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;

  // These paths must be accessible without a session:
  //   /login          → the login page itself
  //   /api/auth/*     → NextAuth's own endpoints (session, CSRF, sign-out)
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");

  if (!isLoggedIn && !isLoginPage && !isApiAuth) {
    // Redirect to /login, preserving the original URL so we could redirect back
    // after login if needed (not currently implemented).
    return NextResponse.redirect(new URL("/login", req.url));
  }
  // Returning undefined (implicit) means "continue with the request as-is".
});

export const config = {
  // Run on all paths EXCEPT Next.js internals and static files.
  // The negative lookahead (?!...) excludes _next/static, _next/image, favicon.ico.
  // Without this exclusion, the middleware would run on every static asset request,
  // which would be wasteful and could break asset loading for logged-out users.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

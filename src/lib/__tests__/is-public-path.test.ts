// Tests for isPublicPath — the pure function extracted from middleware.ts
// that decides which routes are accessible without a session.
//
// Full redirect behaviour (session cookie present/absent) is tested via E2E
// since it requires the Edge Runtime and a running NextAuth instance.

import { describe, it, expect } from "vitest";
import { isPublicPath } from "@/lib/is-public-path";

describe("isPublicPath", () => {
  // ── Public paths (no session required) ──────────────────────────────────────

  it("treats /login as public", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it("treats /login/ (trailing slash) as public", () => {
    expect(isPublicPath("/login/")).toBe(true);
  });

  it("treats /api/auth/session as public", () => {
    expect(isPublicPath("/api/auth/session")).toBe(true);
  });

  it("treats /api/auth/signin as public", () => {
    expect(isPublicPath("/api/auth/signin")).toBe(true);
  });

  it("treats /api/auth/callback/google as public", () => {
    expect(isPublicPath("/api/auth/callback/google")).toBe(true);
  });

  it("treats /api/auth/csrf as public", () => {
    expect(isPublicPath("/api/auth/csrf")).toBe(true);
  });

  // ── Protected paths (redirect to /login if no session) ────────────────────

  it("treats / (root) as protected", () => {
    expect(isPublicPath("/")).toBe(false);
  });

  it("treats /dashboard as protected", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
  });

  it("treats /wishes/42 as protected", () => {
    expect(isPublicPath("/wishes/42")).toBe(false);
  });

  it("treats /wishes/new as protected", () => {
    expect(isPublicPath("/wishes/new")).toBe(false);
  });

  it("treats /api/wishes as protected", () => {
    expect(isPublicPath("/api/wishes")).toBe(false);
  });

  it("treats /api/lists as protected", () => {
    expect(isPublicPath("/api/lists")).toBe(false);
  });

  it("treats /api/users as protected", () => {
    expect(isPublicPath("/api/users")).toBe(false);
  });

  it("treats /lists/new as protected", () => {
    expect(isPublicPath("/lists/new")).toBe(false);
  });
});

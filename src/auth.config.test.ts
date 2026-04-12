// Tests for the jwt and session callbacks in src/auth.config.ts.
//
// These callbacks are pure transformations — they take objects in and return
// objects out, with no I/O or side effects — so they can be tested directly
// without spinning up a NextAuth server.
//
// What we're NOT testing here:
//   - The authorize() callback in src/auth.ts (covered by integration; it needs
//     a real DB and OTP flow).
//   - The signIn() callback for Google (same reason — needs OAuth flow).
//   - Full redirect behaviour — that requires the Edge Runtime and lives in E2E.

import { describe, it, expect } from "vitest";
import authConfig from "@/auth.config";

// Pull the callbacks out of the config. The `!` is safe here — these callbacks
// are always defined in auth.config.ts and this test exists to verify them.
const { jwt, session } = authConfig.callbacks!;

describe("auth config — jwt callback", () => {
  it("adds id and email to the token when a user object is present", () => {
    const token = jwt({
      token: {},
      user: { id: "42", email: "alice@example.com" },
    } as never);

    expect(token.id).toBe("42");
    expect(token.email).toBe("alice@example.com");
  });

  it("passes the token through unchanged when no user is present (subsequent requests)", () => {
    const existing = { id: "42", email: "alice@example.com", sub: "alice" };
    const token = jwt({ token: existing } as never);

    expect(token).toEqual(existing);
  });

  it("does not clobber existing token fields that are unrelated to the user", () => {
    const token = jwt({
      token: { sub: "existing-sub", iat: 12345 },
      user: { id: "7", email: "bob@example.com" },
    } as never);

    expect(token.sub).toBe("existing-sub");
    expect(token.iat).toBe(12345);
    expect(token.id).toBe("7");
  });
});

describe("auth config — session callback", () => {
  it("copies id and email from the token into session.user", () => {
    const result = session({
      session: { user: { name: null, email: "", image: null }, expires: "2099-01-01" },
      token: { id: "42", email: "alice@example.com" },
    } as never);

    expect(result.user.id).toBe("42");
    expect(result.user.email).toBe("alice@example.com");
  });

  it("preserves other session fields", () => {
    const result = session({
      session: { user: { name: "Alice" }, expires: "2099-01-01" },
      token: { id: "1", email: "alice@example.com" },
    } as never);

    expect(result.expires).toBe("2099-01-01");
    expect(result.user.name).toBe("Alice");
  });
});

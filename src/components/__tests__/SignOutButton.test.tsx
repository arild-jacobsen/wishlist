// Tests for SignOutButton
//
// The component is a thin wrapper around next-auth/react's signOut. We verify:
//   - It renders a button with the correct label
//   - Clicking it calls signOut with the expected callbackUrl

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignOutButton } from "@/components/SignOutButton";

const mockSignOut = vi.fn();

vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

beforeEach(() => {
  mockSignOut.mockClear();
});

describe("SignOutButton", () => {
  it("renders a Sign out button", () => {
    render(<SignOutButton />);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("calls signOut with callbackUrl /login when clicked", async () => {
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});

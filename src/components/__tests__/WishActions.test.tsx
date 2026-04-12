// Tests for WishActions
//
// WishActions shows a "I'll get this!" or "Remove my claim" button
// and calls the claim API on click. After a successful response it calls
// router.refresh(). On failure it shows an error message.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WishActions } from "@/components/WishActions";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

beforeEach(() => {
  mockRefresh.mockClear();
  vi.restoreAllMocks();
});

describe("WishActions — unclaimed", () => {
  it("shows 'I'll get this!' when isClaimed is false", () => {
    render(<WishActions wishId={1} isClaimed={false} />);
    expect(screen.getByRole("button", { name: /i'll get this/i })).toBeInTheDocument();
  });

  it("calls POST on the claim endpoint and refreshes on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 201 })
    );

    render(<WishActions wishId={42} isClaimed={false} />);
    await userEvent.click(screen.getByRole("button", { name: /i'll get this/i }));

    expect(global.fetch).toHaveBeenCalledWith("/api/wishes/42/claim", { method: "POST" });
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledOnce());
  });

  it("shows an error message when the claim API fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Already claimed" }), { status: 400 })
    );

    render(<WishActions wishId={1} isClaimed={false} />);
    await userEvent.click(screen.getByRole("button", { name: /i'll get this/i }));

    await screen.findByText("Already claimed");
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("WishActions — claimed", () => {
  it("shows 'Remove my claim' when isClaimed is true", () => {
    render(<WishActions wishId={1} isClaimed={true} />);
    expect(screen.getByRole("button", { name: /remove my claim/i })).toBeInTheDocument();
  });

  it("calls DELETE on the claim endpoint and refreshes on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 204 })
    );

    render(<WishActions wishId={7} isClaimed={true} />);
    await userEvent.click(screen.getByRole("button", { name: /remove my claim/i }));

    expect(global.fetch).toHaveBeenCalledWith("/api/wishes/7/claim", { method: "DELETE" });
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledOnce());
  });
});

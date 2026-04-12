// Tests for SecretCommentForm
//
// SecretCommentForm renders a text input and submit button. On submit it POSTs
// to /api/wishes/[id]/comments. On success it clears the input and calls
// router.refresh(). On failure it shows an error message from the API response.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SecretCommentForm } from "@/components/SecretCommentForm";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

beforeEach(() => {
  mockRefresh.mockClear();
  vi.restoreAllMocks();
});

describe("SecretCommentForm", () => {
  it("renders the comment input and Send button", () => {
    render(<SecretCommentForm wishId={1} />);
    expect(screen.getByPlaceholderText(/secret comment/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("posts the comment to the correct endpoint on submit", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), { status: 201 })
    );

    render(<SecretCommentForm wishId={99} />);
    await userEvent.type(screen.getByPlaceholderText(/secret comment/i), "Great idea!");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/wishes/99/comments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "Great idea!" }),
      })
    );
  });

  it("clears the input after a successful submit", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), { status: 201 })
    );

    render(<SecretCommentForm wishId={1} />);
    const input = screen.getByPlaceholderText(/secret comment/i) as HTMLInputElement;
    await userEvent.type(input, "Nice pick!");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(input.value).toBe(""));
  });

  it("calls router.refresh() after a successful submit", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), { status: 201 })
    );

    render(<SecretCommentForm wishId={1} />);
    await userEvent.type(screen.getByPlaceholderText(/secret comment/i), "Looks good");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledOnce());
  });

  it("shows an error message when the API returns an error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Owner cannot comment" }), { status: 400 })
    );

    render(<SecretCommentForm wishId={1} />);
    await userEvent.type(screen.getByPlaceholderText(/secret comment/i), "Hey");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText("Owner cannot comment");
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("clears a previous error when retrying", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Something went wrong" }), { status: 500 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 2 }), { status: 201 })
      );

    render(<SecretCommentForm wishId={1} />);
    const input = screen.getByPlaceholderText(/secret comment/i);

    await userEvent.type(input, "First try");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    await screen.findByText("Something went wrong");

    // Second attempt — error should disappear after the successful response
    await userEvent.type(input, " again");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument()
    );
  });
});

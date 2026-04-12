// Tests for EditWishForm
//
// EditWishForm fetches the user's lists on mount, then shows a pre-populated
// form. On submit it PATCHes the wish; on success it navigates to the wish
// detail page. On delete (after confirmation) it DELETEs and navigates to
// the dashboard. On API error it shows an error message.
//
// fetch is mocked globally. window.confirm is stubbed to avoid interactive
// dialogs during tests.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditWishForm } from "@/components/EditWishForm";
import type { Wish } from "@/lib/wishes";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// next/link renders an anchor in jsdom — no special mock needed.

const sampleWish: Wish = {
  id: 5,
  user_id: 1,
  list_id: 2,
  name: "Stand mixer",
  description: "For baking",
  links: ["https://example.com"],
  rating: "Would love to get this",
  created_at: "2026-01-01",
};

const sampleLists = [
  { id: 1, user_id: 1, name: "Kitchen", description: null, created_at: "2026-01-01" },
  { id: 2, user_id: 1, name: "Gadgets", description: null, created_at: "2026-01-02" },
];

beforeEach(() => {
  mockPush.mockClear();
  vi.restoreAllMocks();
  // Default: lists fetch succeeds
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify(sampleLists), { status: 200 })
  );
  // Stub window.confirm so delete tests don't hang waiting for a dialog
  vi.stubGlobal("confirm", () => true);
});

describe("EditWishForm — initial render", () => {
  it("pre-fills the name field with the wish's current name", async () => {
    render(<EditWishForm wish={sampleWish} />);
    const nameInput = await screen.findByDisplayValue("Stand mixer");
    expect(nameInput).toBeInTheDocument();
  });

  it("pre-fills the description field", async () => {
    render(<EditWishForm wish={sampleWish} />);
    expect(await screen.findByDisplayValue("For baking")).toBeInTheDocument();
  });

  it("pre-fills links (one per line)", async () => {
    render(<EditWishForm wish={sampleWish} />);
    expect(await screen.findByDisplayValue("https://example.com")).toBeInTheDocument();
  });

  it("pre-selects the current rating", async () => {
    render(<EditWishForm wish={sampleWish} />);
    const radio = await screen.findByRole("radio", { name: "Would love to get this" }) as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });

  it("shows the list picker once lists are fetched", async () => {
    render(<EditWishForm wish={sampleWish} />);
    // ListSelect appears only when lists.length > 0
    await screen.findByRole("combobox");
    expect(screen.getByRole("option", { name: "Kitchen" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Gadgets" })).toBeInTheDocument();
  });
});

describe("EditWishForm — submit", () => {
  it("PATCHes the wish endpoint and navigates to the wish page on success", async () => {
    // First call = GET /api/lists, second = PATCH /api/wishes/5
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(sampleLists), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 5 }), { status: 200 }));

    render(<EditWishForm wish={sampleWish} />);
    await screen.findByRole("button", { name: /save changes/i });

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/wishes/5"));
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const patchCall = calls.find(
      ([url, opts]: [string, RequestInit]) => url === "/api/wishes/5" && opts?.method === "PATCH"
    );
    expect(patchCall).toBeDefined();
  });

  it("shows an error message when PATCH fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(sampleLists), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Name is required" }), { status: 400 })
      );

    render(<EditWishForm wish={sampleWish} />);
    await screen.findByRole("button", { name: /save changes/i });
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await screen.findByText("Name is required");
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("EditWishForm — delete", () => {
  it("DELETEs the wish and navigates to the dashboard when confirmed", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(sampleLists), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<EditWishForm wish={sampleWish} />);
    await screen.findByRole("button", { name: /delete/i });
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const deleteCall = calls.find(
      ([url, opts]: [string, RequestInit]) => url === "/api/wishes/5" && opts?.method === "DELETE"
    );
    expect(deleteCall).toBeDefined();
  });

  it("does not delete when the user cancels the confirm dialog", async () => {
    vi.stubGlobal("confirm", () => false); // user clicks Cancel
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(sampleLists), { status: 200 })
    );

    render(<EditWishForm wish={sampleWish} />);
    await screen.findByRole("button", { name: /delete/i });
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(mockPush).not.toHaveBeenCalled();
    // fetch should have been called only once (the initial GET /api/lists)
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });
});

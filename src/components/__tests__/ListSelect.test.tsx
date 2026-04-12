// Tests for ListSelect
//
// ListSelect renders a <select> pre-populated with the given lists and a
// "Create new list" link. onChange is called with the numeric list id.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListSelect } from "@/components/ListSelect";
import type { List } from "@/lib/lists";

// next/link renders an <a> in jsdom — no extra mocking needed.

const sampleLists: List[] = [
  { id: 1, user_id: 10, name: "Kitchen", description: null, created_at: "2026-01-01" },
  { id: 2, user_id: 10, name: "Books", description: null, created_at: "2026-01-02" },
];

describe("ListSelect", () => {
  it("renders a select with a disabled placeholder option", () => {
    render(<ListSelect lists={sampleLists} value="" onChange={vi.fn()} />);
    const placeholder = screen.getByRole("option", { name: /select a list/i }) as HTMLOptionElement;
    expect(placeholder.disabled).toBe(true);
  });

  it("renders one option per list", () => {
    render(<ListSelect lists={sampleLists} value="" onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "Kitchen" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Books" })).toBeInTheDocument();
  });

  it("pre-selects the option matching the value prop", () => {
    render(<ListSelect lists={sampleLists} value={2} onChange={vi.fn()} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("2");
  });

  it("calls onChange with the numeric id when the user picks a list", async () => {
    const onChange = vi.fn();
    render(<ListSelect lists={sampleLists} value="" onChange={onChange} />);

    await userEvent.selectOptions(screen.getByRole("combobox"), "Kitchen");

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(1); // number, not string
  });

  it("renders a 'Create new list' link pointing to /lists/new", () => {
    render(<ListSelect lists={sampleLists} value="" onChange={vi.fn()} />);
    const link = screen.getByRole("link", { name: /create new list/i });
    expect(link).toHaveAttribute("href", "/lists/new");
  });

  it("renders an empty select when no lists are provided", () => {
    render(<ListSelect lists={[]} value="" onChange={vi.fn()} />);
    // Only the placeholder option should be present
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });
});

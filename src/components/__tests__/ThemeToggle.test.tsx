// Tests for ThemeToggle
//
// ThemeToggle uses localStorage and window.matchMedia to determine the initial
// theme, then adds/removes the "dark" class on document.documentElement.
//
// The component renders null until mounted (to avoid SSR mismatch), so we
// must wait for the button to appear before asserting.
//
// jsdom doesn't implement matchMedia — we provide a stub via vi.stubGlobal.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "@/components/ThemeToggle";

// Stub window.matchMedia (not implemented in jsdom)
function stubMatchMedia(prefersDark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  // Reset dark class and localStorage before each test
  document.documentElement.classList.remove("dark");
  localStorage.clear();
  stubMatchMedia(false); // default: system is in light mode
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemeToggle", () => {
  it("renders the toggle button once mounted", async () => {
    render(<ThemeToggle />);
    // Button is hidden until the useEffect runs (null during SSR)
    await waitFor(() =>
      expect(screen.getByRole("button")).toBeInTheDocument()
    );
  });

  it("shows moon icon (light mode) when no preference is stored and OS is light", async () => {
    stubMatchMedia(false);
    render(<ThemeToggle />);
    const btn = await screen.findByRole("button");
    expect(btn).toHaveAttribute("aria-label", "Switch to dark mode");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("shows sun icon (dark mode) when OS prefers dark", async () => {
    stubMatchMedia(true);
    render(<ThemeToggle />);
    const btn = await screen.findByRole("button");
    expect(btn).toHaveAttribute("aria-label", "Switch to light mode");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("respects stored 'dark' preference over OS setting", async () => {
    stubMatchMedia(false); // OS is light
    localStorage.setItem("theme", "dark");
    render(<ThemeToggle />);
    const btn = await screen.findByRole("button");
    expect(btn).toHaveAttribute("aria-label", "Switch to light mode");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("respects stored 'light' preference over OS setting", async () => {
    stubMatchMedia(true); // OS prefers dark
    localStorage.setItem("theme", "light");
    render(<ThemeToggle />);
    const btn = await screen.findByRole("button");
    expect(btn).toHaveAttribute("aria-label", "Switch to dark mode");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggles from light to dark on click", async () => {
    stubMatchMedia(false);
    render(<ThemeToggle />);
    const btn = await screen.findByRole("button");

    await userEvent.click(btn);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(btn).toHaveAttribute("aria-label", "Switch to light mode");
  });

  it("toggles from dark to light on click", async () => {
    stubMatchMedia(true);
    render(<ThemeToggle />);
    const btn = await screen.findByRole("button");

    await userEvent.click(btn);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
    expect(btn).toHaveAttribute("aria-label", "Switch to dark mode");
  });
});

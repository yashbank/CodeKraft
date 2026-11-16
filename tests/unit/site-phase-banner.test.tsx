import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SitePhaseBanner } from "@/components/site/SitePhaseBanner";

afterEach(() => {
  document.cookie = "ck_phase=; path=/; max-age=0";
  document.cookie = "a=; path=/; max-age=0";
  vi.unstubAllGlobals();
});

describe("SitePhaseBanner", () => {
  it("renders nothing and makes no request without the cookie", () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    render(<SitePhaseBanner />);
    expect(screen.queryByTestId("site-test-banner")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("shows for ck_phase=testing, still without any request", () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    document.cookie = "a=1; path=/";
    document.cookie = "ck_phase=testing; path=/";
    render(<SitePhaseBanner />);
    expect(screen.getByTestId("site-test-banner")).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });
  it("stays hidden for ck_phase=maintenance", () => {
    document.cookie = "ck_phase=maintenance; path=/";
    render(<SitePhaseBanner />);
    expect(screen.queryByTestId("site-test-banner")).toBeNull();
  });
  it("source never calls fetch", () => {
    const src = readFileSync("src/components/site/SitePhaseBanner.tsx", "utf8");
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toContain("/api/site-phase");
  });
});

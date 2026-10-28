import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LogoStrip, magnifyScale } from "@/components/site/LogoStrip";

const logos = [
  { id: "1", name: "Acme", logoUrl: "https://x.test/a.png", href: "https://acme.test" },
  { id: "2", name: "Globex" },
];

function mockMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduce && q.includes("reduce"),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as never;
}

describe("magnifyScale", () => {
  it("peaks under the pointer, eases down, and is 1 beyond the radius", () => {
    expect(magnifyScale(0)).toBeCloseTo(1.6);
    expect(magnifyScale(70)).toBeLessThan(magnifyScale(10));
    expect(magnifyScale(70)).toBeGreaterThan(1);
    expect(magnifyScale(140)).toBe(1);
    expect(magnifyScale(-500)).toBe(1);
  });
});

describe("LogoStrip", () => {
  it("marquee: renders logos with client-name alt and a focusable link", () => {
    mockMotion(false);
    const { container } = render(<LogoStrip logos={logos} />);
    expect(screen.getAllByAltText("Acme").length).toBeGreaterThan(0);
    expect(container.innerHTML).toContain("ck-marquee");
    expect(container.querySelector("a")?.tabIndex).toBe(0);
  });

  it("reduced motion: no marquee, no duplicate copy", async () => {
    mockMotion(true);
    const { container } = render(<LogoStrip logos={logos} />);
    await vi.waitFor(() => expect(container.innerHTML).not.toContain("ck-marquee"));
    expect(screen.getAllByAltText("Acme")).toHaveLength(1);
  });
});

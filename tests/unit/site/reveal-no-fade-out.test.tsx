import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Reveal } from "@/components/site/Reveal";

type IoCb = (entries: { isIntersecting: boolean }[]) => void;
let fire: IoCb = () => {};

function installObserver() {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IoCb) {
        fire = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("Reveal", () => {
  it("snaps below-the-fold content hidden at hydration (no visible-to-hidden fade an a11y scan can catch half-way)", () => {
    installObserver();
    const { container } = render(<Reveal>x</Reveal>);
    act(() => fire([{ isIntersecting: false }]));
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset.reveal).toBe("pending");
    expect(el.className).toContain("opacity-0");
    expect(el.className).not.toMatch(/\btransition-/);
  });

  it("fades in once scrolled into view", () => {
    installObserver();
    const { container } = render(<Reveal>x</Reveal>);
    act(() => fire([{ isIntersecting: false }]));
    act(() => fire([{ isIntersecting: true }]));
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset.reveal).toBe("in");
    expect(el.className).toContain("transition-[opacity,transform]");
    expect(el.className).toContain("opacity-100");
  });
});

/** setupFiles for the `unit` project (jsdom): jest-dom matchers + browser API polyfills. */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

if (typeof window !== "undefined") {
  if (typeof window.matchMedia !== "function") {
    // jsdom has no matchMedia; components read prefers-color-scheme / reduced-motion via it.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string): MediaQueryList => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  if (typeof window.ResizeObserver !== "function") {
    class ResizeObserverPolyfill implements ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      configurable: true,
      value: ResizeObserverPolyfill,
    });
    Object.defineProperty(globalThis, "ResizeObserver", {
      writable: true,
      configurable: true,
      value: ResizeObserverPolyfill,
    });
  }
}

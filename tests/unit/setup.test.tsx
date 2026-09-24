/** Harness smoke test: jsdom + Testing Library + jest-dom matchers + polyfills are wired. */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

function Counter() {
  const [n, setN] = useState(0);
  return (
    <button type="button" onClick={() => setN((v) => v + 1)}>
      clicked {n}
    </button>
  );
}

describe("unit harness", () => {
  it("renders a button and jest-dom matchers work", async () => {
    render(<Counter />);
    const button = screen.getByRole("button", { name: /clicked 0/ });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(button).toHaveTextContent("clicked 1");
  });

  it("polyfills matchMedia and ResizeObserver", () => {
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(false);
    expect(new ResizeObserver(() => {})).toBeDefined();
  });
});

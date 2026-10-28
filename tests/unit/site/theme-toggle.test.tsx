import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/site/ThemeToggle";

describe("ThemeToggle", () => {
  it("renders nothing when visitors may not switch", () => {
    const { container } = render(<ThemeToggle enabled={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("switches data-theme and persists the ck_theme cookie", () => {
    render(<ThemeToggle enabled />);
    fireEvent.click(screen.getByRole("button", { name: /light theme/i }));
    expect(document.documentElement.dataset.theme).toBe("light-editorial");
    expect(document.cookie).toContain("ck_theme=light-editorial");
    fireEvent.click(screen.getByRole("button", { name: /dark theme/i }));
    expect(document.documentElement.dataset.theme).toBe("dark-cinematic");
  });
});

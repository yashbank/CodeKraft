import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/users/theme-actions", () => ({
  setThemePreference: vi.fn().mockResolvedValue({ ok: true, saved: false }),
}));
vi.stubGlobal("matchMedia", () => ({ matches: false }));

import { ThemeToggle } from "@/components/site/ThemeToggle";

describe("ThemeToggle", () => {
  it("renders nothing when visitors may not switch", () => {
    const { container } = render(<ThemeToggle enabled={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("cycles dark → light → auto → dark, persisting the ck_theme cookie each time", () => {
    document.cookie = "ck_theme=; max-age=0; path=/";
    render(<ThemeToggle enabled />);
    fireEvent.click(screen.getByRole("button", { name: /light theme/i }));
    expect(document.documentElement.dataset.theme).toBe("light-editorial");
    expect(document.cookie).toContain("ck_theme=light-editorial");
    fireEvent.click(screen.getByRole("button", { name: /auto theme/i }));
    expect(document.cookie).toContain("ck_theme=auto");
    fireEvent.click(screen.getByRole("button", { name: /dark theme/i }));
    expect(document.documentElement.dataset.theme).toBe("dark-cinematic");
    expect(document.cookie).toContain("ck_theme=dark-cinematic");
  });
});

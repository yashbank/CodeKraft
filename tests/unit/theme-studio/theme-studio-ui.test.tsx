import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ThemeStudio } from "@/components/admin/system/theme-studio/ThemeStudio";
import { DEFAULT_STUDIO, type StudioValues } from "@/lib/theme-studio";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/settings/admin-mutations", () => ({
  updateSettings: vi.fn(async () => ({ ok: true })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeAll(() => {
  // cmdk / radix popper need these in jsdom
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(cleanup);

function Harness({ start = DEFAULT_STUDIO }: { start?: StudioValues }) {
  const [v, setV] = React.useState(start);
  return (
    <ThemeStudio values={v} onChange={setV} theme="dark-cinematic" presets={[]} disabled={false} />
  );
}

describe("ThemeStudio", () => {
  it("picking options updates the scoped preview variables instantly", () => {
    render(<Harness />);
    const preview = screen.getByTestId("theme-preview");
    expect(preview.style.getPropertyValue("--ck-radius-lg")).toBe("");

    fireEvent.click(screen.getByRole("combobox", { name: "Corner radius" }));
    fireEvent.click(screen.getByRole("option", { name: "Pill" }));
    expect(preview.style.getPropertyValue("--ck-radius-lg")).toBe("32px");

    fireEvent.click(screen.getByRole("combobox", { name: "Heading font" }));
    fireEvent.click(screen.getByRole("option", { name: "Playfair Display (serif)" }));
    expect(preview.style.getPropertyValue("--ck-font-display")).toContain("Playfair Display");

    fireEvent.click(screen.getByRole("combobox", { name: "Button style" }));
    fireEvent.click(screen.getByRole("option", { name: "Pill · Caps · Hard" }));
    expect(preview.getAttribute("data-ck-btn")).toBe("1");
    expect(preview.style.getPropertyValue("--ck-btn-radius")).toBe("999px");
  });

  it("reset restores the defaults and every group shows its note", () => {
    render(<Harness start={{ ...DEFAULT_STUDIO, radius: "pill", palette: "rose" }} />);
    const preview = screen.getByTestId("theme-preview");
    expect(preview.style.getPropertyValue("--ck-radius-lg")).toBe("32px");
    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(preview.style.getPropertyValue("--ck-radius-lg")).toBe("");
    expect(screen.getByRole("combobox", { name: "Accent palette" }).textContent).toContain(
      "Violet",
    );
    expect(screen.getAllByText(/^Changes .+\. See it on .+\.$/).length).toBeGreaterThanOrEqual(10);
  });

  it("saves, applies and deletes a named preset", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("combobox", { name: "Corner radius" }));
    fireEvent.click(screen.getByRole("option", { name: "Sharp" }));
    fireEvent.change(screen.getByLabelText("Preset name"), { target: { value: "Mine" } });
    fireEvent.click(screen.getByRole("button", { name: "Save current as preset" }));
    const row = await screen.findByText("Mine");
    expect(row).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    const preview = screen.getByTestId("theme-preview");
    expect(preview.style.getPropertyValue("--ck-radius-lg")).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Apply preset Mine" }));
    expect(preview.style.getPropertyValue("--ck-radius-lg")).toBe("3px");

    fireEvent.click(screen.getByRole("button", { name: "Delete preset Mine" }));
    await vi.waitFor(() => expect(screen.queryByText("Mine")).toBeNull());
    expect(within(document.body).queryByRole("button", { name: "Apply preset Mine" })).toBeNull();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { KeyboardShortcutsSheet } from "@/components/admin/KeyboardShortcutsSheet";
import { ADMIN_SHORTCUTS, isShortcutsKey } from "@/lib/keyboard-shortcuts";

afterEach(cleanup);

describe("P14-12a keyboard shortcuts sheet", () => {
  it("? is ignored while typing and with modifiers", () => {
    const base = { key: "?", metaKey: false, ctrlKey: false, target: document.body };
    expect(isShortcutsKey(base)).toBe(true);
    expect(isShortcutsKey({ ...base, ctrlKey: true })).toBe(false);
    expect(isShortcutsKey({ ...base, target: document.createElement("input") })).toBe(false);
  });

  it("opens on ? and lists the real shortcuts (palette, sidebar)", () => {
    render(<KeyboardShortcutsSheet area="admin" />);
    expect(screen.queryByText("Keyboard shortcuts")).toBeNull();
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByText("Keyboard shortcuts")).toBeTruthy();
    for (const r of ADMIN_SHORTCUTS) expect(screen.getByText(r.label)).toBeTruthy();
    expect(ADMIN_SHORTCUTS.map((r) => r.keys.join("+"))).toContain("⌘/Ctrl+K");
  });

  it("account lists only what exists there", () => {
    render(<KeyboardShortcutsSheet area="account" />);
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.queryByText("Open search and quick actions")).toBeNull();
    expect(screen.getByText("Show this list")).toBeTruthy();
  });
});

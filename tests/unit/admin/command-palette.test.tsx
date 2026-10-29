import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const items = [
  { group: "Actions" as const, label: "New product", href: "/admin/products/new" },
  { group: "Go to" as const, label: "Orders", href: "/admin/orders" },
];

Element.prototype.scrollIntoView = vi.fn();

function setup() {
  const onNavigate = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <AdminCommandPalette
      open
      onOpenChange={onOpenChange}
      query=""
      onQueryChange={() => {}}
      items={items}
      remoteItems={[]}
      onNavigate={onNavigate}
    />,
  );
  return { onNavigate, onOpenChange };
}

describe("AdminCommandPalette", () => {
  it("exposes combobox + listbox and lists actions before navigation", () => {
    setup();
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "New product",
      "Orders",
    ]);
  });
  it("arrow keys move the selection and Enter navigates", () => {
    const { onNavigate } = setup();
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNavigate).toHaveBeenLastCalledWith("/admin/products/new");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNavigate).toHaveBeenLastCalledWith("/admin/orders");
  });
  it("Esc closes", () => {
    const { onOpenChange } = setup();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

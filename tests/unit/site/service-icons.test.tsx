import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SERVICE_ICONS, toServiceIcon } from "@/components/site/service-icons";
import { ServiceIcon } from "@/components/site/ServiceIcon";
import { ServiceIconPicker } from "@/components/admin/content/ServiceIconPicker";

afterEach(cleanup);

describe("service icon registry", () => {
  it("has 30-40 unique names and each renders an svg", () => {
    const names = SERVICE_ICONS.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThanOrEqual(30);
    expect(names.length).toBeLessThanOrEqual(40);
    for (const n of names) {
      const { container, unmount } = render(<ServiceIcon name={n} />);
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });

  it("falls back to sparkles for unknown or null values", () => {
    expect(toServiceIcon("nope")).toBe("sparkles");
    expect(toServiceIcon("toString")).toBe("sparkles");
    expect(toServiceIcon(null)).toBe("sparkles");
    expect(toServiceIcon("cloud")).toBe("cloud");
  });
});

describe("ServiceIconPicker", () => {
  it("filters by search and selects with the keyboard", () => {
    const onChange = vi.fn();
    render(<ServiceIconPicker value="sparkles" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /premium/i }));
    const search = screen.getByLabelText("Search icons");
    fireEvent.change(search, { target: { value: "secur" } });
    const btn = screen.getByRole("button", { name: "Security" });
    expect(screen.queryByRole("button", { name: "Mobile" })).toBeNull();
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn); // Enter on a native button fires click
    expect(onChange).toHaveBeenCalledWith("shield");
  });
});

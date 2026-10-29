import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/settings/site-reset-actions", () => ({
  previewSiteReset: vi.fn(),
  requestSiteResetAction: vi.fn(),
  backupSiteReset: vi.fn(async () => ({ ok: true, data: "{}" })),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { DangerZoneSection } from "@/components/admin/system/DangerZoneSection";

describe("DangerZoneSection", () => {
  it("ticking one category checks only it and lists dependencies separately", async () => {
    const u = userEvent.setup();
    render(<DangerZoneSection siteName="Acme" />);
    await u.click(screen.getByRole("checkbox", { name: /customers/i }));
    const checked = screen
      .getAllByRole("checkbox")
      .filter((c) => c.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
    expect(screen.getByText(/Also removed because they depend on it/i)).toBeInTheDocument();
    await u.click(screen.getByRole("checkbox", { name: /customers/i }));
    expect(screen.queryByText(/Also removed/i)).toBeNull();
  });

  it("enables Request only with backup and the exact (trimmed) name", async () => {
    const u = userEvent.setup();
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    render(<DangerZoneSection siteName="Acme" />);
    await u.click(screen.getByRole("checkbox", { name: /customers/i }));
    await u.click(screen.getByRole("button", { name: /download backup/i }));
    const btn = screen.getByRole("button", { name: /request site reset/i });
    const input = screen.getByLabelText(/to confirm/i);
    await u.type(input, "acme");
    expect(btn).toBeDisabled();
    await u.clear(input);
    await u.type(input, "  Acme ");
    expect(btn).toBeEnabled();
  });

  it("explains why Request is disabled and clears each reason as it is done", async () => {
    const u = userEvent.setup();
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    render(<DangerZoneSection siteName="Acme" />);
    const btn = screen.getByRole("button", { name: /request site reset/i });
    const why = () => screen.getByTestId("reset-blockers").textContent ?? "";
    expect(why()).toMatch(/select/i);
    await u.click(screen.getByRole("checkbox", { name: /customers/i }));
    await u.type(screen.getByLabelText(/to confirm/i), "Acme");
    expect(btn).toBeDisabled();
    expect(why()).toMatch(/download the backup/i);
    expect(why()).not.toMatch(/site name/i);
    await u.click(screen.getByRole("button", { name: /download backup/i }));
    expect(btn).toBeEnabled();
    expect(screen.queryByTestId("reset-blockers")).toBeNull();
  });
});

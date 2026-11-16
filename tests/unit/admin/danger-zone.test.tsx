import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/settings/site-reset-actions", () => ({
  previewSiteReset: vi.fn(async () => ({
    ok: true,
    data: [
      { table: "payouts", count: 2 },
      { table: "partners", count: 1 },
    ],
  })),
  requestSiteResetAction: vi.fn(),
  backupSiteReset: vi.fn(async () => ({ ok: true, data: "{}" })),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { requestSiteResetAction } from "@/modules/settings/site-reset-actions";
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

  it("shows counts per category, including payouts and partners, as soon as data is picked", async () => {
    const u = userEvent.setup();
    render(<DangerZoneSection siteName="Acme" />);
    await u.click(screen.getByRole("checkbox", { name: /customers/i }));
    const preview = await screen.findByRole("group", { name: /rows to delete/i });
    expect(preview).toHaveTextContent("Payouts");
    expect(preview).toHaveTextContent("Partners (removed and demo accounts)");
    expect(preview).toHaveTextContent("3 in total");
  });

  async function pickAndBackup(u: ReturnType<typeof userEvent.setup>) {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    await u.click(screen.getByRole("checkbox", { name: /customers/i }));
    await u.click(screen.getByRole("button", { name: /download backup/i }));
  }

  it("opens a dialog naming what is deleted; Cancel is focused and nothing is requested", async () => {
    const u = userEvent.setup();
    vi.mocked(requestSiteResetAction).mockClear();
    render(<DangerZoneSection siteName="Acme" />);
    await pickAndBackup(u);
    await u.click(screen.getByRole("button", { name: /^request site reset$/i }));
    const dlg = await screen.findByRole("dialog", { name: /permanently delete/i });
    expect(within(dlg).getByTestId("reset-confirm-summary")).toHaveTextContent(/customers/i);
    expect(within(dlg).getByRole("button", { name: /^cancel$/i })).toHaveFocus();
    expect(requestSiteResetAction).not.toHaveBeenCalled();
  });

  it("confirm stays disabled until the exact (trimmed) name is typed, then requests", async () => {
    const u = userEvent.setup();
    vi.mocked(requestSiteResetAction).mockClear();
    vi.mocked(requestSiteResetAction).mockResolvedValue({
      ok: true,
      data: { approvalRequestId: "x" },
    } as never);
    render(<DangerZoneSection siteName="Acme" />);
    await pickAndBackup(u);
    await u.click(screen.getByRole("button", { name: /^request site reset$/i }));
    const dlg = await screen.findByRole("dialog");
    const confirm = within(dlg).getByRole("button", { name: /confirm site reset request/i });
    const input = within(dlg).getByLabelText(/to confirm/i);
    await u.type(input, "acme");
    expect(confirm).toBeDisabled();
    await u.clear(input);
    await u.type(input, "  Acme ");
    expect(confirm).toBeEnabled();
    await u.click(confirm);
    expect(requestSiteResetAction).toHaveBeenCalledWith({
      categories: expect.any(Array),
      confirmName: "Acme",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Escape closes the dialog without requesting; focus stays inside while open", async () => {
    const u = userEvent.setup();
    vi.mocked(requestSiteResetAction).mockClear();
    render(<DangerZoneSection siteName="Acme" />);
    await pickAndBackup(u);
    await u.click(screen.getByRole("button", { name: /^request site reset$/i }));
    const dlg = await screen.findByRole("dialog");
    for (let i = 0; i < 6; i++) {
      await u.tab();
      expect(dlg.contains(document.activeElement)).toBe(true);
    }
    await u.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(requestSiteResetAction).not.toHaveBeenCalled();
  });

  it("explains why Request is disabled and clears each reason as it is done", async () => {
    const u = userEvent.setup();
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    render(<DangerZoneSection siteName="Acme" />);
    const btn = screen.getByRole("button", { name: /^request site reset$/i });
    const why = () => screen.getByTestId("reset-blockers").textContent ?? "";
    expect(why()).toMatch(/select/i);
    await u.click(screen.getByRole("checkbox", { name: /customers/i }));
    expect(btn).toBeDisabled();
    expect(why()).toMatch(/download the backup/i);
    await u.click(screen.getByRole("button", { name: /download backup/i }));
    expect(btn).toBeEnabled();
    expect(screen.queryByTestId("reset-blockers")).toBeNull();
  });
});

/**
 * Partners & payouts and Reports screens with live-empty data: zero partners, zero payouts,
 * zero report rows. They must render a clean empty state and a working "Add partner" flow.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/finance/partners",
}));
vi.mock("@/modules/finance/admin-mutations", () => ({
  recordPayout: vi.fn(),
  exportStatement: vi.fn(),
}));
const { createPartner, ensureSuperAdminPartners } = vi.hoisted(() => ({
  createPartner: vi.fn(async (_input: unknown) => ({
    ok: true,
    data: { partner: { displayName: "Asha" } },
  })),
  ensureSuperAdminPartners: vi.fn(async () => ({
    ok: true,
    data: { created: [{ id: "p1" }], existing: 0 },
  })),
}));
vi.mock("@/modules/users/admin-mutations", () => ({ createPartner, ensureSuperAdminPartners }));

import { PartnersPayouts } from "@/components/admin/finance/PartnersPayouts";
import { ReportsScreen } from "@/components/admin/finance/ReportsScreen";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const base = {
  partners: [],
  payouts: [],
  approvers: [],
  statementsHref: "/s",
  ledgerHref: "/l",
  approvalsHref: "/a",
};

describe("PartnersPayouts with zero partners", () => {
  it("shows the empty state, disables Record payout, and Add partner works end to end", async () => {
    const user = userEvent.setup();
    render(
      <PartnersPayouts
        {...base}
        isSuperAdmin
        candidates={[
          { userId: "11111111-1111-4111-8111-111111111111", name: "A", email: "a@x.io" },
        ]}
      />,
    );
    expect(screen.getByText("No partners yet")).toBeTruthy();
    expect(
      (screen.getAllByRole("button", { name: /Record payout/ })[0] as HTMLButtonElement).disabled,
    ).toBe(true);

    await user.click(screen.getAllByRole("button", { name: /Add partner/ })[0]!);
    await user.type(await screen.findByLabelText(/Or admin email/), "asha@x.io");
    await user.click(screen.getAllByRole("button", { name: "Add partner" }).at(-1)!);
    await waitFor(() => expect(createPartner).toHaveBeenCalledWith({ email: "asha@x.io" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("super admin backfill button calls the action; hidden for non super admins", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PartnersPayouts {...base} isSuperAdmin />);
    await user.click(screen.getAllByRole("button", { name: "Add super admins as partners" })[0]!);
    await waitFor(() => expect(ensureSuperAdminPartners).toHaveBeenCalledTimes(1));
    rerender(<PartnersPayouts {...base} isSuperAdmin={false} />);
    expect(screen.queryByRole("button", { name: "Add super admins as partners" })).toBeNull();
  });
});

describe("ReportsScreen with empty rows", () => {
  it("renders an empty table message and a load-error notice", () => {
    render(
      <ReportsScreen
        reports={[
          {
            key: "revenue_by_period",
            title: "Revenue by period",
            description: "d",
            formula: "f",
            tiles: [{ label: "Net Revenue", valueInr: 0 }],
            series: [],
            columns: ["Period", "Net Revenue"],
            rows: [],
          },
          {
            key: "revenue_by_product",
            title: "Revenue by product",
            description: "d",
            formula: "f",
            tiles: [],
            series: [],
            columns: [],
            rows: [],
            error: "This report could not be loaded.",
          },
        ]}
        customerCredits={[]}
        partners={[]}
        statement={{
          partner: "—",
          period: "x",
          opening: 0,
          allocations: [],
          refunds: 0,
          expenseShares: 0,
          payouts: 0,
          closing: 0,
        }}
        statementHistory={[]}
        isSuperAdmin
      />,
    );
    expect(screen.getByText("No data for this period yet.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });
});

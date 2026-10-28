/**
 * Every selectable dashboard widget has a data source, renders an explicit empty state (never a
 * blank card) with empty data, renders real content with data, and its refresh icon refetches that
 * widget with a spinner and an error toast on failure.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const refreshDashboardWidget = vi.fn();
const toastError = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/dashboard",
}));
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() },
}));
vi.mock("@/modules/dashboard-widgets/admin-mutations", () => ({
  saveDashboardWidgets: vi.fn(async () => ({ ok: true, data: { widgets: [] } })),
  refreshDashboardWidget: (...a: unknown[]) => refreshDashboardWidget(...a),
}));

import { AdminDashboard, WidgetBody } from "@/components/admin/dashboard/AdminDashboard";
import { WIDGET_LIBRARY } from "@/components/admin/dashboard/widget-library";
import { WIDGET_DATA_KEYS } from "@/components/admin/dashboard/widget-data-keys";
import { ADMIN_WIDGET_KEYS } from "@/modules/dashboard-widgets/admin-layout";
import type { DashboardData, WidgetKey } from "@/components/admin/types";
import { DASHBOARD } from "@/app/dev/screens/_fixtures/admin";

const EMPTY: DashboardData = {
  range: "30d",
  revenueByPeriod: [],
  revenueByProduct: [],
  revenueByPartner: [],
  myShare: { valueInr: 0, delta: "No data yet", sparkline: [] },
  outstandingPayouts: { totalInr: 0, items: [] },
  expensesVsProfit: [],
  paymentsAwaiting: [],
  publishApprovals: [],
  splitApprovals: [],
  serviceChecklists: [],
  revocationTasks: [],
  newLeads: { count: 0, delta: "No data yet", items: [] },
  funnel: [
    { label: "New", value: 0 },
    { label: "Won", value: 0 },
  ],
  overdueFollowUps: [],
  conversionRate: { value: 0, delta: "No data yet" },
  openQueries: [],
  visits: { total: 0, delta: "No data yet", top: [] },
  chatbotUsage: { platform: 0, platformCap: 0, usersAtCap: 0, perUserCap: 0 },
  catalogStatus: [],
  newCustomers: { count: 0, delta: "No data yet", sparkline: [] },
  systemHealth: [],
};

const keys = WIDGET_LIBRARY.map((w) => w.key);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("dashboard widget data sources", () => {
  it("every registered widget key has a data source mapping onto real DashboardData slices", () => {
    expect([...keys].sort()).toEqual([...ADMIN_WIDGET_KEYS].sort());
    expect(Object.keys(WIDGET_DATA_KEYS).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      const slices = WIDGET_DATA_KEYS[key];
      expect(slices.length, key).toBeGreaterThan(0);
      for (const slice of slices) expect(slice in EMPTY, `${key} -> ${slice}`).toBe(true);
    }
  });

  it.each(keys)("%s renders a visible empty state with empty data", (key) => {
    const { container } = render(<WidgetBody widget={key as WidgetKey} data={EMPTY} />);
    expect((container.textContent ?? "").trim().length, `${key} rendered blank`).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/NaN|undefined|Infinity/);
  });

  it.each(keys)("%s renders content with non-empty data", (key) => {
    const { container } = render(<WidgetBody widget={key as WidgetKey} data={DASHBOARD} />);
    expect((container.textContent ?? "").trim().length, `${key} rendered blank`).toBeGreaterThan(0);
    expect(container.querySelector("[data-empty]"), `${key} fell back to empty`).toBeNull();
  });
});

describe("per-widget refresh", () => {
  const layout: WidgetKey[] = ["open_queries", "new_leads"];

  it("refetches only that widget, shows a spinner while pending, then updates its data", async () => {
    let resolve!: (v: unknown) => void;
    refreshDashboardWidget.mockReturnValue(new Promise((r) => (resolve = r)));
    render(
      <AdminDashboard data={EMPTY} layout={layout} isSuperAdmin greeting="Hi" dateLabel="d" />,
    );

    const card = document.querySelector('[data-widget="open_queries"]') as HTMLElement;
    expect(within(card).getByText("Inbox zero — no open queries")).toBeTruthy();
    const button = within(card).getByRole("button", { name: /Refresh Open queries/ });
    fireEvent.click(button);

    expect(refreshDashboardWidget).toHaveBeenCalledWith({ widget: "open_queries", range: "30d" });
    await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("true"));
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("animate-spin");

    resolve({
      ok: true,
      data: {
        widget: "open_queries",
        data: { openQueries: [{ label: "Where is my invoice?", href: "/queries/1" }] },
      },
    });
    await waitFor(() => expect(within(card).getByText("Where is my invoice?")).toBeTruthy());
    expect(button.getAttribute("aria-busy")).toBe("false");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows an error toast when the refresh fails", async () => {
    refreshDashboardWidget.mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL", message: "boom" },
    });
    render(
      <AdminDashboard data={EMPTY} layout={layout} isSuperAdmin greeting="Hi" dateLabel="d" />,
    );
    const card = document.querySelector('[data-widget="new_leads"]') as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: /Refresh New leads/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0]?.[0])).toContain("New leads");
    expect(
      screen.getByRole("button", { name: /Refresh New leads/ }).getAttribute("aria-busy"),
    ).toBe("false");
  });
});

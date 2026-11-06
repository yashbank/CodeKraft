/**
 * G18-3c: the dashboard refreshes itself every 60 s while the tab is visible, stops while it is
 * hidden, shows an "Updated N min ago" caption per widget, and keeps the old numbers when a
 * background refresh fails.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";

const refreshDashboardWidgets = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/dashboard",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/modules/dashboard-widgets/admin-mutations", () => ({
  saveDashboardWidgets: vi.fn(async () => ({ ok: true, data: { widgets: [] } })),
  refreshDashboardWidget: vi.fn(),
  refreshDashboardWidgets: (...a: unknown[]) => refreshDashboardWidgets(...a),
}));

import { AdminDashboard, WIDGET_REFRESH_MS } from "@/components/admin/dashboard/AdminDashboard";
import { updatedAgo } from "@/components/admin/dashboard/UpdatedStamp";
import { useVisibleInterval } from "@/components/admin/dashboard/use-visible-interval";
import type { DashboardData, WidgetKey } from "@/components/admin/types";

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
  funnel: [],
  overdueFollowUps: [],
  conversionRate: { value: 0, delta: "No data yet" },
  openQueries: [],
  visits: { total: 0, delta: "No data yet", top: [] },
  chatbotUsage: { platform: 0, platformCap: 100, usersAtCap: 0, perUserCap: 20 },
  catalogStatus: [],
  newCustomers: { count: 0, delta: "No data yet", sparkline: [] },
  systemHealth: [],
  ordersHeatmap: { cells: [], total: 0, max: 0 },
} as unknown as DashboardData;

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
  refreshDashboardWidgets.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setVisibility("visible");
});

describe("updatedAgo", () => {
  it("reads just now, minutes, hours and days", () => {
    const t = 1_000_000;
    expect(updatedAgo(t, t + 20_000)).toBe("Updated just now");
    expect(updatedAgo(t, t + 3 * 60_000)).toBe("Updated 3 min ago");
    expect(updatedAgo(t, t + 2 * 3_600_000)).toBe("Updated 2 h ago");
    expect(updatedAgo(t, t + 50 * 3_600_000)).toBe("Updated 2 d ago");
  });
});

describe("useVisibleInterval", () => {
  it("ticks while visible, stops while hidden, catches up on return", () => {
    const cb = vi.fn();
    renderHook(() => useVisibleInterval(cb, 60_000));
    vi.advanceTimersByTime(60_000);
    expect(cb).toHaveBeenCalledTimes(1);

    act(() => setVisibility("hidden"));
    vi.advanceTimersByTime(5 * 60_000);
    expect(cb).toHaveBeenCalledTimes(1);

    act(() => setVisibility("visible"));
    expect(cb).toHaveBeenCalledTimes(2); // a full minute passed while hidden: refresh at once
    vi.advanceTimersByTime(60_000);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("does not refresh on return when the last run was recent", () => {
    const cb = vi.fn();
    renderHook(() => useVisibleInterval(cb, 60_000));
    vi.advanceTimersByTime(60_000);
    act(() => setVisibility("hidden"));
    vi.advanceTimersByTime(10_000);
    act(() => setVisibility("visible"));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe("AdminDashboard timer refresh", () => {
  const layout: WidgetKey[] = ["new_leads", "open_queries"];
  const mount = () =>
    render(
      <AdminDashboard
        data={EMPTY}
        layout={layout}
        isSuperAdmin
        greeting="Hi"
        dateLabel="d"
        generatedAt={new Date().toISOString()}
      />,
    );

  it("re-reads every widget on screen after 60 s and shows the new value", async () => {
    refreshDashboardWidgets.mockResolvedValue({
      ok: true,
      data: {
        widgets: layout,
        data: { newLeads: { count: 42, delta: "+42 vs previous period", items: [] } },
        at: new Date(Date.now() + WIDGET_REFRESH_MS).toISOString(),
      },
    });
    mount();
    expect(refreshDashboardWidgets).not.toHaveBeenCalled();
    expect(screen.getAllByText("Updated just now").length).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(WIDGET_REFRESH_MS);
    });
    expect(refreshDashboardWidgets).toHaveBeenCalledTimes(1);
    expect(refreshDashboardWidgets).toHaveBeenCalledWith({ widgets: layout, range: "30d" });
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("does not poll while the tab is hidden", async () => {
    refreshDashboardWidgets.mockResolvedValue({ ok: false, error: { code: "X", message: "x" } });
    mount();
    act(() => setVisibility("hidden"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * WIDGET_REFRESH_MS);
    });
    expect(refreshDashboardWidgets).not.toHaveBeenCalled();
  });

  it("keeps the last numbers when a background refresh fails", async () => {
    refreshDashboardWidgets.mockRejectedValue(new Error("offline"));
    mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WIDGET_REFRESH_MS);
    });
    expect(refreshDashboardWidgets).toHaveBeenCalledTimes(1);
    expect(screen.getByText("No new leads")).toBeTruthy();
  });
});

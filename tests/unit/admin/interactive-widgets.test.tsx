import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BarChart } from "@/components/admin/charts/BarChart";
import { formatBarTooltip } from "@/components/admin/charts/tooltip";
import { WIDGET_BODY_HEIGHT, WidgetSkeleton } from "@/components/admin/dashboard/WidgetSkeleton";
import { AnimatedNumber } from "@/components/admin/use-count-up";
import { dashboardRangeBounds, ledgerDrillHref } from "@/lib/admin/drill-links";
import { parseLedgerFilters } from "@/lib/admin/finance-filters";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const inr = (v: number) => `₹${v}`;

function stubMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private cb: (e: Array<{ isIntersecting: boolean }>) => void) {}
      observe() {
        this.cb([{ isIntersecting: true }]);
      }
      disconnect() {}
    },
  );
}

describe("AnimatedNumber", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("is instant under prefers-reduced-motion", () => {
    stubMotion(true);
    render(<AnimatedNumber value={1234} format={inr} />);
    expect(screen.getByText("₹1234")).toBeTruthy();
  });

  it("counts up and reaches the final value", () => {
    stubMotion(false);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    render(<AnimatedNumber value={1000} format={inr} />);
    expect(screen.queryByText("₹1000")).toBeNull();
    act(() => void vi.advanceTimersByTime(1200));
    expect(screen.getByText("₹1000")).toBeTruthy();
  });
});

describe("drill-down hrefs", () => {
  it("round-trips through the ledger filter parser", () => {
    const href = ledgerDrillHref({ product: PRODUCT, from: "2026-04-01", to: "2026-10-29" });
    const sp = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(href.startsWith("/admin/finance/ledger?")).toBe(true);
    expect(parseLedgerFilters(sp)).toEqual({
      productId: PRODUCT,
      dateFrom: "2026-04-01",
      dateTo: "2026-10-29",
    });
  });

  it("omits empty params and bounds the dashboard range", () => {
    expect(ledgerDrillHref({})).toBe("/admin/finance/ledger");
    expect(dashboardRangeBounds("7d", new Date("2026-10-29T10:00:00Z"))).toEqual({
      from: "2026-10-23",
      to: "2026-10-29",
    });
  });

  it("bar click and Enter navigate to the bar's href", () => {
    const href = ledgerDrillHref({ product: PRODUCT });
    render(
      <BarChart
        data={[
          { label: "Alpha", value: 300, href },
          { label: "Beta", value: 100 },
        ]}
        formatValue={inr}
        summary="s"
        caption="c"
      />,
    );
    const bar = screen.getByRole("link", { name: "Alpha: ₹300 (75%)" });
    fireEvent.click(bar);
    fireEvent.keyDown(bar, { key: "Enter" });
    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledWith(href);
  });

  it("shows a tooltip on focus", () => {
    render(<BarChart data={[{ label: "Beta", value: 100 }]} summary="s" caption="c" />);
    fireEvent.focus(screen.getByRole("img", { name: "Beta: 100 (100%)" }));
    expect(screen.getByTestId("bar-tooltip").textContent).toBe("Beta: 100 (100%)");
  });
});

describe("tooltip + skeleton", () => {
  it("formats exact value and share", () => {
    expect(formatBarTooltip("A", 1, 4, inr)).toBe("A: ₹1 (25%)");
    expect(formatBarTooltip("A", 0, 0, inr)).toBe("A: ₹0");
  });

  it("skeleton has a fixed height", () => {
    render(<WidgetSkeleton />);
    expect(screen.getByTestId("widget-skeleton").style.height).toBe(`${WIDGET_BODY_HEIGHT}px`);
  });
});

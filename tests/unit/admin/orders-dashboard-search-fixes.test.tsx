import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/orders",
}));
vi.mock("@/modules/payments/admin-mutations", () => ({
  confirmPayment: vi.fn(),
  failPayment: vi.fn(),
  proposeRefund: vi.fn(),
}));
vi.mock("@/modules/orders/admin-mutations", () => ({ createManualOrder: vi.fn() }));

import { ManualOrderForm } from "@/components/admin/commerce/ManualOrderForm";
import { OrderDetail } from "@/components/admin/commerce/OrderDetail";
import { OrdersList } from "@/components/admin/commerce/OrdersList";
import { lastDaysRange, mapRevenueByPeriod } from "@/lib/admin/dashboard-view";
import { customerItems, orderItems, productItems } from "@/lib/admin/global-search-items";
import { NOW, ORDER_DETAIL, ORDERS } from "@/app/dev/screens/_fixtures/admin";

afterEach(cleanup);

describe("BUG-089 manual order disabled reason", () => {
  it("shows why Create order is disabled", () => {
    render(
      <ManualOrderForm
        customers={[]}
        offerings={[]}
        partners={[]}
        approvers={["A"]}
        gstinConfigured={false}
        taxRateBps={1800}
        isSuperAdmin={false}
      />,
    );
    expect(screen.getByRole("button", { name: /Create & request split approval/ })).toBeDisabled();
    expect(screen.getByText("Enter the client name and email.")).toBeInTheDocument();
  });
});

describe("BUG-057 orders row click", () => {
  it("navigates on bare row click", () => {
    push.mockClear();
    render(
      <OrdersList
        orders={ORDERS}
        now={NOW}
        detailHref="/admin/orders"
        newOrderHref="/admin/orders/new"
        customerHref="/admin/customers"
        approvalsHref="/admin/approvals"
        notificationsHref="/admin/notifications"
      />,
    );
    const link = screen.getAllByRole("link", { name: ORDERS[0]!.number })[0]!;
    fireEvent.click(link.closest("tr")!.querySelectorAll("td")[1]!);
    expect(push).toHaveBeenCalledWith(`/admin/orders/${ORDERS[0]!.id}`);
  });
});

describe("BUG-056 Fulfil button", () => {
  it("scrolls to the fulfilment card when paid, disabled with reason when not", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const props = {
      approvers: ["A"],
      isSuperAdmin: true,
      customerHref: "/c",
      ledgerHref: "/l",
      approvalsHref: "/a",
      queriesHref: "/q",
    };
    const paid = { ...ORDER_DETAIL, order: { ...ORDER_DETAIL.order, status: "paid" } };
    render(<OrderDetail data={paid as never} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Fulfil" }));
    expect(scroll).toHaveBeenCalled();
    cleanup();
    const unpaid = { ...ORDER_DETAIL, order: { ...ORDER_DETAIL.order, status: "cancelled" } };
    render(<OrderDetail data={unpaid as never} {...props} />);
    const btn = screen.getByRole("button", { name: "Fulfil" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Available once the order is paid");
  });
});

describe("BUG-062 revenue by period mapping", () => {
  it("maps report rows to chart points", () => {
    expect(mapRevenueByPeriod([{ period: "2026-10", netMinor: 5000 }])).toEqual([
      { label: "2026-10", value: 5000 },
    ]);
    expect(mapRevenueByPeriod([])).toEqual([]);
  });
  it("builds an inclusive window ending today", () => {
    expect(lastDaysRange(30, new Date("2026-10-27T10:00:00Z"))).toEqual({
      dateFrom: "2026-09-28",
      dateTo: "2026-10-27",
    });
  });
});

describe("BUG-058 admin search items", () => {
  it("filters and maps results", () => {
    expect(
      productItems([{ id: "p1", name: "Logo Pack", status: "published" }], "logo")[0],
    ).toMatchObject({
      group: "Products",
      href: "/admin/products/p1",
    });
    expect(
      orderItems(
        [{ orderId: "o1", orderNo: "CK-1", customer: { name: "A", email: "a@x.com" } }],
        "a@x",
      ).length,
    ).toBe(1);
    expect(
      customerItems([{ user: { id: "u1", name: "Zed", email: "z@x.com" } }], "nomatch"),
    ).toEqual([]);
  });
});

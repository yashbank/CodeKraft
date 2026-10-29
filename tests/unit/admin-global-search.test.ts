// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminRequestContext = vi.fn();
const listProducts = vi.fn();
const listOrders = vi.fn();
const listCustomers = vi.fn();
const listInvoices = vi.fn();
vi.mock("@/lib/authz/admin-request-context", () => ({ getAdminRequestContext }));
vi.mock("@/modules/orders/queries", () => ({ listOrdersAdminQuery: listOrders }));
vi.mock("@/modules/invoices/queries", () => ({ listInvoicesAdminQuery: listInvoices }));
vi.mock("@/modules/users/queries", () => ({ listCustomersQuery: listCustomers }));
vi.mock("@/modules/catalog/queries", () => ({ listProductsAdminQuery: listProducts }));

describe("searchAdmin auth (round 6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("anonymous caller gets nothing and no query runs", async () => {
    getAdminRequestContext.mockRejectedValue(new Error("UNAUTHENTICATED"));
    const { searchAdmin } = await import("@/lib/admin/global-search");
    expect(await searchAdmin("widget")).toEqual([]);
    expect(listProducts).not.toHaveBeenCalled();
  });

  it("non-admin (permission-denied queries) gets nothing", async () => {
    getAdminRequestContext.mockResolvedValue({ userId: "u1" });
    const denied = { ok: false, error: { code: "FORBIDDEN" } };
    listProducts.mockResolvedValue(denied);
    listOrders.mockResolvedValue(denied);
    listCustomers.mockResolvedValue(denied);
    listInvoices.mockResolvedValue(denied);
    const { searchAdmin } = await import("@/lib/admin/global-search");
    expect(await searchAdmin("widget")).toEqual([]);
  });

  it("P14-12a: invoices are searched; a role without invoices.read gets none of them", async () => {
    getAdminRequestContext.mockResolvedValue({ userId: "u1" });
    const ok = (items: unknown[]) => ({ ok: true, data: { items } });
    listProducts.mockResolvedValue(ok([]));
    listOrders.mockResolvedValue(ok([]));
    listCustomers.mockResolvedValue(ok([]));
    const row = {
      invoiceId: "i1",
      invoiceNo: "INV/26-27/0042",
      orderNo: "CK-1",
      buyer: { name: "Asha", email: "asha@x.in" },
    };
    listInvoices.mockResolvedValue(ok([row]));
    const { searchAdmin } = await import("@/lib/admin/global-search");
    expect(await searchAdmin("0042")).toEqual([
      {
        group: "Invoices",
        label: row.invoiceNo,
        hint: "asha@x.in",
        href: "/admin/finance/invoices/i1",
      },
    ]);
    listInvoices.mockResolvedValue({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await searchAdmin("0042")).toEqual([]);
  });
});

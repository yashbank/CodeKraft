// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminRequestContext = vi.fn();
const listProducts = vi.fn();
const listOrders = vi.fn();
const listCustomers = vi.fn();
vi.mock("@/lib/authz/admin-request-context", () => ({ getAdminRequestContext }));
vi.mock("@/modules/orders/queries", () => ({ listOrdersAdminQuery: listOrders }));
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
    const { searchAdmin } = await import("@/lib/admin/global-search");
    expect(await searchAdmin("widget")).toEqual([]);
  });
});

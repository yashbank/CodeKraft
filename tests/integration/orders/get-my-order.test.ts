import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { getMyOrderQuery } from "@/modules/orders/queries";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createUser } from "../../factories/users";
import { createOrder } from "../../factories/commerce";

function ctxFor(userId: string) {
  return buildContext({
    user: { id: userId },
    session: { id: `sess-${userId}` },
    roles: ["customer"],
  });
}

describe("getMyOrderQuery (API-COM-05, SCR-ACC-11 order status page)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("returns the caller's own order by its public order number, scoped by ctx.userId", async () => {
    await truncateAll();

    const buyer = await createUser({ emailVerified: true });
    const order = await createOrder({ user: buyer, status: "paid" });

    const res = await getMyOrderQuery({ orderNo: order.orderNo }, ctxFor(buyer.id));

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.order.id).toBe(order.id);
      expect(res.data.order.orderNo).toBe(order.orderNo);
      expect(res.data.order.status).toBe("paid");
      expect(res.data.items).toHaveLength(1);
    }
  });

  it("returns NOT_FOUND for an order placed by a different customer", async () => {
    await truncateAll();

    const buyer = await createUser({ emailVerified: true });
    const otherUser = await createUser({ emailVerified: true });
    const order = await createOrder({ user: buyer });

    const res = await getMyOrderQuery({ orderNo: order.orderNo }, ctxFor(otherUser.id));

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("returns NOT_FOUND for an order number that doesn't exist", async () => {
    await truncateAll();
    const buyer = await createUser({ emailVerified: true });

    const res = await getMyOrderQuery({ orderNo: "CK-ORD-999999" }, ctxFor(buyer.id));

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("returns VALIDATION for a malformed order number", async () => {
    const buyer = await createUser({ emailVerified: true });
    const res = await getMyOrderQuery({ orderNo: "not-a-valid-orderno" }, ctxFor(buyer.id));

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe(ErrorCode.VALIDATION);
  });
});

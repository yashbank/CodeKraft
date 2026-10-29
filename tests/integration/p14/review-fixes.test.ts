// P14 review fixes: refund requests only on the caller's own refundable order; a customer cancel
// never fails a submitted (UPI/bank) payment the admin may still confirm.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { ordersService } from "@/modules/orders/service";
import { queriesService } from "@/modules/queries/service";
import { orders } from "../../../drizzle/schema/commerce";
import { createOrder, createPayment } from "../../factories/commerce";
import { createUser } from "../../factories/users";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";

const body = { type: "doc", content: [{ type: "paragraph", text: "Refund please." }] } as const;
const refund = (orderId: string) => ({
  source: "order" as const,
  subject: "Refund request",
  orderId,
  refundRequest: true,
  bodyJson: body,
});
const asUser = (id: string) =>
  buildContext({ user: { id }, session: { id: `s-${id}` }, roles: ["user"] });

describe("P14 review fixes", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("refuses a refund request on another customer's order", async () => {
    const owner = await createUser({ email: "owner@test.com" });
    const other = await createUser({ email: "other@test.com" });
    const order = await createOrder({ user: owner, status: "paid" });
    await queriesService.createQuery(asUser(owner.id), refund(order.id));

    await expect(
      queriesService.createQuery(asUser(other.id), refund(order.id)),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it("refuses a refund request on an unpaid order", async () => {
    const owner = await createUser({ email: "owner2@test.com" });
    const order = await createOrder({ user: owner, status: "pending_payment" });
    await expect(
      queriesService.createQuery(asUser(owner.id), refund(order.id)),
    ).rejects.toMatchObject({ code: ErrorCode.STATE_INVALID });
  });

  it("does not cancel an order whose payment reference was already submitted", async () => {
    const owner = await createUser({ email: "owner3@test.com" });
    const order = await createOrder({ user: owner, status: "pending_payment" });
    await createPayment({ order, status: "submitted", customerReference: "UTR123" });

    await expect(
      ordersService.cancelMyOrder(asUser(owner.id), { orderId: order.id }),
    ).rejects.toMatchObject({ code: ErrorCode.STATE_INVALID });
    const [o] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(o?.status).toBe("pending_payment");
  });
});

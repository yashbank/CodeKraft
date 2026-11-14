import { createHmac } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";

vi.mock("@/modules/settings/service", async (orig) => {
  const mod = await orig<typeof import("@/modules/settings/service")>();
  return {
    ...mod,
    settingsService: {
      ...mod.settingsService,
      load: vi.fn(async (...args: Parameters<typeof mod.settingsService.load>) => ({
        ...(await mod.settingsService.load(...args)),
        razorpaySettings: { keyId: "k", keySecret: "ks", webhookSecret: "whs" },
      })),
    },
  };
});
vi.mock("@/lib/feature-flags", async (orig) => ({
  ...(await orig<typeof import("@/lib/feature-flags")>()),
  getFlag: vi.fn(async () => true),
}));

import { db } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { AppError, ErrorCode } from "@/lib/errors";
import { paymentsService } from "@/modules/payments/service";
import { ordersService } from "@/modules/orders/service";
import { orders, payments } from "../../../drizzle/schema/commerce";
import { webhookEvents } from "../../../drizzle/schema/ops";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createPartner } from "../../factories/users";

const RZP_ORDER = "order_TEST123";
const RZP_PAYMENT = "pay_TEST123";

async function setup() {
  const admin = await createAdmin();
  const customer = await createUser({ emailVerified: true });
  const product = await createProduct({ createdBy: admin.id });
  const partner = await createPartner({ userId: admin.id });
  await createOwnership({
    productId: product.id,
    version: 1,
    status: "active",
    companyCutBps: 2000,
    createdBy: admin.id,
    lines: [{ partnerId: partner.id, shareBps: 8000 }],
  });
  const offering = await createOffering({
    productId: product.id,
    price: { amountMinor: 10000, currency: "INR" },
  });
  const custCtx = buildContext({
    user: { id: customer.id },
    session: { id: "s" },
    roles: ["user"],
  });
  const orderRes = await ordersService.createOrder(custCtx, {
    offeringId: offering.id,
    paymentMethod: "manual_bank",
    billing: { name: "C", email: customer.email, country: "IN", stateCode: "29" },
  });
  const [order] = await db.select().from(orders).where(eq(orders.id, orderRes.orderId));
  // The posting step needs a created_by; webhook confirms carry no confirmedBy.
  await db.update(orders).set({ createdBy: admin.id }).where(eq(orders.id, orderRes.orderId));
  await db
    .update(payments)
    .set({ providerPayload: { razorpayOrderId: RZP_ORDER } })
    .where(eq(payments.id, orderRes.payment.paymentId));
  return {
    paymentId: orderRes.payment.paymentId,
    orderId: orderRes.orderId,
    total: order!.totalMinor,
  };
}

function webhookReq(total: number, eventId = "evt_cap_1") {
  const raw = JSON.stringify({
    id: eventId,
    event: "payment.captured",
    payload: {
      payment: { entity: { id: RZP_PAYMENT, order_id: RZP_ORDER, amount: total, fee: 0 } },
    },
  });
  const sig = createHmac("sha256", "whs").update(raw).digest("hex");
  return new Request("http://localhost/api/webhooks/razorpay", {
    method: "POST",
    body: raw,
    headers: { "x-razorpay-signature": sig },
  });
}

const eventRows = (eventId: string) =>
  db
    .select()
    .from(webhookEvents)
    .where(and(eq(webhookEvents.provider, "razorpay"), eq(webhookEvents.eventId, eventId)));

describe("razorpay webhook retry after transient failure (SEC p19-4 #3)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
    vi.restoreAllMocks();
  });

  it("first attempt fails -> event not recorded -> retry confirms exactly once -> duplicate ignored", async () => {
    const { paymentId, total } = await setup();
    const { POST } = await import("@/app/api/webhooks/razorpay/route");
    const real = paymentsService.confirmPayment.bind(paymentsService);
    const spy = vi
      .spyOn(paymentsService, "confirmPayment")
      .mockRejectedValueOnce(new Error("transient db outage"));

    const first = await POST(webhookReq(total));
    expect(first.status).toBe(500);
    expect(await eventRows("evt_cap_1")).toHaveLength(0);
    const [afterFirst] = await db.select().from(payments).where(eq(payments.id, paymentId));
    expect(afterFirst!.status).not.toBe("confirmed");

    spy.mockImplementation(real);
    const retry = await POST(webhookReq(total));
    expect(retry.status).toBe(200);
    expect((await retry.json()).kind).toBe("payment.captured");
    const [confirmed] = await db.select().from(payments).where(eq(payments.id, paymentId));
    expect(confirmed!.status).toBe("confirmed");
    expect(await eventRows("evt_cap_1")).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(2);

    const dup = await POST(webhookReq(total));
    expect(dup.status).toBe(200);
    expect(await dup.json()).toMatchObject({ kind: "ignored", deduplicated: true });
    expect(spy).toHaveBeenCalledTimes(2); // not processed again
  });

  it("an AppError during confirm also releases the event for retry", async () => {
    const { total } = await setup();
    const { POST } = await import("@/app/api/webhooks/razorpay/route");
    vi.spyOn(paymentsService, "confirmPayment").mockRejectedValueOnce(
      new AppError(ErrorCode.INTERNAL, "boom"),
    );
    const res = await POST(webhookReq(total, "evt_cap_2"));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await eventRows("evt_cap_2")).toHaveLength(0);
  });
});

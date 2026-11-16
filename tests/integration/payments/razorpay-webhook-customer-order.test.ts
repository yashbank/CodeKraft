import { createHmac } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

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
import { ordersService } from "@/modules/orders/service";
import { orders, payments } from "../../../drizzle/schema/commerce";
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
  await db
    .update(payments)
    .set({ providerPayload: { razorpayOrderId: RZP_ORDER } })
    .where(eq(payments.id, orderRes.payment.paymentId));
  return {
    paymentId: orderRes.payment.paymentId,
    orderId: orderRes.orderId,
    total: order!.totalMinor,
    customerId: customer.id,
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

describe("razorpay webhook confirm of a customer-created order (no admin, no confirmedBy)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
    vi.restoreAllMocks();
  });

  it("confirms and posts to the ledger; created_by falls back to the customer", async () => {
    const { paymentId, orderId, total, customerId } = await setup();
    const { POST } = await import("@/app/api/webhooks/razorpay/route");
    const res = await POST(webhookReq(total));
    expect(res.status).toBe(200);
    const [p] = await db.select().from(payments).where(eq(payments.id, paymentId));
    expect(p!.status).toBe("confirmed");
    expect(p!.confirmedBy).toBeNull();
    const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(o!.createdBy).toBe(customerId);
  });
});

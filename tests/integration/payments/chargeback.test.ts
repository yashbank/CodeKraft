import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { ordersService } from "@/modules/orders/service";
import { payments } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

describe("flagChargeback integration (API-PAY-08)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("flags payment with chargeback note and updates failureReason", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });
    const partner = await createPartner({ userId: admin.id });
    const product = await createProduct({ createdBy: admin.id });

    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 1000,
      createdBy: admin.id,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 10000, currency: "INR" },
    });

    const custCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust" },
      roles: ["user"],
    });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    const orderRes = await ordersService.createOrder(custCtx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: { name: "Cust", email: customer.email, country: "IN" },
    });

    const res = await paymentsService.flagChargeback(adminCtx, {
      paymentId: orderRes.payment.paymentId,
      note: "Disputed with bank as unauthorised",
    });

    expect(res.ok).toBe(true);

    const [pmt] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, orderRes.payment.paymentId));
    expect(pmt!.failureReason).toContain("chargeback: Disputed with bank as unauthorised");
  });
});

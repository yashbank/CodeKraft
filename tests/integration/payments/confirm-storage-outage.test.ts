import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { ordersService } from "@/modules/orders/service";
import { orders, userOfferingPurchases } from "../../../drizzle/schema/commerce";
import { ledgerEntries, allocations } from "../../../drizzle/schema/finance";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

import { MemoryStorageDriver, setStorageDriver } from "@/lib/storage";
import { invoices } from "../../../drizzle/schema/invoices";

/** Object storage that is down / misconfigured (prod R2 creds, bucket, network). */
class FailingStorageDriver extends MemoryStorageDriver {
  override async putObject(): Promise<void> {
    throw new Error("Could not load credentials from any providers");
  }
}

describe("R8-02: confirmPayment survives an object-storage outage", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  afterEach(() => setStorageDriver(null));

  it("marks the order paid, grants access and issues the invoice without a PDF", async () => {
    await truncateAll();
    setStorageDriver(new FailingStorageDriver());

    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });
    const partner = await createPartner({ userId: admin.id });
    const product = await createProduct({ createdBy: admin.id });
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
      session: { id: "sess-cust" },
      roles: ["user"],
    });
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    const orderRes = await ordersService.createOrder(custCtx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: { name: "Cust", email: customer.email, country: "IN" },
    });
    expect(orderRes.payment.instructions).toMatchObject({ vpa: "testshop@okhdfc" });
    await paymentsService.submitPaymentReference(custCtx, {
      paymentId: orderRes.payment.paymentId,
      reference: "UTR-998877",
    });
    const [saved] = await db.select().from(orders).where(eq(orders.id, orderRes.orderId));

    const res = await paymentsService.confirmPayment(adminCtx, {
      paymentId: orderRes.payment.paymentId,
      amountReceivedMinor: saved!.totalMinor,
      reference: "UTR-998877",
      receivedOn: "2026-10-27",
    });

    expect(res.order.status).toBe("paid");
    expect(res.entitlementIds.length).toBeGreaterThan(0);
    expect(res.ledgerEntryCount).toBeGreaterThan(0);
    const [inv] = await db.select().from(invoices).where(eq(invoices.orderId, orderRes.orderId));
    expect(inv?.invoiceNo).toBeTruthy();
    expect(inv?.pdfMediaId).toBeNull();
  });
});

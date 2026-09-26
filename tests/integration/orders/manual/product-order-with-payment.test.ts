import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ordersService } from "@/modules/orders/service";
import { orderItems, orders, userOfferingPurchases } from "../../../../drizzle/schema/commerce";
import { invoices } from "../../../../drizzle/schema/invoices";
import { allocations, ledgerEntries } from "../../../../drizzle/schema/finance";
import { migrateTestDb } from "../../../setup/migrate";
import { truncateAll } from "../../../setup/db";
import { createAdmin, createPartner, createUser } from "../../../factories/users";
import { createProduct } from "../../../factories/catalog";
import { createOffering } from "../../../factories/offerings";
import { buildContext } from "@/lib/authz/context";

describe("Manual product order with payment (API-COM-07, BR-10, S-12)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("creates and confirms product order with ledger, invoice, and duplicate prevention", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partner = await createPartner({ userId: admin.id });
    const customer = await createUser({ emailVerified: true });

    const product = await createProduct({
      ownership: {
        companyCutBps: 2000,
        lines: [{ partnerId: partner.id, shareBps: 10000 }],
      },
    });
    const offering = await createOffering({
      productId: product.id,
      purchaseModel: "one_time",
      price: { amountMinor: 20000, currency: "INR" },
    });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    // 1. Create manual product order with upfront payment
    const res = await ordersService.createManualOrder(adminCtx, {
      type: "product",
      customer: { userId: customer.id },
      currency: "INR",
      items: [{ offeringId: offering.id }],
      taxEnabled: false,
      billing: {
        name: "Manual Buyer",
        email: customer.email,
        country: "IN",
      },
      payment: {
        method: "manual_bank",
        amountReceivedMinor: 20000,
        reference: "UTR-MAN-001",
        paidOn: "2026-09-26",
      },
    });

    expect(res.orderId).toBeDefined();
    expect(res.orderNo).toMatch(/^CK-ORD-\d{6}$/);
    expect(res.paymentId).toBeDefined();
    expect(res.invoiceId).toBeDefined();

    // 2. Order lands paid with createdBy = admin
    const [savedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, res.orderId));
    expect(savedOrder?.status).toBe("paid");
    expect(savedOrder?.paidAt).not.toBeNull();
    expect(savedOrder?.createdBy).toBe(admin.id);
    expect(savedOrder?.totalMinor).toBe(20000);

    // 3. Invoice issued in the same transaction
    const [savedInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, res.invoiceId!));
    expect(savedInvoice?.orderId).toBe(res.orderId);
    expect(savedInvoice?.issuedAt).not.toBeNull();
    expect(savedInvoice?.invoiceNo).toMatch(/^CK\/\d{4}-\d{2}\/\d{4}$/);

    // 4. Ledger & allocations posted
    const [savedItem] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, res.orderId));
    expect(savedItem).toBeDefined();

    const savedAllocations = await db
      .select()
      .from(allocations)
      .where(eq(allocations.orderItemId, savedItem!.id));
    expect(savedAllocations.length).toBeGreaterThan(0);

    const savedLedger = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, res.orderId));
    expect(savedLedger.length).toBeGreaterThan(0);

    // 5. BR-10 purchase recorded
    const [purchase] = await db
      .select()
      .from(userOfferingPurchases)
      .where(eq(userOfferingPurchases.userId, customer.id));
    expect(purchase?.offeringId).toBe(offering.id);

    // 6. Attempt second manual order for same one_time offering -> DUPLICATE_PURCHASE
    await expect(
      ordersService.createManualOrder(adminCtx, {
        type: "product",
        customer: { userId: customer.id },
        currency: "INR",
        items: [{ offeringId: offering.id }],
        taxEnabled: false,
        billing: {
          name: "Manual Buyer",
          email: customer.email,
          country: "IN",
        },
      }),
    ).rejects.toThrow(/already purchased/);
  });
});

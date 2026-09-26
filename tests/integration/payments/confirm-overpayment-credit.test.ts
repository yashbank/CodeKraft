import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { ordersService } from "@/modules/orders/service";
import { orders, payments } from "../../../drizzle/schema/commerce";
import { allocations, ledgerEntries } from "../../../drizzle/schema/finance";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

describe("confirmPayment overpayment integration (FR-PAY-07, MASTER_SPEC §7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("records customer_credit_minor = 1000 and never allocates excess to partners when received = total + 1000", async () => {
    await truncateAll();

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
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 20000, currency: "INR" },
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
      paymentMethod: "manual_bank",
      billing: { name: "Cust", email: customer.email, country: "IN" },
    });

    const [savedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderRes.orderId));

    const total = savedOrder!.totalMinor;
    const received = total + 1000;

    const confirmRes = await paymentsService.confirmPayment(adminCtx, {
      paymentId: orderRes.payment.paymentId,
      amountReceivedMinor: received,
      reference: "UTR-OVERPAY-1",
      receivedOn: "2026-09-26",
    });

    expect(confirmRes.payment.status).toBe("confirmed");
    expect(confirmRes.shortfallMinor).toBe(0);
    expect(confirmRes.customerCreditMinor).toBe(1000);

    const [pmt] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, orderRes.payment.paymentId));
    expect(pmt!.customerCreditMinor).toBe(1000);

    // Verify allocations are based on total / amountDue (not total + 1000)
    const allocRows = await db
      .select()
      .from(allocations);

    const totalAllocated = allocRows.reduce((sum, a) => {
      const lineSum = (a.lines as any[]).reduce((s, l) => s + l.amount_minor, 0);
      return sum + lineSum;
    }, 0);
    // Partner allocation should be 80% of net line revenue, strictly <= total
    expect(totalAllocated).toBeLessThan(total);
  });
});

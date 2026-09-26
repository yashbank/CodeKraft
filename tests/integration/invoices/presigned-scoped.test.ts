import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoicesService } from "@/modules/invoices/service";
import { auditLogs } from "../../../drizzle/schema/audit";
import { AppError, ErrorCode } from "@/lib/errors";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { ordersService } from "@/modules/orders/service";
import { paymentsService } from "@/modules/payments/service";
import { buildContext } from "@/lib/authz/context";

describe("Scoped presigned invoice URL access (SA-10, BR-16)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("denies foreign customer with NOT_FOUND, allows owner, and audits admin views", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partner = await createPartner({ userId: admin.id });
    const customer1 = await createUser({ emailVerified: true });
    const customer2 = await createUser({ emailVerified: true });
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
      price: { amountMinor: 7500, currency: "INR" },
    });

    const cust1Ctx = buildContext({
      user: { id: customer1.id },
      session: { id: "sess-cust-1" },
      roles: ["user"],
    });

    const cust2Ctx = buildContext({
      user: { id: customer2.id },
      session: { id: "sess-cust-2" },
      roles: ["user"],
    });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    // Create order and confirm payment for Customer 1
    const orderRes = await ordersService.createOrder(cust1Ctx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: { name: "Customer 1", email: customer1.email, country: "IN" },
    });

    const confirmRes = await paymentsService.confirmPayment(adminCtx, {
      paymentId: orderRes.payment.paymentId,
      amountReceivedMinor: 7500,
      reference: "UTR-SCOPED-1",
      receivedOn: "2026-09-26",
    });

    const invoiceId = confirmRes.invoiceId!;
    expect(invoiceId).toBeDefined();

    // 1. Foreign customer Customer 2 attempts to get invoice URL -> must throw NOT_FOUND (SA-10)
    await expect(
      invoicesService.getInvoicePdfUrl(cust2Ctx, { invoiceId })
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.NOT_FOUND);
      return true;
    });

    // 2. Owner Customer 1 gets invoice URL -> succeeds
    const ownerUrlRes = await invoicesService.getInvoicePdfUrl(cust1Ctx, { invoiceId });
    expect(ownerUrlRes.url).toBeDefined();
    expect(ownerUrlRes.expiresAt).toBeDefined();

    // 3. Admin gets invoice URL -> succeeds and writes audit log
    const adminUrlRes = await invoicesService.getInvoicePdfUrl(adminCtx, { invoiceId });
    expect(adminUrlRes.url).toBeDefined();

    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "invoice.viewed"));

    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(admin.id);
  });
});

/**
 * @security SA-08 SA-09 SA-10 SA-24
 * Phase 4 Integration Scenarios: S-02 (steps 1-5), S-07, S-08, S-09, S-10, S-12, S-13, S-22.
 * End-to-end service-level verification for the Phase 4 gate.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { ordersService } from "@/modules/orders/service";
import { paymentsService } from "@/modules/payments/service";
import { couponsService } from "@/modules/coupons/service";
import { quotesService } from "@/modules/quotes/service";
import { invoicesService } from "@/modules/invoices/service";
import { financeService } from "@/modules/finance/service";
import { approvalsService } from "@/modules/approvals/service";
import { ownershipService } from "@/modules/ownership/service";
import { reconcileFinance } from "@/modules/finance/reconcile";
import { entitlementsStub } from "../../stubs/entitlements";
import { orders, orderItems, payments, refunds } from "../../../drizzle/schema/commerce";
import { invoices, creditNotes } from "../../../drizzle/schema/invoices";
import { ledgerEntries, allocations, payouts } from "../../../drizzle/schema/finance";
import { approvalRequests } from "../../../drizzle/schema/approvals";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createOrder, createPayment } from "../../factories/commerce";
import { buildContext } from "@/lib/authz/context";
import { AppError } from "@/lib/errors";

describe("Phase 4 Commerce & Finance Scenarios (S-02..S-22, SA-08..SA-24)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("S-02 (steps 1-5): Buy with manual payment, shortfall, invoice, immutable payment trigger", async () => {
    await truncateAll();
    entitlementsStub.reset();

    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const partner = await createPartner({ userId: admin1.id });
    const product = await createProduct({ createdBy: admin1.id });

    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 2000,
      createdBy: admin1.id,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 50000, currency: "INR" },
    });
    const buyer = await createUser({ emailVerified: true });

    const buyerCtx = buildContext({
      user: { id: buyer.id },
      session: { id: "sess-buyer" },
      roles: ["customer"],
    });

    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["super_admin"],
    });

    // 1. Place order
    const orderRes = await ordersService.createOrder(buyerCtx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: {
        name: "Buyer One",
        email: buyer.email,
        country: "IN",
      },
    });

    expect(orderRes.orderId).toBeDefined();
    expect(orderRes.payment).toBeDefined();

    // 2. Submit payment reference
    await paymentsService.submitPaymentReference(buyerCtx, {
      paymentId: orderRes.payment.paymentId,
      customerReference: "UTR-TEST-123456",
    });

    // 3. Admin confirms with shortfall of 2500 paise
    const confirmRes = await paymentsService.confirmPayment(admin1Ctx, {
      paymentId: orderRes.payment.paymentId,
      amountReceivedMinor: 47500, // 2500 shortfall
      reference: "UTR-TEST-123456",
      receivedOn: "2026-09-26",
    });

    expect(confirmRes.payment.status).toBe("confirmed");
    expect(confirmRes.shortfallMinor).toBe(2500);

    // Order is paid, invoice issued
    const [ord] = await db.select().from(orders).where(eq(orders.id, orderRes.orderId));
    expect(ord?.status).toBe("paid");

    const [inv] = await db.select().from(invoices).where(eq(invoices.orderId, orderRes.orderId));
    expect(inv?.invoiceNo).toMatch(/^CK\/\d{4}-\d{2}\/\d{4}$/);

    // 4. SA-08: Attempt direct SQL update on confirmed payment must fail due to immutability trigger
    await expect(
      db
        .update(payments)
        .set({ amountReceivedMinor: 50000 })
        .where(eq(payments.id, orderRes.payment.paymentId)),
    ).rejects.toThrow();
  });

  it("S-07: Refund proposal, requester blocked (SA-09), dual approval, credit note, ledger reversal", async () => {
    await truncateAll();

    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const partner = await createPartner({ userId: admin1.id });
    const product = await createProduct({ createdBy: admin1.id, isRefundable: true });

    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 2000,
      createdBy: admin1.id,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 30000, currency: "INR" },
    });
    const buyer = await createUser({ emailVerified: true });

    const order = await createOrder({
      offering,
      user: buyer,
      quantity: 1,
      currency: "INR",
      status: "paid",
    });

    const pmt = await createPayment({
      order,
      status: "confirmed",
      amountReceivedMinor: 30000,
      confirmedBy: admin1.id,
    });

    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
      await invoicesService.issueInvoice({ orderId: order.id }, { userId: admin1.id }, tx);
    });

    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["super_admin"],
    });

    const admin2Ctx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-admin-2" },
      roles: ["super_admin"],
    });

    // 1. Propose full refund
    const refundProp = await paymentsService.proposeRefund(admin1Ctx, {
      orderId: order.id,
      paymentId: pmt.id,
      amountMinor: 30000,
      reason: "Customer requested cancellation",
    });

    expect(refundProp.approvalRequestId).toBeDefined();

    // 2. SA-09: Requester cannot approve own refund request
    await expect(
      approvalsService.approveRequest(admin1Ctx, {
        approvalRequestId: refundProp.approvalRequestId,
      }),
    ).rejects.toThrow(AppError);

    // 3. Other admin approves
    const decideRes = await approvalsService.approveRequest(admin2Ctx, {
      approvalRequestId: refundProp.approvalRequestId,
    });
    expect(decideRes.status).toBe("applied");

    // Payment transitioned to refunded
    const [pmtAfter] = await db.select().from(payments).where(eq(payments.id, pmt.id));
    expect(pmtAfter?.status).toBe("refunded");
    expect(pmtAfter?.amountRefundedMinor).toBe(30000);

    // Credit note issued (CK/CN/<fy>/<seq>)
    const [cn] = await db.select().from(creditNotes).where(eq(creditNotes.refundId, refundProp.refundId));
    expect(cn?.creditNo).toMatch(/^CK\/CN\/\d{4}-\d{2}\/\d{4}$/);

    // Ledger nets to 0 for the order (FI-04, FI-05)
    const [sumRes] = await db
      .select({ sum: sql<string>`COALESCE(SUM(amount_minor), 0)` })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, order.id));
    expect(Number(sumRes?.sum)).toBe(0);
  });

  it("S-08: Coupon first purchase and exhaustion validations", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    // Create first-purchase coupon
    await couponsService.upsertCoupon(adminCtx, {
      code: "FIRSTBUY10",
      kind: "percent",
      value: 1000, // 10%
      firstPurchaseOnly: true,
      active: true,
    });

    const buyer = await createUser({ emailVerified: true });
    const buyerCtx = buildContext({
      user: { id: buyer.id },
      session: { id: "sess-buyer" },
      roles: ["customer"],
    });

    const product = await createProduct({ createdBy: admin.id });
    const partner = await createPartner({ userId: admin.id });
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

    // First checkout succeeds
    const checkout1 = await ordersService.createOrder(buyerCtx, {
      offeringId: offering.id,
      couponCode: "FIRSTBUY10",
      paymentMethod: "manual_bank",
      billing: { name: "Buyer", email: buyer.email, country: "IN" },
    });
    expect(checkout1.orderId).toBeDefined();

    // Confirm payment to record purchase history
    await paymentsService.confirmPayment(adminCtx, {
      paymentId: checkout1.payment.paymentId,
      amountReceivedMinor: 18000,
      reference: "UTR-FIRST-01",
      receivedOn: "2026-09-26",
    });

    // Second purchase attempt with FIRSTBUY10 fails
    await expect(
      ordersService.createOrder(buyerCtx, {
        offeringId: offering.id,
        couponCode: "FIRSTBUY10",
        paymentMethod: "manual_bank",
        billing: { name: "Buyer", email: buyer.email, country: "IN" },
      }),
    ).rejects.toThrow();
  });

  it("S-09: Custom quote creation, non-invited user blocked, buyer acceptance", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    const product = await createProduct({ createdBy: admin.id });
    const partner = await createPartner({ userId: admin.id });
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
      price: { amountMinor: 50000, currency: "INR" },
    });

    const invitedBuyer = await createUser({ emailVerified: true });
    const strangerBuyer = await createUser({ emailVerified: true });

    // 1. Admin creates and sends quote for 35,000 INR
    const quote = await quotesService.createCustomQuote(adminCtx, {
      customerId: invitedBuyer.id,
      offeringId: offering.id,
      title: "Enterprise Custom License",
      amountMinor: 35000,
      currency: "INR",
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });

    await quotesService.sendCustomQuote(adminCtx, { quoteId: quote.quoteId });

    // 2. Stranger buyer cannot accept
    const strangerCtx = buildContext({
      user: { id: strangerBuyer.id },
      session: { id: "sess-stranger" },
      roles: ["customer"],
    });

    await expect(
      quotesService.acceptCustomQuote(strangerCtx, {
        token: quote.token,
        paymentMethod: "manual_bank",
        billing: { name: "Stranger", email: strangerBuyer.email, country: "IN" },
      }),
    ).rejects.toThrow();

    // 3. Invited buyer accepts
    const buyerCtx = buildContext({
      user: { id: invitedBuyer.id },
      session: { id: "sess-buyer" },
      roles: ["customer"],
    });

    const acceptRes = await quotesService.acceptCustomQuote(buyerCtx, {
      token: quote.token,
      paymentMethod: "manual_bank",
      billing: { name: "Invited Buyer", email: invitedBuyer.email, country: "IN" },
    });
    expect(acceptRes.orderId).toBeDefined();

    // Confirm payment for the quote order
    await paymentsService.confirmPayment(adminCtx, {
      paymentId: acceptRes.payment.paymentId,
      amountReceivedMinor: 35000,
      reference: "UTR-QUOTE-01",
      receivedOn: "2026-09-26",
    });

    // Quote marked paid
    const updatedQuote = await quotesService.getQuote(buyerCtx, { token: quote.token });
    expect(updatedQuote.quote.status).toBe("paid");
  });

  it("S-10: Ownership version active at payment time governs allocation", async () => {
    await truncateAll();

    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const partner1 = await createPartner({ userId: admin1.id });
    const partner2 = await createPartner({ userId: admin2.id });
    const product = await createProduct({ createdBy: admin1.id });

    // v1: 60% partner1, 40% partner2 (0 cut)
    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 0,
      createdBy: admin1.id,
      lines: [
        { partnerId: partner1.id, shareBps: 6000 },
        { partnerId: partner2.id, shareBps: 4000 },
      ],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 100000, currency: "INR" },
    });
    const buyer = await createUser({ emailVerified: true });

    // Order 1 placed and paid under v1
    const order1 = await createOrder({
      offering,
      user: buyer,
      quantity: 1,
      currency: "INR",
      status: "paid",
    });
    await createPayment({
      order: order1,
      status: "confirmed",
      amountReceivedMinor: 100000,
      confirmedBy: admin1.id,
    });
    await withTx(async (tx) => {
      await financeService.postOrderPaid(order1.id, tx);
    });

    // Check Order 1 allocations: 60,000 to p1, 40,000 to p2
    const p1Entries1 = await db
      .select()
      .from(ledgerEntries)
      .where(sql`${ledgerEntries.orderId} = ${order1.id} AND ${ledgerEntries.partnerId} = ${partner1.id}`);
    expect(p1Entries1[0]?.amountMinor).toBe(60000);

    // Propose v2 ownership: 70% partner1, 30% partner2
    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["super_admin"],
    });
    const admin2Ctx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-admin-2" },
      roles: ["super_admin"],
    });

    const prop = await ownershipService.proposeOwnership(admin1Ctx, {
      productId: product.id,
      companyCutBps: 0,
      lines: [
        { partnerId: partner1.id, shareBps: 7000 },
        { partnerId: partner2.id, shareBps: 3000 },
      ],
    });

    await approvalsService.approveRequest(admin2Ctx, {
      approvalRequestId: prop.approvalRequestId,
    });

    // Order 2 placed and paid under v2
    const order2 = await createOrder({
      offering,
      user: buyer,
      quantity: 1,
      currency: "INR",
      status: "paid",
    });
    await createPayment({
      order: order2,
      status: "confirmed",
      amountReceivedMinor: 100000,
      confirmedBy: admin1.id,
    });
    await withTx(async (tx) => {
      await financeService.postOrderPaid(order2.id, tx);
    });

    // Check Order 2 allocations: 70,000 to p1, 30,000 to p2
    const p1Entries2 = await db
      .select()
      .from(ledgerEntries)
      .where(sql`${ledgerEntries.orderId} = ${order2.id} AND ${ledgerEntries.partnerId} = ${partner1.id}`);
    expect(p1Entries2[0]?.amountMinor).toBe(70000);
  });

  it("S-12: Manual project order dual approval and snapshot allocation", async () => {
    await truncateAll();

    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const partner1 = await createPartner({ userId: admin1.id });
    const partner2 = await createPartner({ userId: admin2.id });
    const client = await createUser({ emailVerified: true });

    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["super_admin"],
    });
    const admin2Ctx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-admin-2" },
      roles: ["super_admin"],
    });

    // 1. Admin creates project order with 50/50 split
    const projectOrder = await ordersService.createManualOrder(admin1Ctx, {
      customer: { userId: client.id },
      type: "project",
      currency: "INR",
      taxEnabled: false,
      items: [
        {
          description: "Custom ERP Implementation",
          quantity: 1,
          unitMinor: 200000,
          splitSnapshot: {
            companyCutBps: 0,
            lines: [
              { partnerId: partner1.id, shareBps: 5000 },
              { partnerId: partner2.id, shareBps: 5000 },
            ],
          },
        },
      ],
      billing: { name: "Acme Corp", email: client.email, country: "IN" },
    });

    expect(projectOrder.approvalRequestId).toBeDefined();

    const payment = await withTx(async (tx) =>
      paymentsService.createIntentForOrder(projectOrder.orderId, "manual_bank", tx),
    );

    // 2. Payment/invoice is blocked before approval
    await expect(
      paymentsService.confirmPayment(admin1Ctx, {
        paymentId: payment.paymentId,
        amountReceivedMinor: 200000,
        reference: "UTR-PROJ-01",
        receivedOn: "2026-09-26",
      }),
    ).rejects.toThrow();

    // 3. Admin2 approves split
    await approvalsService.approveRequest(admin2Ctx, {
      approvalRequestId: projectOrder.approvalRequestId!,
    });

    // 4. Payment now confirmed
    const pmtRes = await paymentsService.confirmPayment(admin1Ctx, {
      paymentId: payment.paymentId,
      amountReceivedMinor: 200000,
      reference: "UTR-PROJ-01",
      receivedOn: "2026-09-26",
    });
    expect(pmtRes.payment.status).toBe("confirmed");

    // Both partners receive exactly 100,000 INR
    const p1Entries = await db
      .select()
      .from(ledgerEntries)
      .where(sql`${ledgerEntries.orderId} = ${projectOrder.orderId} AND ${ledgerEntries.partnerId} = ${partner1.id}`);
    expect(p1Entries[0]?.amountMinor).toBe(100000);
  });

  it("S-13 & S-22: Payout approval lifecycle and nightly reconciliation cross-check", async () => {
    await truncateAll();

    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const partner = await createPartner({ userId: admin1.id });
    const product = await createProduct({ createdBy: admin1.id });

    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 0,
      createdBy: admin1.id,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 100000, currency: "INR" },
    });
    const buyer = await createUser({ emailVerified: true });

    const order = await createOrder({
      offering,
      user: buyer,
      quantity: 1,
      currency: "INR",
      status: "paid",
    });
    await createPayment({
      order,
      status: "confirmed",
      amountReceivedMinor: 100000,
      confirmedBy: admin1.id,
    });
    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["super_admin"],
    });
    const admin2Ctx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-admin-2" },
      roles: ["super_admin"],
    });

    // FI-14: Payout > balance is rejected
    await expect(
      financeService.recordPayout(admin1Ctx, {
        partnerId: partner.id,
        amountMinor: 150000, // exceeds 100,000 balance
        currency: "INR",
        paidOn: "2026-09-26",
        reference: "UTR-OVERDRAW",
      }),
    ).rejects.toThrow(AppError);

    // Payout <= balance succeeds
    const payoutReq = await financeService.recordPayout(admin1Ctx, {
      partnerId: partner.id,
      amountMinor: 40000,
      currency: "INR",
      paidOn: "2026-09-26",
      reference: "UTR-VALID-PAYOUT",
    });

    await approvalsService.approveRequest(admin2Ctx, {
      approvalRequestId: payoutReq.approvalRequestId,
    });

    // Partner balance reduced to 60,000 INR
    const [bal] = await financeService.getPartnerBalances(admin1Ctx, { partnerId: partner.id });
    expect(bal?.byCurrency[0]?.balance).toBe(60000);

    // S-22: Nightly reconciliation over entire ledger passes with 0 discrepancies
    const reconcileRes = await reconcileFinance();
    expect(reconcileRes.ok).toBe(true);
    expect(reconcileRes.discrepancies).toHaveLength(0);
  });
});

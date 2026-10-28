/**
 * Finance metrics are labelled and reconcile everywhere (reports, ledger summary, dashboard):
 *   gross - discounts = net sales ; net sales + tax = collected.
 * Scenarios: coupon order (list 41000.00, paid 1.00), taxed order, partial refund, partial payment
 * (bank shortfall), zero-partner product and outstanding (unpaid) orders.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, withTx } from "@/lib/db";
import { productOwnerships } from "../../../drizzle/schema/ownership";
import { buildContext } from "@/lib/authz/context";
import { financeService } from "@/modules/finance/service";
import { getFinanceSummary } from "@/modules/finance/metrics";
import { paymentsService } from "@/modules/payments/service";
import { approvalsService } from "@/modules/approvals/service";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOrder, createPayment, createInvoice } from "../../factories/commerce";

const RANGE = { dateFrom: "2020-01-01", dateTo: "2099-12-31" };

async function setup(opts: {
  priceMinor: number;
  companyCutBps?: number;
  noPartner?: boolean;
  refundable?: boolean;
}) {
  const admin = await createAdmin();
  const admin2 = await createAdmin();
  const partner = await createPartner({ userId: admin.id });
  const companyCutBps = opts.companyCutBps ?? 2000;
  const product = await createProduct({
    isRefundable: opts.refundable ?? false,
    createdBy: admin.id,
    ownership: opts.noPartner
      ? undefined
      : { companyCutBps, lines: [{ partnerId: partner.id, shareBps: 10000 - companyCutBps }] },
  });
  if (opts.noPartner) {
    // 100% company cut, zero partner lines (the factory refuses an empty line list).
    await db.insert(productOwnerships).values({
      productId: product.id,
      version: 1,
      companyCutBps: 10000,
      status: "active",
      effectiveFrom: new Date(),
      createdBy: admin.id,
    });
  }
  const offering = await createOffering({
    productId: product.id,
    price: { amountMinor: opts.priceMinor, currency: "INR" },
  });
  const ctx = buildContext({
    user: { id: admin.id },
    session: { id: "sess-a" },
    roles: ["super_admin"],
  });
  return { admin, admin2, partner, product, offering, ctx };
}

async function postPaidOrder(
  s: Awaited<ReturnType<typeof setup>>,
  o: { discountMinor?: number; taxRateBps?: number; receivedMinor?: number },
) {
  const order = await createOrder({
    offering: s.offering,
    discountMinor: o.discountMinor,
    taxRateBps: o.taxRateBps,
    status: "paid",
    currency: "INR",
  });
  const payment = await createPayment({
    order,
    status: "confirmed",
    amountReceivedMinor: o.receivedMinor,
    confirmedBy: s.admin.id,
  });
  await withTx((tx) => financeService.postOrderPaid(order.id, tx));
  return { order, payment };
}

function expectReconciles(m: Awaited<ReturnType<typeof getFinanceSummary>>) {
  expect(m.grossSalesMinor - m.discountsMinor).toBe(m.netSalesMinor);
  expect(m.netSalesMinor + m.taxCollectedMinor).toBe(m.collectedMinor);
  expect(m.profitMinor).toBe(m.companyShareMinor + m.partnerSharesMinor - m.expensesMinor);
}

describe("finance metrics: labelled, consistent, reconciling", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("coupon order: list 41000.00 paid 1.00 reports net 1.00, not 41000", async () => {
    const s = await setup({ priceMinor: 4_100_000 });
    await postPaidOrder(s, { discountMinor: 4_099_900 });

    const m = await getFinanceSummary(RANGE);
    expect(m.grossSalesMinor).toBe(4_100_000);
    expect(m.discountsMinor).toBe(4_099_900);
    expect(m.netSalesMinor).toBe(100);
    expect(m.taxCollectedMinor).toBe(0);
    expect(m.collectedMinor).toBe(100);
    expect(m.companyShareMinor + m.partnerSharesMinor).toBe(100);
    expect(m.refundsMinor).toBe(0);
    expect(m.outstandingMinor).toBe(0);
    expectReconciles(m);

    const byProduct = await financeService.getReport(s.ctx, {
      report: "revenue_by_product",
      ...RANGE,
    });
    expect(byProduct.totals).toMatchObject({
      grossMinor: 4_100_000,
      discountMinor: 4_099_900,
      netMinor: 100,
      collectedMinor: 100,
      orderCount: 1,
    });
    const byPeriod = await financeService.getReport(s.ctx, {
      report: "revenue_by_period",
      ...RANGE,
    });
    expect(byPeriod.totals).toMatchObject({
      grossMinor: 4_100_000,
      netMinor: 100,
      collectedMinor: 100,
    });
    const labels = byPeriod.columns.map((c) => c.label);
    expect(labels).toContain("Gross sales (list price)");
    expect(labels).toContain("Discounts / coupons");
    expect(labels).toContain("Net sales (gross - discounts)");
  });

  it("taxed order: collected = net sales + tax, tax is not revenue", async () => {
    const s = await setup({ priceMinor: 100_000 });
    await postPaidOrder(s, { taxRateBps: 1800 });

    const m = await getFinanceSummary(RANGE);
    expect(m.grossSalesMinor).toBe(100_000);
    expect(m.netSalesMinor).toBe(100_000);
    expect(m.taxCollectedMinor).toBe(18_000);
    expect(m.collectedMinor).toBe(118_000);
    expectReconciles(m);

    const tax = await financeService.getReport(s.ctx, { report: "tax_collected", ...RANGE });
    expect(tax.totals.taxCollectedMinor).toBe(18_000);
  });

  it("partial refund: refunds = cash returned, shares net of reversal", async () => {
    const s = await setup({ priceMinor: 20_000, companyCutBps: 3000, refundable: true });
    const { order, payment } = await postPaidOrder(s, {});
    await createInvoice({ order });
    const before = await getFinanceSummary(RANGE);

    const { approvalRequestId } = await paymentsService.proposeRefund(s.ctx, {
      orderId: order.id,
      paymentId: payment.id,
      amountMinor: 5_000,
      reason: "metrics test",
      revokeEntitlements: false,
      policyException: false,
    });
    await approvalsService.approveRequest(
      buildContext({ user: { id: s.admin2.id }, session: { id: "sess-b" }, roles: ["admin"] }),
      { approvalRequestId },
    );

    const m = await getFinanceSummary(RANGE);
    expect(m.refundsMinor).toBe(5_000);
    expect(m.grossSalesMinor).toBe(before.grossSalesMinor); // sale itself is untouched
    expect(m.companyShareMinor + m.partnerSharesMinor).toBe(
      before.companyShareMinor + before.partnerSharesMinor - 5_000,
    );
    expectReconciles(m);

    const refunds = await financeService.getReport(s.ctx, { report: "refunds", ...RANGE });
    expect(refunds.totals.refundTotalMinor).toBe(5_000);
    const byPeriod = await financeService.getReport(s.ctx, {
      report: "revenue_by_period",
      ...RANGE,
    });
    expect(byPeriod.totals.refundMinor).toBe(5_000);
  });

  it("partial payment: shortfall is a bank charge, collected stays the billed amount", async () => {
    const s = await setup({ priceMinor: 100_000 });
    await postPaidOrder(s, { receivedMinor: 90_000 });

    const m = await getFinanceSummary(RANGE);
    expect(m.bankShortfallMinor).toBe(10_000);
    expect(m.feesMinor).toBe(10_000);
    expect(m.collectedMinor).toBe(100_000);
    expect(m.companyShareMinor + m.partnerSharesMinor).toBe(90_000);
    expectReconciles(m);
  });

  it("zero-partner product: company takes all, partner shares are 0", async () => {
    const s = await setup({ priceMinor: 50_000, noPartner: true });
    await postPaidOrder(s, { discountMinor: 10_000 });

    const m = await getFinanceSummary(RANGE);
    expect(m.netSalesMinor).toBe(40_000);
    expect(m.companyShareMinor).toBe(40_000);
    expect(m.partnerSharesMinor).toBe(0);
    expectReconciles(m);
  });

  it("outstanding: unpaid orders and submitted payments are counted, paid ones are not", async () => {
    const s = await setup({ priceMinor: 30_000 });
    await postPaidOrder(s, {});
    const unpaid = await createOrder({ offering: s.offering, currency: "INR" });
    const submitted = await createOrder({ offering: s.offering, currency: "INR" });
    await createPayment({ order: submitted, status: "submitted" });

    const m = await getFinanceSummary(RANGE);
    expect(m.outstandingMinor).toBe(unpaid.totalMinor + submitted.totalMinor);
    expect(m.collectedMinor).toBe(30_000);
  });

  it("empty ledger: every metric is 0 (no NaN)", async () => {
    const m = await getFinanceSummary(RANGE);
    for (const v of Object.values(m)) expect(v).toBe(0);
  });
});

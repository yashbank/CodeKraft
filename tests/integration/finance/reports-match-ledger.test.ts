import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { financeService } from "@/modules/finance/service";
import { paymentsService } from "@/modules/payments/service";
import { ledgerEntries } from "../../../drizzle/schema/finance";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createOrder, createPayment } from "../../factories/commerce";
import { buildContext } from "@/lib/authz/context";

describe("reports match ledger recomputations (API-FIN-09, FR-FIN-10..14, master plan §6)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("ensures each report total equals an independent raw query over ledger_entries", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partner = await createPartner({ userId: admin.id });
    const product = await createProduct({ createdBy: admin.id });

    // 20% company cut, 80% partner
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
      price: { amountMinor: 100000, currency: "INR" },
    });
    const customer = await createUser();

    const order = await createOrder({
      offering,
      user: customer,
      quantity: 1,
      currency: "INR",
    });

    const payment = await createPayment({
      order,
      status: "confirmed",
      amountReceivedMinor: 100000,
      confirmedBy: admin.id,
    });

    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    // Record an expense
    await financeService.recordExpense(adminCtx, {
      productId: product.id,
      category: "infrastructure",
      description: "Hosting costs",
      amountMinor: 10000,
      currency: "INR",
      incurredOn: "2026-09-26",
      sharedBySplit: true,
    });

    // 1. revenue_by_product
    const productReport = await financeService.getReport(adminCtx, {
      report: "revenue_by_product",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });

    const [rawGross] = await db
      .select({ sum: sql<string>`COALESCE(SUM(ABS(amount_inr_minor)), 0)` })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.entryType, "sale"));

    expect(productReport.totals.grossMinor).toBe(Number(rawGross?.sum));

    // 2. revenue_by_partner
    const partnerReport = await financeService.getReport(adminCtx, {
      report: "revenue_by_partner",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });

    const [rawAlloc] = await db
      .select({ sum: sql<string>`COALESCE(SUM(ABS(amount_inr_minor)), 0)` })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.entryType, "partner_allocation"));

    expect(partnerReport.totals.allocatedMinor).toBe(Number(rawAlloc?.sum));

    // 3. profit_by_product
    const profitReport = await financeService.getReport(adminCtx, {
      report: "profit_by_product",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });

    const [rawExpenses] = await db
      .select({ sum: sql<string>`COALESCE(SUM(ABS(amount_inr_minor)), 0)` })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.entryType, "expense"));

    expect(profitReport.totals.saleMinor).toBe(Number(rawGross?.sum));
    expect(profitReport.totals.expenseMinor).toBe(Number(rawExpenses?.sum));
    expect(profitReport.totals.profitMinor).toBe(Number(rawGross?.sum) - Number(rawExpenses?.sum));

    // 4. outstanding_payouts
    const payoutReport = await financeService.getReport(adminCtx, {
      report: "outstanding_payouts",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });

    expect(payoutReport.rows.length).toBeGreaterThan(0);
    expect(payoutReport.totals.balanceInrMinor).toBeGreaterThan(0);
  });
});

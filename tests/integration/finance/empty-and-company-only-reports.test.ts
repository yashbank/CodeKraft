import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { auditLogs } from "../../../drizzle/schema/audit";
import { financeService } from "@/modules/finance/service";
import { usersService } from "@/modules/users/service";
import { mapReportResultToDefinition } from "@/lib/admin/finance-view";
import type { ReportKey } from "@/modules/finance/types";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { productOwnerships } from "../../../drizzle/schema/ownership";
import { createOrder, createPayment } from "../../factories/commerce";
import { buildContext } from "@/lib/authz/context";

const KEYS: ReportKey[] = [
  "revenue_by_period",
  "revenue_by_product",
  "revenue_by_partner",
  "tax_collected",
  "refunds",
  "outstanding_payouts",
  "profit_by_product",
  "customer_credits",
];
const META = { title: "t", description: "d", formula: "f" };
const range = { dateFrom: "2020-04-01", dateTo: "2099-03-31" };

function assertClean(def: ReturnType<typeof mapReportResultToDefinition>) {
  const flat = JSON.stringify([def.tiles, def.series, def.rows, def.totals ?? []]);
  expect(flat).not.toMatch(/NaN|Infinity|null/);
}

describe("finance reports + partner lists with empty / company-only data", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("every report renders with no data at all", async () => {
    const admin = await createAdmin();
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "s" },
      roles: ["super_admin"],
    });
    for (const report of KEYS) {
      const res = await financeService.getReport(ctx, { report, ...range });
      expect(res.rows).toEqual([]);
      assertClean(mapReportResultToDefinition(res, META));
    }
    const partners = await usersService.listPartners(ctx, { limit: 100 });
    expect(partners.items).toEqual([]);
    expect((await financeService.listPayouts(ctx, { limit: 100 })).items).toEqual([]);
    expect(await financeService.getPartnerBalances(ctx, {})).toEqual([]);
    const ledger = await financeService.listLedgerEntries(ctx, { limit: 100 });
    expect(ledger.items).toEqual([]);
  });

  it("INR 1 paid order with 100% company cut and zero partner lines", async () => {
    const admin = await createAdmin();
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "s" },
      roles: ["super_admin"],
    });
    const product = await createProduct({ createdBy: admin.id });
    await db.insert(productOwnerships).values({
      productId: product.id,
      version: 1,
      companyCutBps: 10000,
      status: "active",
      effectiveFrom: new Date(),
      createdBy: admin.id,
    });
    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 100, currency: "INR" },
    });
    const customer = await createUser();
    const order = await createOrder({ offering, user: customer, quantity: 1, currency: "INR" });
    await createPayment({
      order,
      status: "confirmed",
      amountReceivedMinor: 100,
      confirmedBy: admin.id,
    });
    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    const defs: Record<string, ReturnType<typeof mapReportResultToDefinition>> = {};
    for (const report of KEYS) {
      const res = await financeService.getReport(ctx, { report, ...range });
      const def = mapReportResultToDefinition(res, META);
      assertClean(def);
      defs[report] = def;
    }
    // INR 1 shows as 1 (minor 100 / 100), not 100 or 0.01
    const byProduct = await financeService.getReport(ctx, {
      report: "revenue_by_product",
      ...range,
    });
    expect(byProduct.rows).toHaveLength(1);
    expect(byProduct.rows[0]).toMatchObject({ grossMinor: 100, netMinor: 100, orderCount: 1 });
    const profit = await financeService.getReport(ctx, { report: "profit_by_product", ...range });
    expect(profit.rows[0]).toMatchObject({ saleMinor: 100, profitMinor: 100 });
    const period = await financeService.getReport(ctx, { report: "revenue_by_period", ...range });
    expect(period.totals).toMatchObject({ grossMinor: 100, netMinor: 100 });
    expect(defs.revenue_by_product!.tiles.find((t) => t.label === "Net Revenue")?.valueInr).toBe(
      100,
    );
    expect(defs.profit_by_product!.tiles.find((t) => t.label === "Net Profit")?.valueInr).toBe(100);
    expect(defs.revenue_by_partner!.rows).toEqual([]);
    // mapped table cells are formatted INR, never raw minor units or /100 twice
    expect(defs.revenue_by_product!.rows[0]).toContain("₹1.00");
    expect(defs.revenue_by_product!.tiles.find((t) => t.label === "Orders")).toMatchObject({
      valueInr: 1,
      isCount: true,
    });
    expect(defs.revenue_by_product!.columns).not.toContain("Product ID");

    expect((await usersService.listPartners(ctx, { limit: 100 })).items).toEqual([]);
    expect(await financeService.getPartnerBalances(ctx, {})).toEqual([]);
  });
});

describe("partner creation + super admin backfill", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("ensureSuperAdminPartners is idempotent, audited, super_admin only; createPartner links an admin", async () => {
    const sa = await createUser({ role: "super_admin" });
    const plain = await createUser({ role: "admin" });
    const superCtx = buildContext({
      user: { id: sa.id },
      session: { id: "s" },
      roles: ["super_admin"],
    });
    const adminCtx = buildContext({
      user: { id: plain.id },
      session: { id: "s2" },
      roles: ["admin"],
    });

    await expect(usersService.ensureSuperAdminPartners(adminCtx)).rejects.toThrow();

    const first = await usersService.ensureSuperAdminPartners(superCtx);
    expect(first.created).toHaveLength(1);
    expect(first.created[0]!.userId).toBe(sa.id);
    const second = await usersService.ensureSuperAdminPartners(superCtx);
    expect(second.created).toHaveLength(0);
    expect(second.existing).toBe(1);

    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "API-ADM-12 partner.create"));
    expect(audits).toHaveLength(1);

    const cands = await usersService.listPartnerCandidates(superCtx);
    expect(cands.items.map((c) => c.userId)).toEqual([plain.id]);
    const { partner } = await usersService.createPartner(superCtx, {
      email: String(plain.email),
      displayName: "Second Partner",
    });
    expect(partner.displayName).toBe("Second Partner");
    await expect(usersService.createPartner(superCtx, { userId: plain.id })).rejects.toThrow(
      /already a partner/,
    );
    const customer = await createUser();
    await expect(usersService.createPartner(superCtx, { userId: customer.id })).rejects.toThrow(
      /admin/,
    );
    const list = await usersService.listPartners(superCtx, { limit: 100 });
    expect(list.items).toHaveLength(2);
  });
});

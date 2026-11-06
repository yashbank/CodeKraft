/**
 * G18: a full reset leaves no trace of demo or removed partners. Payouts, allocations, ledger
 * lines, ownership shares of removed partners and the partner rows themselves are gone; real
 * admin-class accounts (and their partner rows) survive; list and dashboard queries read zero.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { financeService } from "@/modules/finance/service";
import { runReset } from "@/modules/settings/site-reset";
import { listPartners } from "@/modules/users/partners";
import { loadDashboardFinance } from "@/lib/admin/dashboard-finance";
import { payouts } from "../../../drizzle/schema/finance";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createPartner, createSuperAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createOrder, createPayment } from "../../factories/commerce";

const n = async (table: string): Promise<number> =>
  Number([...(await db.execute(sql.raw(`select count(*)::int as c from "${table}"`)))][0]?.c ?? 0);

async function paidOrderOn(productId: string, buyerId: string, adminId: string) {
  const offering = await createOffering({
    productId,
    price: { amountMinor: 10000, currency: "INR" },
  });
  const order = await createOrder({
    offering,
    user: { id: buyerId } as never,
    quantity: 1,
    currency: "INR",
  });
  await createPayment({
    order,
    status: "confirmed",
    amountReceivedMinor: 10000,
    confirmedBy: adminId,
  });
  await withTx((tx) => financeService.postOrderPaid(order.id, tx));
}

describe("reset site data clears partners, payouts, allocations and ledger traces", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("full reset: customers 0, only the real admin partner remains, finance reads zero", async () => {
    await truncateAll();
    const root = await createSuperAdmin({ email: "real.admin@example.com" });
    const realPartner = await createPartner({ user: root });
    // A removed admin: no role any more, partner row kept because money rows pointed at it.
    const ex = await createUser({ email: "ex.admin@example.com" });
    const exPartner = await createPartner({ user: ex, active: false });
    const buyer = await createUser({ email: "buyer@example.com" });

    const kept = await createProduct({ createdBy: root.id });
    await createOwnership({
      productId: kept.id,
      companyCutBps: 1000,
      createdBy: root.id,
      lines: [{ partnerId: realPartner.id, shareBps: 9000 }],
    });
    const shared = await createProduct({ createdBy: root.id });
    await createOwnership({
      productId: shared.id,
      companyCutBps: 1000,
      createdBy: root.id,
      lines: [
        { partnerId: realPartner.id, shareBps: 5000 },
        { partnerId: exPartner.id, shareBps: 4000 },
      ],
    });
    await paidOrderOn(shared.id, buyer.id, root.id);
    await db.insert(payouts).values({
      partnerId: exPartner.id,
      amountMinor: 100,
      currency: "INR",
      paidOn: "2026-01-01",
      reference: "UTR-1",
    });

    const ctx = buildContext({
      user: { id: root.id },
      session: { id: "s" },
      roles: ["super_admin"],
    });
    // Before: the ex-partner is listed because it has money history.
    const before = await listPartners(ctx, { limit: 25 }, db);
    expect(before.items.map((p) => p.email)).toContain("ex.admin@example.com");
    expect(await n("ledger_entries")).toBeGreaterThan(0);
    expect(await n("allocations")).toBeGreaterThan(0);

    await db.transaction(async (tx) => {
      await runReset(
        { run: async (t) => [...(await tx.execute(sql.raw(t)))] as Record<string, unknown>[] },
        ["customers_orders"],
      );
    });

    // Customers are zero: nobody left without an admin-class role.
    const customers = [
      ...(await db.execute(
        sql`select id from users u where not exists (select 1 from user_roles r where r.user_id = u.id and r.role_key in ('super_admin','admin','staff'))`,
      )),
    ];
    expect(customers).toHaveLength(0);
    const left = [...(await db.execute(sql`select email from users`))].map((r) => r.email);
    expect(left).toEqual(["real.admin@example.com"]);

    // Partners: only the real admin's row.
    const partnerRows = [...(await db.execute(sql`select id from partners`))].map((r) => r.id);
    expect(partnerRows).toEqual([realPartner.id]);
    const listed = await listPartners(ctx, { limit: 25 }, db);
    expect(listed.items.map((p) => p.email)).toEqual(["real.admin@example.com"]);

    // Money and share traces are gone.
    for (const t of ["ledger_entries", "allocations", "payouts", "orders", "payments"]) {
      expect(await n(t), t).toBe(0);
    }
    // The ownership that gave a share to the removed partner is gone; the real one stays.
    const lines = [...(await db.execute(sql`select partner_id from product_ownership_lines`))];
    expect(lines.map((l) => l.partner_id)).toEqual([realPartner.id]);
    expect(await n("product_ownerships")).toBe(1);

    // Dashboard widgets derived from the ledger read zero and name nobody.
    const widgets = await loadDashboardFinance(ctx, {
      dateFrom: "2020-01-01",
      dateTo: "2030-01-01",
    } as never);
    expect(widgets.revenueByPartner).toEqual([]);
    expect(widgets.outstandingPayouts.totalInr).toBe(0);
    expect(widgets.outstandingPayouts.items).toEqual([]);
  });

  it("an orphan partner with no money rows is hidden from the partners list", async () => {
    await truncateAll();
    const root = await createSuperAdmin();
    const ghost = await createUser({ email: "ghost@example.com" });
    await createPartner({ user: ghost, active: false });
    const ctx = buildContext({
      user: { id: root.id },
      session: { id: "s" },
      roles: ["super_admin"],
    });
    const res = await listPartners(ctx, { limit: 25 }, db);
    expect(res.items.map((p) => p.email)).not.toContain("ghost@example.com");
  });
});

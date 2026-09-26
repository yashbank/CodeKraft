import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { financeService } from "@/modules/finance/service";
import { ledgerEntries } from "../../../drizzle/schema/finance";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createOrder, createPayment } from "../../factories/commerce";
import { buildContext } from "@/lib/authz/context";

describe("VIEW partner_balances vs recomputed ledger (FR-FIN-06, API-FIN-03, FI-06)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("VIEW partner_balances exactly matches manual sum of partner ledger rows", async () => {
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
      price: { amountMinor: 50000, currency: "INR" },
    });
    const customer = await createUser();

    const order = await createOrder({
      offering,
      user: customer,
      quantity: 1,
      currency: "INR",
    });

    await createPayment({
      order,
      status: "confirmed",
      amountReceivedMinor: 50000,
      confirmedBy: admin.id,
    });

    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    // 1. Query using getPartnerBalances (which reads VIEW partner_balances)
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    const balances = await financeService.getPartnerBalances(ctx, { partnerId: partner.id });
    expect(balances).toHaveLength(1);
    const pb = balances[0]!;
    expect(pb.partnerId).toBe(partner.id);
    expect(pb.byCurrency).toHaveLength(1);

    const inrBalance = pb.byCurrency.find((c) => c.currency === "INR");
    expect(inrBalance).toBeDefined();
    // 80% of 50000 = 40000
    expect(inrBalance!.allocated).toBe(40000);
    expect(inrBalance!.balance).toBe(40000);
    expect(pb.balanceInrMinor).toBe(40000);

    // 2. Query directly from ledger_entries and recompute
    const [manualRecompute] = await db
      .select({
        allocated: sql<number>`COALESCE(SUM(amount_minor) FILTER (WHERE entry_type = 'partner_allocation'), 0)::bigint`,
        balance: sql<number>`COALESCE(SUM(amount_minor), 0)::bigint`,
        balanceInr: sql<number>`COALESCE(SUM(amount_inr_minor), 0)::bigint`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.partnerId, partner.id));

    expect(Number(manualRecompute?.allocated)).toBe(inrBalance!.allocated);
    expect(Number(manualRecompute?.balance)).toBe(inrBalance!.balance);
    expect(Number(manualRecompute?.balanceInr)).toBe(pb.balanceInrMinor);
  });
});

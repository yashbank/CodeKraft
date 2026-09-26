import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
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

describe("company-only expense reduces company only (FI-13, API-FIN-06, D-514)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("posts a single company entry and leaves partner balances untouched", async () => {
    await truncateAll();

    const admin = await createAdmin();
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

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    const [balBefore] = await financeService.getPartnerBalances(adminCtx, { partnerId: partner.id });
    expect(balBefore?.byCurrency[0]?.balance).toBe(40000); // 80% of 50000

    // Record company-only expense (sharedBySplit: false)
    const res = await financeService.recordExpense(adminCtx, {
      productId: product.id,
      category: "software",
      description: "Company domain renewal",
      amountMinor: 5000,
      currency: "INR",
      incurredOn: "2026-09-26",
      sharedBySplit: false,
    });

    expect(res.expenseId).toBeDefined();
    expect(res.entryIds.length).toBe(1);

    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.expenseId, res.expenseId));

    expect(entries.length).toBe(1);
    expect(entries[0]?.partyType).toBe("company");
    expect(entries[0]?.partnerId).toBeNull();
    expect(entries[0]?.amountMinor).toBe(-5000);

    // Partner balance untouched
    const [balAfter] = await financeService.getPartnerBalances(adminCtx, { partnerId: partner.id });
    expect(balAfter?.byCurrency[0]?.balance).toBe(40000);
  });
});

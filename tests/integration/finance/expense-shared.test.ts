import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { financeService } from "@/modules/finance/service";
import { expenses, ledgerEntries } from "../../../drizzle/schema/finance";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createOrder, createPayment } from "../../factories/commerce";
import { buildContext } from "@/lib/authz/context";

describe("shared expense reduces partner balances by their bps (FI-13, API-FIN-06, D-514)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("splits expense across active ownership lines and company cut, reducing partner balances", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partnerUser1 = await createAdmin();
    const partnerUser2 = await createAdmin();
    const partner1 = await createPartner({ userId: partnerUser1.id });
    const partner2 = await createPartner({ userId: partnerUser2.id });
    const product = await createProduct({ createdBy: admin.id });

    // 10% company cut, partner1 60%, partner2 40%
    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 1000,
      createdBy: admin.id,
      lines: [
        { partnerId: partner1.id, shareBps: 6000 },
        { partnerId: partner2.id, shareBps: 4000 },
      ],
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

    await createPayment({
      order,
      status: "confirmed",
      amountReceivedMinor: 100000,
      confirmedBy: admin.id,
    });

    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    // Check pre-expense balances
    // Distributable = 100000, company = 10000 (10%), pool = 90000
    // partner1 = 60% of 90000 = 54000
    // partner2 = 40% of 90000 = 36000
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    const [bal1Before] = await financeService.getPartnerBalances(adminCtx, { partnerId: partner1.id });
    const [bal2Before] = await financeService.getPartnerBalances(adminCtx, { partnerId: partner2.id });
    expect(bal1Before?.byCurrency[0]?.balance).toBe(54000);
    expect(bal2Before?.byCurrency[0]?.balance).toBe(36000);

    // Record shared expense of 10000 INR
    // 10% company cut = 1000 INR
    // Partner pool = 9000 INR
    // partner1 (60%) = 5400 INR
    // partner2 (40%) = 3600 INR
    const res = await financeService.recordExpense(adminCtx, {
      productId: product.id,
      category: "hosting",
      description: "AWS cloud server cluster",
      amountMinor: 10000,
      currency: "INR",
      incurredOn: "2026-09-26",
      sharedBySplit: true,
    });

    expect(res.expenseId).toBeDefined();
    expect(res.entryIds.length).toBe(3); // 2 partners + 1 company cut

    // Check ledger entries created
    const expEntries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.expenseId, res.expenseId));

    expect(expEntries.length).toBe(3);

    const companyEntry = expEntries.find((e) => e.partyType === "company");
    expect(companyEntry?.amountMinor).toBe(-1000);

    const p1Entry = expEntries.find((e) => e.partyType === "partner" && e.partnerId === partner1.id);
    expect(p1Entry?.amountMinor).toBe(-5400);

    const p2Entry = expEntries.find((e) => e.partyType === "partner" && e.partnerId === partner2.id);
    expect(p2Entry?.amountMinor).toBe(-3600);

    // Check updated balances
    const [bal1After] = await financeService.getPartnerBalances(adminCtx, { partnerId: partner1.id });
    const [bal2After] = await financeService.getPartnerBalances(adminCtx, { partnerId: partner2.id });

    expect(bal1After?.byCurrency[0]?.balance).toBe(54000 - 5400); // 48600
    expect(bal2After?.byCurrency[0]?.balance).toBe(36000 - 3600); // 32400

    // List expenses
    const listRes = await financeService.listExpenses(adminCtx, { productId: product.id });
    expect(listRes.items.length).toBe(1);
    expect(listRes.items[0]?.id).toBe(res.expenseId);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { financeService } from "@/modules/finance/service";
import { reconcileFinance } from "@/modules/finance/reconcile";
import { ledgerEntries } from "../../../drizzle/schema/finance";
import { notifications } from "../../../drizzle/schema/notifications";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createOrder, createPayment } from "../../factories/commerce";

describe("finance nightly reconciliation service (NFR-DATA-04, FR-OPS-01, master plan §6)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("passes cleanly on consistent ledger entries and allocations", async () => {
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
      price: { amountMinor: 25000, currency: "INR" },
    });
    const customer = await createUser();

    const order = await createOrder({
      offering,
      user: customer,
      quantity: 1,
      currency: "INR",
      status: "paid",
    });

    await createPayment({
      order,
      status: "confirmed",
      amountReceivedMinor: 25000,
      confirmedBy: admin.id,
    });

    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    // Run reconciliation
    const result = await reconcileFinance();
    expect(result.ok).toBe(true);
    expect(result.checkedOrdersCount).toBe(1);
    expect(result.discrepancies).toHaveLength(0);
  });

  it("detects seeded inconsistent ledger entry and dispatches system.job_failed notification to admins", async () => {
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
      price: { amountMinor: 25000, currency: "INR" },
    });
    const customer = await createUser();

    const order = await createOrder({
      offering,
      user: customer,
      quantity: 1,
      currency: "INR",
      status: "paid",
    });

    await createPayment({
      order,
      status: "confirmed",
      amountReceivedMinor: 25000,
      confirmedBy: admin.id,
    });

    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    // Seed an inconsistent/unbalanced ledger entry directly into the order
    await db.insert(ledgerEntries).values({
      orderId: order.id,
      entryType: "adjustment",
      partyType: "partner",
      partnerId: partner.id,
      amountMinor: 5000, // breaks the 0-sum invariant FI-04
      currency: "INR",
      fxRateToInr: "1.00000000",
      amountInrMinor: 5000,
      memo: "Inconsistent seeded entry",
      createdBy: admin.id,
      createdAt: new Date(),
    });

    // Run reconciliation
    const result = await reconcileFinance();
    expect(result.ok).toBe(false);
    expect(result.discrepancies.length).toBeGreaterThan(0);
    expect(result.discrepancies[0]?.invariant).toBe("FI-04");

    // Verify system.job_failed notification was dispatched to admin
    const notifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.type, "system.job_failed"));

    expect(notifs.length).toBeGreaterThan(0);
    expect(notifs[0]?.title).toContain("reconciliation failed");
  });
});

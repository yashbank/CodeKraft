import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { financeService } from "@/modules/finance/service";
import { allocations, ledgerEntries } from "../../../drizzle/schema/finance";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createOrder, createOrderItem, createPayment } from "../../factories/commerce";

describe("postOrderPaid integration (docs/06 §4.2, §5.1, master plan §5)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("posts ledger entries and allocation snapshot for a confirmed paid order", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partner = await createPartner({ userId: admin.id });
    const product = await createProduct({ createdBy: admin.id });

    // Active ownership: 10% company cut (1000 bps), 100% partner (10000 bps)
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
      price: { amountMinor: 10000, currency: "INR" },
    });
    const customer = await createUser();

    const order = await createOrder({
      offering,
      user: customer,
      quantity: 1,
      currency: "INR",
    });

    // Confirmed payment with shortfall: due 10000, received 9500 -> bank shortfall 500
    const payment = await createPayment({
      order,
      status: "confirmed",
      amountReceivedMinor: 9500,
      confirmedBy: admin.id,
    });
    expect(payment.bankShortfallMinor).toBe(500);

    const result = await withTx(async (tx) => {
      return await financeService.postOrderPaid(order.id, tx);
    });

    expect(result.entryCount).toBeGreaterThan(0);
    expect(result.allocationIds).toHaveLength(1);

    // Verify allocations row
    const [allocRow] = await db
      .select()
      .from(allocations)
      .where(eq(allocations.id, result.allocationIds[0]!));

    expect(allocRow).toBeDefined();
    // gross = 10000, shortfall = 500 -> distributable = 9500
    // company (10%) = 950
    // partner pool = 9500 - 950 = 8550
    expect(allocRow!.distributableMinor).toBe(9500);
    expect(allocRow!.companyMinor).toBe(950);
    expect(allocRow!.lines).toEqual([
      { partner_id: partner.id, share_bps: 10000, amount_minor: 8550 },
    ]);
    expect(allocRow!.currency).toBe("INR");

    // Verify ledger entries
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, order.id));

    expect(entries).toHaveLength(result.entryCount);

    const sale = entries.find((e) => e.entryType === "sale")!;
    expect(sale.partyType).toBe("customer");
    expect(sale.amountMinor).toBe(-10000);

    const bankCharge = entries.find((e) => e.entryType === "bank_charge")!;
    expect(bankCharge.partyType).toBe("bank");
    expect(bankCharge.amountMinor).toBe(500);

    const companyCut = entries.find((e) => e.entryType === "company_cut")!;
    expect(companyCut.partyType).toBe("company");
    expect(companyCut.amountMinor).toBe(950);

    const partnerAlloc = entries.find((e) => e.entryType === "partner_allocation")!;
    expect(partnerAlloc.partyType).toBe("partner");
    expect(partnerAlloc.partnerId).toBe(partner.id);
    expect(partnerAlloc.amountMinor).toBe(8550);

    // FI-04: sum equals 0
    const sum = entries.reduce((acc, e) => acc + e.amountMinor, 0);
    expect(sum).toBe(0);
  });

  it("spreads shortfall pro-rata across multiple items", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partner = await createPartner({ userId: admin.id });
    const product = await createProduct({ createdBy: admin.id });

    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 0,
      createdBy: admin.id,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 5000, currency: "INR" },
    });
    const customer = await createUser();

    // Order with 2 items: item 1 = 3000, item 2 = 7000 (total 10000)
    const order = await createOrder({
      user: customer,
      currency: "INR",
      withItem: false,
    });

    await createOrderItem({
      orderId: order.id,
      offering,
      unitMinor: 3000,
      quantity: 1,
    });

    await createOrderItem({
      orderId: order.id,
      offering,
      unitMinor: 7000,
      quantity: 1,
    });

    // Payment has shortfall 100 (received 9900 out of 10000)
    await createPayment({
      order: { id: order.id, totalMinor: 10000, currency: "INR" },
      status: "confirmed",
      amountReceivedMinor: 9900,
      confirmedBy: admin.id,
    });

    const result = await withTx(async (tx) => {
      return await financeService.postOrderPaid(order.id, tx);
    });

    expect(result.allocationIds).toHaveLength(2);

    const allocs = await db
      .select()
      .from(allocations)
      .where(eq(allocations.currency, "INR"))
      .orderBy(allocations.distributableMinor);

    // Item 1: 3000 - 30 = 2970
    // Item 2: 7000 - 70 = 6930
    expect(allocs[0]?.distributableMinor).toBe(2970);
    expect(allocs[1]?.distributableMinor).toBe(6930);

    const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.orderId, order.id));
    const sum = entries.reduce((acc, e) => acc + e.amountMinor, 0);
    expect(sum).toBe(0);
  });
});

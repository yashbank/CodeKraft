import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { financeService } from "@/modules/finance/service";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createOrder, createPayment } from "../../factories/commerce";
import { buildContext } from "@/lib/authz/context";

describe("payout over balance refused (API-FIN-04, FI-14, MASTER_SPEC §7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("refuses payout request when amount exceeds partner balance in that currency (FI-14)", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partner = await createPartner({ userId: admin.id });
    const product = await createProduct({ createdBy: admin.id });

    // 10% company cut, 90% partner
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

    await createPayment({
      order,
      status: "confirmed",
      amountReceivedMinor: 10000,
      confirmedBy: admin.id,
    });

    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    // Partner balance is 9,000 INR
    // Attempting to record payout for 10,000 INR must fail with VALIDATION error
    await expect(
      financeService.recordPayout(ctx, {
        partnerId: partner.id,
        amountMinor: 10000,
        currency: "INR",
        paidOn: "2026-09-26",
        reference: "UTR-TEST-OVERDRAW",
      }),
    ).rejects.toThrow(/exceeds partner balance/i);

    // Attempting to record payout in USD (balance 0) must also fail
    await expect(
      financeService.recordPayout(ctx, {
        partnerId: partner.id,
        amountMinor: 100,
        currency: "USD",
        paidOn: "2026-09-26",
        reference: "UTR-TEST-USD",
      }),
    ).rejects.toThrow(/exceeds partner balance/i);
  });
});

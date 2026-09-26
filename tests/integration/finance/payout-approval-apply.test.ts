import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { financeService } from "@/modules/finance/service";
import { approvalsService } from "@/modules/approvals/service";
import { ledgerEntries, payouts } from "../../../drizzle/schema/finance";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createOrder, createPayment } from "../../factories/commerce";
import { buildContext } from "@/lib/authz/context";

describe("payout approval and apply lifecycle (API-FIN-04, API-FIN-05, FI-06, BR-13)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("records payout, approves with dual-admin, reduces partner balance exactly by payout amount", async () => {
    await truncateAll();

    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const partner = await createPartner({ userId: admin1.id });
    const product = await createProduct({ createdBy: admin1.id });

    // 20% company cut, 80% partner
    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 2000,
      createdBy: admin1.id,
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
      confirmedBy: admin1.id,
    });

    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["admin"],
    });

    const admin2Ctx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-admin-2" },
      roles: ["admin"],
    });

    // 1. Initial partner balance is 40,000 INR
    const initialBalances = await financeService.getPartnerBalances(admin1Ctx, { partnerId: partner.id });
    const initialInr = initialBalances[0]?.byCurrency.find((c) => c.currency === "INR");
    expect(initialInr?.balance).toBe(40000);

    // 2. Admin 1 records payout of 15,000 INR
    const { approvalRequestId } = await financeService.recordPayout(admin1Ctx, {
      partnerId: partner.id,
      amountMinor: 15000,
      currency: "INR",
      paidOn: "2026-09-26",
      reference: "UTR-BANK-TRANSFER-9999",
      note: "Quarterly partner distribution",
    });
    expect(approvalRequestId).toBeDefined();

    // 3. Admin 2 approves the payout.record approval request
    const decideRes = await approvalsService.approveRequest(admin2Ctx, {
      approvalRequestId,
      comment: "Approved payout transfer",
    });
    expect(decideRes.status).toBe("applied");

    // 4. Verify immutable payouts row exists
    const [payoutRow] = await db
      .select()
      .from(payouts)
      .where(eq(payouts.approvalRequestId, approvalRequestId));
    expect(payoutRow).toBeDefined();
    expect(payoutRow?.amountMinor).toBe(15000);
    expect(payoutRow?.currency).toBe("INR");
    expect(payoutRow?.reference).toBe("UTR-BANK-TRANSFER-9999");

    // 5. Verify ledger entries have negative payout entry
    const payoutEntries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.payoutId, payoutRow!.id));
    expect(payoutEntries).toHaveLength(1);
    const entry = payoutEntries[0]!;
    expect(entry.entryType).toBe("payout");
    expect(entry.partyType).toBe("partner");
    expect(entry.partnerId).toBe(partner.id);
    expect(entry.amountMinor).toBe(-15000);

    // 6. FI-06: Balance reduced exactly by payout amount (40,000 - 15,000 = 25,000)
    const updatedBalances = await financeService.getPartnerBalances(admin1Ctx, { partnerId: partner.id });
    const updatedInr = updatedBalances[0]?.byCurrency.find((c) => c.currency === "INR");
    expect(updatedInr?.balance).toBe(25000);
    expect(updatedInr?.paidOut).toBe(15000);
    expect(updatedBalances[0]?.balanceInrMinor).toBe(25000);

    // 7. listPayouts returns the recorded payout
    const payoutsList = await financeService.listPayouts(admin1Ctx, { partnerId: partner.id });
    expect(payoutsList.items).toHaveLength(1);
    expect(payoutsList.items[0]?.id).toBe(payoutRow!.id);
  });
});

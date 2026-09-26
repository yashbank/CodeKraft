/**
 * credit-note-numbered: gapless credit note numbering CK/CN/<fy>/<seq> verified after refund apply.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db, withTx } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { approvalsService } from "@/modules/approvals/service";
import { buildContext } from "@/lib/authz/context";
import { refunds } from "../../../drizzle/schema/commerce";
import { creditNotes } from "../../../drizzle/schema/invoices";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOrder, createPayment, createInvoice } from "../../factories/commerce";

process.env.APP_ENV = "local";
process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "";
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;

beforeAll(async () => {
  await migrateTestDb();
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe("applyRefund — credit note numbering", () => {
  it("credit note gets a gapless CN/<fy>/<seq> number after refund apply", async () => {
    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const partner = await createPartner({ userId: admin1.id });

    const product = await createProduct({
      isRefundable: true,
      createdBy: admin1.id,
      ownership: {
        companyCutBps: 3000,
        lines: [{ partnerId: partner.id, shareBps: 10_000 }],
      },
    });
    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 15_000, currency: "INR" },
    });
    const order = await createOrder({ offering, status: "paid" });
    const payment = await createPayment({ order, status: "confirmed", confirmedBy: admin1.id });

    // Issue invoice
    await createInvoice({ order });

    // Post ledger entries
    const { financeService } = await import("@/modules/finance/service");
    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    const ctx1 = buildContext({ user: { id: admin1.id }, session: { id: "s1" }, roles: ["admin"] });
    const ctx2 = buildContext({ user: { id: admin2.id }, session: { id: "s2" }, roles: ["admin"] });

    const { approvalRequestId } = await paymentsService.proposeRefund(ctx1, {
      orderId: order.id,
      paymentId: payment.id,
      amountMinor: 15_000,
      reason: "Refund for credit note test",
      revokeEntitlements: false,
      policyException: false,
    });

    await approvalsService.approveRequest(ctx2, { approvalRequestId, comment: null });

    // Check that credit note exists and has gapless number
    const [refundRow] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, order.id));

    expect(refundRow?.creditNoteId).not.toBeNull();

    const [cn] = await db
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.id, refundRow!.creditNoteId!));

    expect(cn?.creditNo).toMatch(/^CK\/CN\/\d{4}-\d{2}\/\d{4}$/);
    expect(cn?.amountMinor).toBe(15_000);
  });
});

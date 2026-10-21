/**
 * POST /api/webhooks/razorpay — docs/06 §3.4, §4.3 (V1.1, D-501), TEST MODE ONLY.
 *
 * `RazorpayProvider.handleWebhook()` verifies `X-Razorpay-Signature` and owns `webhook_events`
 * idempotency, returning a typed, side-effect-free `WebhookOutcome`. This route only maps that
 * outcome onto the *same* `paymentsService.confirmPayment` / `failPayment` the admin manual-confirm
 * flow calls (docs/06 §4.3: "Webhook → service.confirm() is the same function admins call, so
 * idempotency and audit (actor `webhook:<provider>`) are shared") — it never re-implements the
 * ledger/order/invoice/entitlement side effects itself.
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { payments } from "../../../../../drizzle/schema/commerce";
import { getDb } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { AppError, ErrorCode } from "@/lib/errors";
import { settingsService } from "@/modules/settings/service";
import { paymentsService, WEBHOOK_ACTOR_USER_ID } from "@/modules/payments/service";
import { computeRazorpayChecksum, razorpayProvider } from "@/modules/payments/providers/razorpay";

export const dynamic = "force-dynamic";

interface RazorpayPaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  fee?: number;
}

function webhookCtx() {
  return buildContext({
    user: { id: WEBHOOK_ACTOR_USER_ID },
    session: { id: "webhook:razorpay" },
    roles: ["super_admin"],
  });
}

export async function POST(req: Request) {
  try {
    const outcome = await razorpayProvider.handleWebhook(req);

    if (outcome.kind === "ignored" || outcome.kind === "refund.processed") {
      return NextResponse.json({
        ok: true,
        kind: outcome.kind,
        deduplicated: outcome.kind === "ignored",
      });
    }

    const body = outcome.payload as {
      payload?: { payment?: { entity?: RazorpayPaymentEntity } };
    } | null;
    const entity = body?.payload?.payment?.entity;
    const razorpayOrderId = entity?.order_id;

    if (!razorpayOrderId) {
      return NextResponse.json({ ok: true, kind: "ignored", reason: "no order id on event" });
    }

    const db = getDb();
    const [paymentRow] = await db
      .select()
      .from(payments)
      .where(sql`${payments.providerPayload} ->> 'razorpayOrderId' = ${razorpayOrderId}`)
      .limit(1);

    if (!paymentRow) {
      return NextResponse.json({
        ok: true,
        kind: "ignored",
        reason: "payment not found for order",
      });
    }

    const ctx = webhookCtx();

    if (outcome.kind === "payment.captured") {
      const razorpayPaymentId = outcome.paymentId ?? entity?.id ?? "";
      const { razorpaySettings } = await settingsService.load();
      if (!razorpaySettings?.keySecret) {
        throw new AppError(ErrorCode.STATE_INVALID, "Razorpay is not configured");
      }
      const checksum = computeRazorpayChecksum(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySettings.keySecret,
      );

      await paymentsService.confirmPayment(ctx, {
        paymentId: paymentRow.id,
        amountReceivedMinor: outcome.amountMinor ?? paymentRow.amountDueMinor,
        reference: `${razorpayOrderId}:${razorpayPaymentId}:${checksum}`,
        receivedOn: new Date().toISOString().slice(0, 10),
      });
    } else if (outcome.kind === "payment.failed") {
      await paymentsService.failPayment(ctx, {
        paymentId: paymentRow.id,
        reason: "Razorpay reported payment.failed (webhook)",
        alsoCancelOrder: false,
      });
    }

    return NextResponse.json({ ok: true, kind: outcome.kind });
  } catch (caught) {
    if (caught instanceof AppError) {
      return NextResponse.json(
        { ok: false, error: caught.toActionError() },
        { status: caught.httpStatus },
      );
    }
    const err = caught as { message?: string };
    console.error("Razorpay webhook error:", err);
    return NextResponse.json(
      { ok: false, error: { message: "Internal server error" } },
      { status: 500 },
    );
  }
}

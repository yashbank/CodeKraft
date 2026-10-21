/**
 * Razorpay payment provider (V1.1, D-501, docs/06 §4.3) — TEST MODE ONLY.
 *
 * Gated by the `provider_razorpay` feature flag and by `settings.razorpaySettings` having a
 * `keyId`/`keySecret` configured (see `modules/settings`). No real Razorpay keys ship in this
 * repo; `createIntent` throws `STATE_INVALID` until an admin configures test-mode credentials.
 *
 * `confirm`'s `input.reference` (frozen `ConfirmInput` shape, docs/06 §4.1) carries the three
 * values Razorpay Checkout.js returns to the client on success, packed as
 * `"<razorpay_order_id>:<razorpay_payment_id>:<razorpay_signature>"` — `ConfirmInput` has no
 * dedicated fields for them and the contract is frozen, so this is the chosen wire format for
 * whatever customer-facing "verify payment" endpoint calls `paymentsService.confirmPayment` with
 * a razorpay payment. The admin-UI/checkout agent building next must pack the reference this way.
 */
import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import Razorpay from "razorpay";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { safeEqual } from "@/lib/crypto";
import { getFlag } from "@/lib/feature-flags";
import { settingsService } from "@/modules/settings/service";
import { webhookEvents } from "../../../../drizzle/schema/ops";
import type { RazorpaySettings } from "@/modules/settings/types";
import type {
  ConfirmInput,
  CreateIntentResult,
  Json,
  OrderForPayment,
  PaymentMethodKey,
  PaymentProvider,
  PaymentResult,
  PaymentRow,
  RefundResult,
  WebhookOutcome,
} from "../provider";
import { computeManualConfirmAmounts } from "../provider";

/**
 * Standard Razorpay checkout checksum: `HMAC-SHA256(keySecret, "<order_id>|<payment_id>")`.
 * Exported so the `/api/webhooks/razorpay` route can pack a self-consistent `confirm()`
 * reference for the webhook-driven path (webhook authenticity is already verified via
 * `X-Razorpay-Signature`/`webhookSecret` in `handleWebhook`; this keeps `confirm()` to one
 * code path per docs/06 §4.3 — "Webhook → service.confirm() is the same function admins call" —
 * instead of adding a signature-bypass branch) without duplicating the HMAC call site.
 */
export function computeRazorpayChecksum(
  orderId: string,
  paymentId: string,
  keySecret: string,
): string {
  return createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
}

// -------------------------------------------------------------------------------------------
// Thin client surface — only the Razorpay SDK calls this provider makes. Keeping this narrow
// (rather than typing against the full `Razorpay` class) keeps unit tests free of the real SDK.
// -------------------------------------------------------------------------------------------

export interface RazorpayOrderCreateResult {
  id: string;
  amount: number | string;
  currency: string;
}

export interface RazorpayRefundResult {
  id: string;
  status: string;
}

export interface RazorpayClient {
  orders: {
    create(params: {
      amount: number;
      currency: string;
      receipt?: string;
    }): Promise<RazorpayOrderCreateResult>;
  };
  payments: {
    refund(
      paymentId: string,
      params: { amount?: number; notes?: Record<string, string> },
    ): Promise<RazorpayRefundResult>;
  };
}

export interface RazorpayProviderDeps {
  /** Reads `settings.razorpaySettings` (decrypted). `tx` is omitted for `handleWebhook` (no `ctx`). */
  loadSettings(tx?: TxCtx): Promise<RazorpaySettings | null>;
  isEnabled(): Promise<boolean>;
  createClient(keyId: string, keySecret: string): RazorpayClient;
  /** Inserts into `webhook_events(provider="razorpay", event_id)`; `false` when already recorded. */
  recordWebhookEvent(eventId: string, payload: Json): Promise<boolean>;
}

export const defaultRazorpayDeps: RazorpayProviderDeps = {
  async loadSettings(tx?: TxCtx): Promise<RazorpaySettings | null> {
    const settings = await settingsService.load(tx as DbOrTx | undefined);
    return settings.razorpaySettings;
  },
  async isEnabled(): Promise<boolean> {
    return getFlag("provider_razorpay");
  },
  createClient(keyId: string, keySecret: string): RazorpayClient {
    return new Razorpay({ key_id: keyId, key_secret: keySecret }) as unknown as RazorpayClient;
  },
  async recordWebhookEvent(eventId: string, payload: Json): Promise<boolean> {
    // Lazy import: `@/lib/db` pulls in `@/lib/env`, which throws if evaluated in a browser/jsdom
    // context (matters for this provider's Vitest unit tests; same pattern as
    // `payments/admin-mutations.ts`'s note on `payments/service.ts`).
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    const existing = await db
      .select()
      .from(webhookEvents)
      .where(and(eq(webhookEvents.provider, "razorpay"), eq(webhookEvents.eventId, eventId)))
      .limit(1);
    if (existing.length > 0) return false;
    await db.insert(webhookEvents).values({
      provider: "razorpay",
      eventId,
      payload,
      processedAt: new Date(),
    });
    return true;
  },
};

interface RazorpayWebhookPaymentEntity {
  id?: string;
  amount?: number;
  fee?: number;
}

interface RazorpayWebhookBody {
  id?: string;
  event?: string;
  payload?: { payment?: { entity?: RazorpayWebhookPaymentEntity } };
}

export class RazorpayProvider implements PaymentProvider {
  readonly keys: PaymentMethodKey[] = ["razorpay"];

  constructor(private readonly deps: RazorpayProviderDeps = defaultRazorpayDeps) {}

  private async requireConfig(
    tx?: TxCtx,
  ): Promise<{ keyId: string; keySecret: string; webhookSecret: string | null }> {
    const enabled = await this.deps.isEnabled();
    const settings = await this.deps.loadSettings(tx);
    if (!enabled || !settings?.keyId || !settings?.keySecret) {
      throw new AppError(ErrorCode.STATE_INVALID, "Razorpay is not configured");
    }
    return {
      keyId: settings.keyId,
      keySecret: settings.keySecret,
      webhookSecret: settings.webhookSecret,
    };
  }

  async createIntent(
    ctx: TxCtx,
    order: OrderForPayment,
    method: PaymentMethodKey,
  ): Promise<CreateIntentResult> {
    if (method !== "razorpay") {
      throw new AppError(ErrorCode.STATE_INVALID, `Unsupported Razorpay payment method: ${method}`);
    }

    const { keyId, keySecret } = await this.requireConfig(ctx);
    const client = this.deps.createClient(keyId, keySecret);

    const rpOrder = await client.orders.create({
      amount: order.amountDue.amountMinor,
      currency: order.amountDue.currency,
      receipt: order.orderNo,
    });

    return {
      instructions: {
        method: "razorpay",
        kind: "client_sdk",
        razorpayOrderId: rpOrder.id,
        keyId,
        amount: { amountMinor: order.amountDue.amountMinor, currency: order.amountDue.currency },
        currency: order.amountDue.currency,
        orderNo: order.orderNo,
      },
      providerPayload: {
        razorpayOrderId: rpOrder.id,
        keyId,
      },
    };
  }

  /**
   * `input.reference` is `"<order_id>:<payment_id>:<signature>"` (see module docstring). Verifies
   * the standard Razorpay HMAC-SHA256 checkout signature in constant time before confirming.
   */
  async confirm(ctx: TxCtx, payment: PaymentRow, input: ConfirmInput): Promise<PaymentResult> {
    const { keySecret } = await this.requireConfig(ctx);

    const parts = input.reference.split(":");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      return {
        status: "failed",
        amountReceivedMinor: 0,
        gatewayFeeMinor: 0,
        bankShortfallMinor: payment.amountDueMinor,
        customerCreditMinor: 0,
        reference: input.reference,
        failureReason: "Malformed Razorpay confirmation reference",
      };
    }
    const [razorpayOrderId, razorpayPaymentId, razorpaySignature] = parts as [
      string,
      string,
      string,
    ];

    const expected = computeRazorpayChecksum(razorpayOrderId, razorpayPaymentId, keySecret);

    if (!safeEqual(expected, razorpaySignature)) {
      return {
        status: "failed",
        amountReceivedMinor: 0,
        gatewayFeeMinor: 0,
        bankShortfallMinor: payment.amountDueMinor,
        customerCreditMinor: 0,
        reference: razorpayPaymentId,
        failureReason: "Razorpay signature verification failed",
      };
    }

    const amounts = computeManualConfirmAmounts(payment.amountDueMinor, input.amountReceivedMinor);

    return {
      status: "confirmed",
      amountReceivedMinor: amounts.amountReceivedMinor,
      gatewayFeeMinor: input.gatewayFeeMinor ?? 0,
      bankShortfallMinor: amounts.bankShortfallMinor,
      customerCreditMinor: amounts.customerCreditMinor,
      reference: razorpayPaymentId,
      providerPayload: { razorpayOrderId, razorpayPaymentId },
    };
  }

  async refund(
    ctx: TxCtx,
    payment: PaymentRow,
    amountMinor: number,
    reason: string,
  ): Promise<RefundResult> {
    const { keyId, keySecret } = await this.requireConfig(ctx);
    const client = this.deps.createClient(keyId, keySecret);

    const providerPayload = payment.providerPayload as { razorpayPaymentId?: string } | null;
    const razorpayPaymentId = providerPayload?.razorpayPaymentId;
    if (!razorpayPaymentId) {
      throw new AppError(ErrorCode.STATE_INVALID, "Payment has no Razorpay payment id to refund");
    }

    const result = await client.payments.refund(razorpayPaymentId, {
      amount: amountMinor,
      notes: { reason },
    });

    return {
      status: "processed",
      reference: result.id,
      providerPayload: { razorpayRefundId: result.id, razorpayPaymentId },
    };
  }

  /**
   * Verifies `X-Razorpay-Signature` (HMAC-SHA256 over the raw body with `webhookSecret`) before
   * parsing anything — throws only on a bad/missing signature. Owns `webhook_events` idempotency
   * (the frozen contract gives this method no `tx`, so it reads/writes via its own db access);
   * unrecognized or malformed events return `{ kind: "ignored" }` rather than throwing.
   */
  async handleWebhook(req: Request): Promise<WebhookOutcome> {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const settings = await this.deps.loadSettings();

    if (!settings?.webhookSecret || !signature) {
      throw new AppError(ErrorCode.VALIDATION, "Missing Razorpay webhook signature or secret");
    }

    const expected = createHmac("sha256", settings.webhookSecret).update(rawBody).digest("hex");
    if (!safeEqual(expected, signature)) {
      throw new AppError(ErrorCode.VALIDATION, "Invalid Razorpay webhook signature");
    }

    let payload: Json;
    try {
      payload = JSON.parse(rawBody || "{}") as Json;
    } catch {
      return {
        provider: "razorpay",
        eventId: `malformed-${Date.now()}`,
        kind: "ignored",
        payload: null,
      };
    }

    const body = payload as unknown as RazorpayWebhookBody;
    const paymentEntity = body.payload?.payment?.entity;
    const eventId = body.id ?? `${body.event ?? "unknown"}:${paymentEntity?.id ?? "unknown"}`;

    const isNew = await this.deps.recordWebhookEvent(eventId, payload);
    if (!isNew) {
      return { provider: "razorpay", eventId, kind: "ignored", payload };
    }

    if (body.event === "payment.captured") {
      return {
        provider: "razorpay",
        eventId,
        kind: "payment.captured",
        paymentId: paymentEntity?.id,
        amountMinor: paymentEntity?.amount,
        feeMinor: paymentEntity?.fee,
        payload,
      };
    }

    if (body.event === "payment.failed") {
      return {
        provider: "razorpay",
        eventId,
        kind: "payment.failed",
        paymentId: paymentEntity?.id,
        payload,
      };
    }

    if (body.event === "refund.processed") {
      return {
        provider: "razorpay",
        eventId,
        kind: "refund.processed",
        paymentId: paymentEntity?.id,
        payload,
      };
    }

    return { provider: "razorpay", eventId, kind: "ignored", payload };
  }
}

export const razorpayProvider = new RazorpayProvider();

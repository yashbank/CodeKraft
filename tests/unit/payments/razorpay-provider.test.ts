import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { TxCtx } from "@/lib/db";
import {
  computeRazorpayChecksum,
  RazorpayProvider,
  type RazorpayClient,
  type RazorpayProviderDeps,
} from "@/modules/payments/providers/razorpay";
import type { PaymentRow } from "@/modules/payments/provider";

const KEY_ID = "rzp_test_abc123";
const KEY_SECRET = "test_key_secret";
const WEBHOOK_SECRET = "test_webhook_secret";

const fakeTx = {} as TxCtx;

function fakePayment(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: "pay-1",
    orderId: "ord-1",
    provider: "razorpay",
    status: "initiated",
    amountDueMinor: 50000,
    amountReceivedMinor: null,
    bankShortfallMinor: null,
    amountRefundedMinor: null,
    customerCreditMinor: null,
    currency: "INR",
    instructions: null,
    customerReference: null,
    customerSubmittedAt: null,
    confirmedBy: null,
    confirmedAt: null,
    failureReason: null,
    providerPayload: { razorpayOrderId: "order_abc", keyId: KEY_ID },
    createdAt: new Date(),
    ...overrides,
  } as PaymentRow;
}

function makeDeps(
  overrides: Partial<RazorpayProviderDeps> = {},
  opts: { configured?: boolean; enabled?: boolean } = {},
): RazorpayProviderDeps {
  const configured = opts.configured ?? true;
  const enabled = opts.enabled ?? true;
  const seenEvents = new Set<string>();

  return {
    async loadSettings() {
      if (!configured) return null;
      return {
        mode: "test",
        keyId: KEY_ID,
        keySecret: KEY_SECRET,
        webhookSecret: WEBHOOK_SECRET,
      };
    },
    async isEnabled() {
      return enabled;
    },
    createClient(): RazorpayClient {
      throw new Error("createClient not stubbed for this test");
    },
    async recordWebhookEvent(eventId) {
      if (seenEvents.has(eventId)) return false;
      seenEvents.add(eventId);
      return true;
    },
    ...overrides,
  };
}

function webhookRequest(body: unknown, secret: string): Request {
  const raw = JSON.stringify(body);
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  return new Request("https://example.com/api/webhooks/razorpay", {
    method: "POST",
    headers: { "x-razorpay-signature": signature },
    body: raw,
  });
}

describe("RazorpayProvider", () => {
  describe("createIntent", () => {
    it("throws STATE_INVALID when not configured (flag off or keys missing)", async () => {
      const provider = new RazorpayProvider(makeDeps({}, { enabled: false }));
      await expect(
        provider.createIntent(
          fakeTx,
          {
            orderId: "ord-1",
            orderNo: "CK-ORD-000201",
            amountDue: { amountMinor: 50000, currency: "INR" },
            customer: { name: "Alice", email: "alice@example.com" },
          },
          "razorpay",
        ),
      ).rejects.toThrow("Razorpay is not configured");
    });

    it("throws STATE_INVALID when flag is on but keys are missing", async () => {
      const provider = new RazorpayProvider(makeDeps({}, { configured: false }));
      await expect(
        provider.createIntent(
          fakeTx,
          {
            orderId: "ord-1",
            orderNo: "CK-ORD-000202",
            amountDue: { amountMinor: 50000, currency: "INR" },
            customer: { name: "Alice", email: "alice@example.com" },
          },
          "razorpay",
        ),
      ).rejects.toThrow("Razorpay is not configured");
    });

    it("creates a Razorpay order and returns client_sdk instructions when configured", async () => {
      const create = vi.fn().mockResolvedValue({ id: "order_xyz", amount: 50000, currency: "INR" });
      const provider = new RazorpayProvider(
        makeDeps({
          createClient: () =>
            ({
              orders: { create },
              payments: { refund: vi.fn() },
            }) as unknown as RazorpayClient,
        }),
      );

      const res = await provider.createIntent(
        fakeTx,
        {
          orderId: "ord-1",
          orderNo: "CK-ORD-000203",
          amountDue: { amountMinor: 50000, currency: "INR" },
          customer: { name: "Alice", email: "alice@example.com" },
        },
        "razorpay",
      );

      expect(create).toHaveBeenCalledWith({
        amount: 50000,
        currency: "INR",
        receipt: "CK-ORD-000203",
      });
      expect(res.instructions.method).toBe("razorpay");
      if (res.instructions.method === "razorpay") {
        expect(res.instructions.razorpayOrderId).toBe("order_xyz");
        expect(res.instructions.keyId).toBe(KEY_ID);
      }
      expect(res.providerPayload).toMatchObject({ razorpayOrderId: "order_xyz", keyId: KEY_ID });
    });
  });

  describe("confirm", () => {
    it("confirms when the checkout signature is valid", async () => {
      const provider = new RazorpayProvider(makeDeps());
      const payment = fakePayment();
      const checksum = computeRazorpayChecksum("order_abc", "pay_abc", KEY_SECRET);

      const res = await provider.confirm(fakeTx, payment, {
        amountReceivedMinor: 50000,
        reference: `order_abc:pay_abc:${checksum}`,
        receivedOn: "2026-10-21",
        actorId: "webhook",
      });

      expect(res.status).toBe("confirmed");
      expect(res.amountReceivedMinor).toBe(50000);
      expect(res.bankShortfallMinor).toBe(0);
      expect(res.customerCreditMinor).toBe(0);
      expect(res.reference).toBe("pay_abc");
    });

    it("fails when the checkout signature is invalid", async () => {
      const provider = new RazorpayProvider(makeDeps());
      const payment = fakePayment();

      const res = await provider.confirm(fakeTx, payment, {
        amountReceivedMinor: 50000,
        reference: "order_abc:pay_abc:not-the-real-signature",
        receivedOn: "2026-10-21",
        actorId: "webhook",
      });

      expect(res.status).toBe("failed");
      expect(res.failureReason).toMatch(/signature/i);
    });

    it("fails on a malformed reference instead of throwing", async () => {
      const provider = new RazorpayProvider(makeDeps());
      const payment = fakePayment();

      const res = await provider.confirm(fakeTx, payment, {
        amountReceivedMinor: 50000,
        reference: "not-packed-correctly",
        receivedOn: "2026-10-21",
        actorId: "webhook",
      });

      expect(res.status).toBe("failed");
      expect(res.failureReason).toMatch(/malformed/i);
    });
  });

  describe("refund", () => {
    it("calls the Razorpay refund API and returns status processed", async () => {
      const refund = vi.fn().mockResolvedValue({ id: "rfnd_1", status: "processed" });
      const provider = new RazorpayProvider(
        makeDeps({
          createClient: () =>
            ({
              orders: { create: vi.fn() },
              payments: { refund },
            }) as unknown as RazorpayClient,
        }),
      );

      const payment = fakePayment({ providerPayload: { razorpayPaymentId: "pay_abc" } });
      const res = await provider.refund(fakeTx, payment, 10000, "customer requested");

      expect(refund).toHaveBeenCalledWith("pay_abc", {
        amount: 10000,
        notes: { reason: "customer requested" },
      });
      expect(res.status).toBe("processed");
      expect(res.reference).toBe("rfnd_1");
    });
  });

  describe("handleWebhook", () => {
    it("throws on an invalid signature", async () => {
      const provider = new RazorpayProvider(makeDeps());
      const req = new Request("https://example.com/api/webhooks/razorpay", {
        method: "POST",
        headers: { "x-razorpay-signature": "deadbeef" },
        body: JSON.stringify({ id: "evt_1", event: "payment.captured" }),
      });

      await expect(provider.handleWebhook(req)).rejects.toThrow(/signature/i);
    });

    it("throws when there is no secret/signature configured", async () => {
      const provider = new RazorpayProvider(makeDeps({ loadSettings: async () => null }));
      const req = new Request("https://example.com/api/webhooks/razorpay", {
        method: "POST",
        body: JSON.stringify({ id: "evt_1", event: "payment.captured" }),
      });

      await expect(provider.handleWebhook(req)).rejects.toThrow();
    });

    it("maps payment.captured to a confirmed outcome", async () => {
      const provider = new RazorpayProvider(makeDeps());
      const body = {
        id: "evt_captured_1",
        event: "payment.captured",
        payload: {
          payment: { entity: { id: "pay_abc", order_id: "order_abc", amount: 50000, fee: 100 } },
        },
      };
      const outcome = await provider.handleWebhook(webhookRequest(body, WEBHOOK_SECRET));

      expect(outcome.kind).toBe("payment.captured");
      expect(outcome.eventId).toBe("evt_captured_1");
      expect(outcome.paymentId).toBe("pay_abc");
      expect(outcome.amountMinor).toBe(50000);
      expect(outcome.feeMinor).toBe(100);
    });

    it("maps payment.failed to a failed outcome", async () => {
      const provider = new RazorpayProvider(makeDeps());
      const body = {
        id: "evt_failed_1",
        event: "payment.failed",
        payload: { payment: { entity: { id: "pay_xyz", order_id: "order_xyz" } } },
      };
      const outcome = await provider.handleWebhook(webhookRequest(body, WEBHOOK_SECRET));

      expect(outcome.kind).toBe("payment.failed");
      expect(outcome.paymentId).toBe("pay_xyz");
    });

    it("returns ignored for an unrecognized event type instead of throwing", async () => {
      const provider = new RazorpayProvider(makeDeps());
      const body = { id: "evt_unknown_1", event: "order.paid" };
      const outcome = await provider.handleWebhook(webhookRequest(body, WEBHOOK_SECRET));

      expect(outcome.kind).toBe("ignored");
    });

    it("is idempotent: the same event id twice is a no-op the second time", async () => {
      const deps = makeDeps();
      const provider = new RazorpayProvider(deps);
      const body = {
        id: "evt_dup_1",
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_dup", order_id: "order_dup", amount: 1000 } } },
      };

      const first = await provider.handleWebhook(webhookRequest(body, WEBHOOK_SECRET));
      expect(first.kind).toBe("payment.captured");

      const second = await provider.handleWebhook(webhookRequest(body, WEBHOOK_SECRET));
      expect(second.kind).toBe("ignored");
    });
  });
});

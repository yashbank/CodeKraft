import { describe, expect, it } from "vitest";
import { confirmPaymentInput, submitPaymentReferenceInput } from "@/modules/payments/types";

describe("Payment input validation unit tests", () => {
  it("validates payment reference string length 6..140", () => {
    const validUuid = "11111111-1111-4111-8111-111111111111";
    expect(() =>
      submitPaymentReferenceInput.parse({ paymentId: validUuid, reference: "short" }),
    ).toThrow();
    expect(
      submitPaymentReferenceInput.parse({ paymentId: validUuid, reference: "123456" }),
    ).toEqual({ paymentId: validUuid, reference: "123456" });

    // Upper bound is 140, not 64: wide enough for the packed Razorpay Checkout.js reference
    // ("<order_id>:<payment_id>:<signature>", up to ~110 chars — see `providers/razorpay.ts`'s
    // module docstring and `PaymentInstructionsPanel.tsx`'s `handleRazorpaySuccess`).
    const razorpayStyleRef = `order_${"a".repeat(14)}:pay_${"b".repeat(14)}:${"c".repeat(64)}`;
    expect(razorpayStyleRef.length).toBeLessThanOrEqual(140);
    expect(
      submitPaymentReferenceInput.parse({ paymentId: validUuid, reference: razorpayStyleRef }),
    ).toEqual({ paymentId: validUuid, reference: razorpayStyleRef });

    const longRef = "a".repeat(141);
    expect(() =>
      submitPaymentReferenceInput.parse({ paymentId: validUuid, reference: longRef }),
    ).toThrow();
  });

  it("validates confirm payment input requires non-negative amountReceivedMinor and valid date", () => {
    const validUuid = "11111111-1111-4111-8111-111111111111";
    expect(() =>
      confirmPaymentInput.parse({
        paymentId: validUuid,
        amountReceivedMinor: -100,
        reference: "UTR12345678",
        receivedOn: "2026-09-26",
      }),
    ).toThrow();

    const parsed = confirmPaymentInput.parse({
      paymentId: validUuid,
      amountReceivedMinor: 50000,
      reference: "UTR12345678",
      receivedOn: "2026-09-26",
    });
    expect(parsed.amountReceivedMinor).toBe(50000);
  });
});

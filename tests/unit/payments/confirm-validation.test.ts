import { describe, expect, it } from "vitest";
import { confirmPaymentInput, submitPaymentReferenceInput } from "@/modules/payments/types";

describe("Payment input validation unit tests", () => {
  it("validates payment reference string length 6..64", () => {
    const validUuid = "11111111-1111-4111-8111-111111111111";
    expect(() => submitPaymentReferenceInput.parse({ paymentId: validUuid, reference: "short" })).toThrow();
    expect(
      submitPaymentReferenceInput.parse({ paymentId: validUuid, reference: "123456" }),
    ).toEqual({ paymentId: validUuid, reference: "123456" });

    const longRef = "a".repeat(65);
    expect(() => submitPaymentReferenceInput.parse({ paymentId: validUuid, reference: longRef })).toThrow();
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


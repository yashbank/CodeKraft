import { describe, expect, it } from "vitest";
import { confirmPaymentInput } from "@/modules/payments/types";

const base = {
  paymentId: "11111111-1111-4111-8111-111111111111",
  amountReceivedMinor: 1000,
  reference: "UTR123",
  receivedOn: "2026-10-01",
};
const orderItemId = "22222222-2222-4222-8222-222222222222";

describe("confirmPaymentInput licenseKeys", () => {
  it("is optional", () => {
    expect(confirmPaymentInput.parse(base).licenseKeys).toBeUndefined();
  });
  it("accepts and trims a key", () => {
    const r = confirmPaymentInput.parse({
      ...base,
      licenseKeys: [{ orderItemId, licenseKey: "  CK-AAAA-BBBB  " }],
    });
    expect(r.licenseKeys?.[0]?.licenseKey).toBe("CK-AAAA-BBBB");
  });
  it("rejects a too-short key", () => {
    expect(() =>
      confirmPaymentInput.parse({ ...base, licenseKeys: [{ orderItemId, licenseKey: "abc" }] }),
    ).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { ManualProvider } from "@/modules/payments/providers/manual";
import type { TxCtx } from "@/lib/db";

describe("UPI URI formatting unit tests", () => {
  const fakeTx = {} as TxCtx;

  it("encodes correct payee address, payee name, amount in 2 decimal places, and order number in note", async () => {
    const provider = new ManualProvider({
      getUpiVpa: async () => "payments@bank",
      getBankDetails: async () => null,
      getBaseCurrency: async () => "INR",
      renderQr: async () => "dummy-qr",
    });

    const res = await provider.createIntent(
      fakeTx,
      {
        orderId: "ord-test",
        orderNo: "CK-ORD-000456",
        amountDue: { amountMinor: 123456, currency: "INR" },
        customer: { name: "Test User", email: "test@example.com" },
      },
      "manual_upi",
    );

    if (res.instructions.method === "manual_upi") {
      const uri = res.instructions.upiUri;
      expect(uri).toContain("pa=payments@bank");
      expect(uri).toContain("pn=CodeKraft");
      expect(uri).toContain("am=1234.56");
      expect(uri).toContain("cu=INR");
      expect(uri).toContain("tn=CK-ORD-000456");
    } else {
      expect.fail("Expected manual_upi instructions");
    }
  });
});

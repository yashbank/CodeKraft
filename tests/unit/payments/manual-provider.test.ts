import { describe, expect, it } from "vitest";
import { ManualProvider } from "@/modules/payments/providers/manual";
import type { TxCtx } from "@/lib/db";

describe("ManualProvider unit tests", () => {
  const fakeTx = {} as TxCtx;

  it("registers manual_upi and manual_bank keys", () => {
    const provider = new ManualProvider();
    expect(provider.keys).toEqual(["manual_upi", "manual_bank"]);
  });

  it("creates UPI intent with formatted UPI URI", async () => {
    const provider = new ManualProvider({
      getUpiVpa: async () => "testpay@upi",
      getBankDetails: async () => null,
      getBaseCurrency: async () => "INR",
      renderQr: async (uri) => `data:image/svg+xml;test,${uri}`,
    });

    const res = await provider.createIntent(
      fakeTx,
      {
        orderId: "ord-1",
        orderNo: "CK-ORD-000101",
        amountDue: { amountMinor: 50000, currency: "INR" },
        customer: { name: "Alice", email: "alice@example.com" },
      },
      "manual_upi",
    );

    expect(res.instructions.method).toBe("manual_upi");
    if (res.instructions.method === "manual_upi") {
      expect(res.instructions.vpa).toBe("testpay@upi");
      expect(res.instructions.upiUri).toBe(
        "upi://pay?pa=testpay@upi&pn=CodeKraft&am=500.00&cu=INR&tn=CK-ORD-000101",
      );
      expect(res.instructions.qrDataUrl).toContain("data:image/svg+xml");
    }
  });

  it("throws when UPI intent requested for non-INR currency", async () => {
    const provider = new ManualProvider();
    await expect(
      provider.createIntent(
        fakeTx,
        {
          orderId: "ord-2",
          orderNo: "CK-ORD-000102",
          amountDue: { amountMinor: 5000, currency: "USD" },
          customer: { name: "Bob", email: "bob@example.com" },
        },
        "manual_upi",
      ),
    ).rejects.toThrow("UPI is only available for INR payments");
  });

  it("creates bank transfer intent with bank details and orderNo reference", async () => {
    const provider = new ManualProvider({
      getUpiVpa: async () => null,
      getBankDetails: async () => ({
        accountName: "CodeKraft Bank",
        accountNo: "9876543210",
        ifsc: "ICIC0001111",
        bankName: "ICICI Bank",
        branch: "Indiranagar",
        swift: "ICICINBB",
      }),
      getBaseCurrency: async () => "INR",
      renderQr: async () => "",
    });

    const res = await provider.createIntent(
      fakeTx,
      {
        orderId: "ord-3",
        orderNo: "CK-ORD-000103",
        amountDue: { amountMinor: 100000, currency: "INR" },
        customer: { name: "Charlie", email: "charlie@example.com" },
      },
      "manual_bank",
    );

    expect(res.instructions.method).toBe("manual_bank");
    if (res.instructions.method === "manual_bank") {
      expect(res.instructions.accountNo).toBe("9876543210");
      expect(res.instructions.reference).toBe("CK-ORD-000103");
      expect(res.instructions.bankName).toBe("ICICI Bank");
    }
  });
});

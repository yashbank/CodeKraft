import { describe, expect, it } from "vitest";
import {
  BANK_NOT_CONFIGURED_MESSAGE,
  ManualProvider,
  UPI_NOT_CONFIGURED_MESSAGE,
} from "@/modules/payments/providers/manual";
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
      getUpiQrImage: async () => "data:image/png;base64,AAAA",
      getUpiPayeeName: async () => "CodeKraft",
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
      // The admin-uploaded image, verbatim — never a generated placeholder (R8-01).
      expect(res.instructions.qrDataUrl).toBe("data:image/png;base64,AAAA");
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
      getUpiQrImage: async () => null,
      getUpiPayeeName: async () => "CodeKraft",
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

  // R8-01: unconfigured settings must never fall back to placeholder payee details.
  const unconfigured = new ManualProvider({
    getUpiVpa: async () => null,
    getBankDetails: async () => null,
    getBaseCurrency: async () => "INR",
    getUpiQrImage: async () => null,
    getUpiPayeeName: async () => "CodeKraft",
  });
  const inrOrder = {
    orderId: "ord-9",
    orderNo: "CK-ORD-000109",
    amountDue: { amountMinor: 1000, currency: "INR" as const },
    customer: { name: "Dee", email: "dee@example.com" },
  };

  it("refuses UPI with a customer-facing message when no VPA is configured", async () => {
    await expect(unconfigured.createIntent(fakeTx, inrOrder, "manual_upi")).rejects.toThrow(
      UPI_NOT_CONFIGURED_MESSAGE,
    );
  });

  it("refuses bank transfer when no bank details are configured", async () => {
    await expect(unconfigured.createIntent(fakeTx, inrOrder, "manual_bank")).rejects.toThrow(
      BANK_NOT_CONFIGURED_MESSAGE,
    );
  });

  it("returns qrDataUrl null (no fake QR) when no QR image is uploaded", async () => {
    const p = new ManualProvider({
      getUpiVpa: async () => "shop@okhdfc",
      getBankDetails: async () => null,
      getBaseCurrency: async () => "INR",
      getUpiQrImage: async () => null,
      getUpiPayeeName: async () => "Acme Studio",
    });
    const res = await p.createIntent(fakeTx, inrOrder, "manual_upi");
    expect(res.instructions).toMatchObject({ vpa: "shop@okhdfc", qrDataUrl: null });
    expect(JSON.stringify(res)).not.toMatch(/codekraft@upi|1234567890|HDFC0001234/);
  });
});

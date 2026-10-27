import { describe, expect, it } from "vitest";
import { manualMethodAvailability, withLiveManualDetails } from "@/modules/payments/availability";
import type { PaymentInstructions } from "@/modules/payments/provider";
import { toCheckoutPaymentProviders, unconfiguredManualMethods } from "@/lib/account/checkout-view";

const bank = {
  accountName: "Acme Studio LLP",
  accountNumber: "50200012345678",
  ifsc: "HDFC0000123",
  bankName: "HDFC Bank",
};
const base = {
  upiVpa: null,
  upiPayeeName: null,
  upiQrImage: null,
  bankDetails: null,
  sellerDetails: null,
  siteName: "CodeKraft",
};

describe("R8-01 manual payment availability", () => {
  it("only marks methods available once their details are configured", () => {
    expect(manualMethodAvailability(base)).toEqual({ manual_upi: false, manual_bank: false });
    expect(manualMethodAvailability({ upiVpa: "shop@okhdfc", bankDetails: bank })).toEqual({
      manual_upi: true,
      manual_bank: true,
    });
  });

  it("checkout hides unconfigured manual methods and reports them", () => {
    const avail = { manual_upi: false, manual_bank: true };
    expect(toCheckoutPaymentProviders(["manual_upi", "manual_bank"], false, avail)).toEqual([
      "manual_bank",
    ]);
    expect(unconfiguredManualMethods(["manual_upi", "manual_bank"], avail)).toEqual(["manual_upi"]);
  });

  const staleUpi: PaymentInstructions = {
    method: "manual_upi",
    vpa: "codekraft@upi",
    payeeName: "CodeKraft",
    amount: { amountMinor: 299900, currency: "INR" },
    note: "CK-ORD-000042",
    upiUri: "upi://pay?pa=codekraft@upi",
    qrDataUrl: "data:image/svg+xml;utf8,<svg>UPI QR</svg>",
  };

  it("replaces stale/placeholder UPI details on open payments with the current settings", () => {
    const live = withLiveManualDetails(staleUpi, {
      ...base,
      upiVpa: "shop@okhdfc",
      upiPayeeName: "Acme Studio",
      upiQrImage: "data:image/png;base64,QUJD",
    });
    expect(live).toMatchObject({
      vpa: "shop@okhdfc",
      payeeName: "Acme Studio",
      qrDataUrl: "data:image/png;base64,QUJD",
      upiUri: "upi://pay?pa=shop@okhdfc&pn=Acme%20Studio&am=2999.00&cu=INR&tn=CK-ORD-000042",
    });
  });

  it("flags instructions unconfigured instead of showing placeholders", () => {
    const live = withLiveManualDetails(staleUpi, base);
    expect(live).toMatchObject({ unconfigured: true, vpa: "", qrDataUrl: null });
    const bankLive = withLiveManualDetails(
      {
        method: "manual_bank",
        accountName: "CodeKraft Inc.",
        accountNo: "1234567890",
        ifsc: "HDFC0001234",
        bankName: "HDFC Bank",
        amount: { amountMinor: 100, currency: "INR" },
        reference: "CK-ORD-1",
      },
      base,
    );
    expect(bankLive).toMatchObject({ unconfigured: true, accountNo: "" });
    expect(
      withLiveManualDetails(bankLive && { ...bankLive, unconfigured: undefined }, {
        ...base,
        bankDetails: bank,
      }),
    ).toMatchObject({ accountNo: "50200012345678", ifsc: "HDFC0000123" });
  });
});

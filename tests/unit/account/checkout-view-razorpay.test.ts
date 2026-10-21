import { describe, expect, it } from "vitest";
import { toCheckoutPaymentProviders, toManualPaymentProviders } from "@/lib/account/checkout-view";

describe("toCheckoutPaymentProviders (V1.1 Razorpay checkout gate, D-501, TEST MODE ONLY)", () => {
  it("never includes razorpay when it's not in the offering's enabled methods", () => {
    expect(toCheckoutPaymentProviders(["manual_upi", "manual_bank"], true)).toEqual([
      "manual_upi",
      "manual_bank",
    ]);
  });

  it("drops razorpay when the offering allows it but razorpayAvailable is false (flag off or keys unset)", () => {
    expect(toCheckoutPaymentProviders(["manual_upi", "razorpay"], false)).toEqual(["manual_upi"]);
  });

  it("includes razorpay only when both the offering allows it AND razorpayAvailable is true", () => {
    expect(toCheckoutPaymentProviders(["manual_upi", "manual_bank", "razorpay"], true)).toEqual([
      "manual_upi",
      "manual_bank",
      "razorpay",
    ]);
  });

  it("never admits stripe/paypal regardless of razorpayAvailable (not shipped)", () => {
    expect(toCheckoutPaymentProviders(["stripe", "paypal", "razorpay"], true)).toEqual([
      "razorpay",
    ]);
  });
});

describe("toManualPaymentProviders (order-detail-view's re-show path, untouched by V1.1)", () => {
  it("always excludes razorpay, even when razorpay-shaped data is present", () => {
    expect(toManualPaymentProviders(["manual_upi", "razorpay"])).toEqual(["manual_upi"]);
  });
});

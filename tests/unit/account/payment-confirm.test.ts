import { describe, expect, it } from "vitest";
import {
  checkoutFallback,
  confirmStage,
  nextStep,
  toConfirmStatus,
} from "@/lib/account/payment-confirm";

describe("payment confirm logic (R9-06)", () => {
  it("never 404s or dead-ends when a submitted/paid order exists", () => {
    for (const code of ["NOT_FOUND", "DUPLICATE_PURCHASE", "VALIDATION"])
      expect(checkoutFallback(code, "CK-ORD-000007")).toEqual({
        redirect: "/checkout/confirming/CK-ORD-000007",
      });
  });
  it("keeps old behaviour with no order", () => {
    expect(checkoutFallback("NOT_FOUND", null)).toBe("notFound");
    expect(checkoutFallback("DUPLICATE_PURCHASE", null)).toBe("duplicate");
    expect(checkoutFallback("X", null)).toBe("unavailable");
  });
  it("maps stages", () => {
    expect(confirmStage("pending_payment", "submitted")).toBe("pending");
    expect(confirmStage("paid", "confirmed")).toBe("paid");
    expect(confirmStage("pending_payment", "confirmed")).toBe("paid");
    expect(confirmStage("cancelled")).toBe("failed");
    expect(confirmStage("pending_payment", "failed")).toBe("failed");
  });
  it("picks next step per product type", () => {
    expect(nextStep({ deliveryType: "download", entitlementId: "e1" })).toEqual({
      label: "Download",
      href: "/account/purchases/e1",
    });
    expect(nextStep({ deliveryType: "license", entitlementId: "e1" }).label).toBe(
      "Reveal licence key",
    );
    expect(nextStep({ deliveryType: "saas", entitlementId: null })).toEqual({
      label: "View delivery steps",
      href: "/account/purchases",
    });
  });
  it("maps an order detail", () => {
    expect(
      toConfirmStatus({
        order: { orderNo: "A", status: "paid" },
        payments: [{ status: "confirmed" }],
        entitlements: [{ entitlementId: "e", deliveryType: "license" }],
      }),
    ).toEqual({ stage: "paid", orderNo: "A", deliveryType: "license", entitlementId: "e" });
  });
});

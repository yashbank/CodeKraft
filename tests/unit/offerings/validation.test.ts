import { describe, expect, it } from "vitest";
import {
  upsertOfferingSchema,
  setOfferingPricesSchema,
  setOfferingPaymentMethodsSchema,
} from "@/modules/offerings/contracts";

describe("offerings schema validation (API-CAT-03..05, PHASE-03 P3.7)", () => {
  const validOfferingBase = {
    productId: "11111111-1111-4111-8111-111111111111",
    name: "Standard License",
    slug: "standard-license",
    position: 0,
    isDefault: true,
    purchaseModel: "one_time" as const,
    deliveryType: "download" as const,
    deliveryConfig: {
      provisioning: "manual" as const,
      updatePolicy: "all_free" as const,
    },
    status: "active" as const,
  };

  it("accepts valid one-time offering input", () => {
    const parsed = upsertOfferingSchema.safeParse(validOfferingBase);
    expect(parsed.success).toBe(true);
  });

  it("requires billingInterval for subscription purchase model", () => {
    const invalidSub = {
      ...validOfferingBase,
      purchaseModel: "subscription" as const,
    };
    const parsed = upsertOfferingSchema.safeParse(invalidSub);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/billingInterval/i);
    }

    const validSub = {
      ...validOfferingBase,
      purchaseModel: "subscription" as const,
      billingInterval: "monthly" as const,
    };
    expect(upsertOfferingSchema.safeParse(validSub).success).toBe(true);
  });

  it("requires at least one service step for service delivery type", () => {
    const invalidService = {
      ...validOfferingBase,
      deliveryType: "service" as const,
      serviceSteps: [],
    };
    const parsed = upsertOfferingSchema.safeParse(invalidService);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/at least one step/i);
    }

    const validService = {
      ...validOfferingBase,
      deliveryType: "service" as const,
      serviceSteps: [{ key: "kickoff", title: "Kickoff Call" }],
    };
    expect(upsertOfferingSchema.safeParse(validService).success).toBe(true);
  });

  it("validates compareAtMinor strictly exceeds amountMinor in prices", () => {
    const invalidPrice = {
      offeringId: "22222222-2222-4222-8222-222222222222",
      prices: [{ currency: "INR" as const, amountMinor: 50000, compareAtMinor: 50000 }],
    };
    const parsed = setOfferingPricesSchema.safeParse(invalidPrice);
    expect(parsed.success).toBe(false);

    const validPrice = {
      offeringId: "22222222-2222-4222-8222-222222222222",
      prices: [{ currency: "INR" as const, amountMinor: 50000, compareAtMinor: 60000 }],
    };
    expect(setOfferingPricesSchema.safeParse(validPrice).success).toBe(true);
  });

  it("disallows duplicate currencies in setOfferingPrices", () => {
    const dupPrices = {
      offeringId: "22222222-2222-4222-8222-222222222222",
      prices: [
        { currency: "INR" as const, amountMinor: 50000 },
        { currency: "INR" as const, amountMinor: 60000 },
      ],
    };
    const parsed = setOfferingPricesSchema.safeParse(dupPrices);
    expect(parsed.success).toBe(false);
  });

  it("validates payment methods list and disallows duplicates", () => {
    const validMethods = {
      offeringId: "22222222-2222-4222-8222-222222222222",
      methods: ["manual_upi" as const, "razorpay" as const],
    };
    expect(setOfferingPaymentMethodsSchema.safeParse(validMethods).success).toBe(true);

    const dupMethods = {
      offeringId: "22222222-2222-4222-8222-222222222222",
      methods: ["manual_upi" as const, "manual_upi" as const],
    };
    expect(setOfferingPaymentMethodsSchema.safeParse(dupMethods).success).toBe(false);
  });
});

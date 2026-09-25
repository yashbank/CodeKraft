import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { offeringsService } from "@/modules/offerings/service";
import { AppError, ErrorCode } from "@/lib/errors";
import { createAdmin } from "../../factories/users";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("offering payment methods flag gating (API-CAT-05, FR-PAY-02, PHASE-03 P3.7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("permits manual payment methods unconditionally and gates gateway methods behind flags", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-methods-gate" },
      roles: ["admin"],
    });

    const prodRes = await catalogService.createProduct(adminCtx, {
      name: "Gateway Gating Product",
      slug: "gateway-gating-product",
      shortDescription: "Testing gateway payment flags",
    });

    const off = await offeringsService.upsertOffering(adminCtx, {
      productId: prodRes.productId,
      name: "Payment Gated Offering",
      slug: "payment-gated-offering",
      position: 0,
      isDefault: true,
      purchaseModel: "one_time",
      deliveryType: "download",
      deliveryConfig: {
        provisioning: "manual",
        updatePolicy: "all_free",
      },
      status: "active",
    });

    // 1. Manual methods always succeed without any flag
    const manualRes = await offeringsService.setOfferingPaymentMethods(adminCtx, {
      offeringId: off.offering.id,
      methods: ["manual_upi", "manual_bank"],
    });
    expect(manualRes.methods).toEqual(["manual_upi", "manual_bank"]);

    // 2. Setting razorpay when flag is disabled fails with STATE_INVALID
    const originalEnv = process.env.FEATURE_PROVIDER_RAZORPAY;
    delete process.env.FEATURE_PROVIDER_RAZORPAY;

    try {
      await offeringsService.setOfferingPaymentMethods(adminCtx, {
        offeringId: off.offering.id,
        methods: ["razorpay"],
      });
      expect.fail("Should have failed when provider_razorpay is off");
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(ErrorCode.STATE_INVALID);
      expect(err.message).toMatch(/razorpay is disabled/i);
    }

    // 3. Enabling flag allows razorpay
    process.env.FEATURE_PROVIDER_RAZORPAY = "true";
    try {
      const razorpayRes = await offeringsService.setOfferingPaymentMethods(adminCtx, {
        offeringId: off.offering.id,
        methods: ["manual_upi", "razorpay"],
      });
      expect(razorpayRes.methods).toContain("razorpay");
    } finally {
      if (originalEnv !== undefined) {
        process.env.FEATURE_PROVIDER_RAZORPAY = originalEnv;
      } else {
        delete process.env.FEATURE_PROVIDER_RAZORPAY;
      }
    }
  });
});

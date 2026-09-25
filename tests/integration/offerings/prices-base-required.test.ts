import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { offeringsService } from "@/modules/offerings/service";
import { AppError, ErrorCode } from "@/lib/errors";
import { createAdmin } from "../../factories/users";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { withTx } from "@/lib/db";

describe("offering prices & base currency requirement (API-CAT-04, FR-CAT-08, PHASE-03 P3.7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("requires base INR price row and checks publish readiness", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-prices-base" },
      roles: ["admin"],
    });

    const prodRes = await catalogService.createProduct(adminCtx, {
      name: "Price Base Test Product",
      slug: "price-base-test-product",
      shortDescription: "Testing base currency requirements",
    });

    const off = await offeringsService.upsertOffering(adminCtx, {
      productId: prodRes.productId,
      name: "Standard License",
      slug: "standard-license",
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

    // 1. Trying to set prices with only USD (no INR base) must fail with VALIDATION
    await expect(
      offeringsService.setOfferingPrices(adminCtx, {
        offeringId: off.offering.id,
        prices: [{ currency: "USD", amountMinor: 4900 }],
      }),
    ).rejects.toThrow(AppError);

    try {
      await offeringsService.setOfferingPrices(adminCtx, {
        offeringId: off.offering.id,
        prices: [{ currency: "USD", amountMinor: 4900 }],
      });
    } catch (err: any) {
      expect(err.code).toBe(ErrorCode.VALIDATION);
      expect(err.message).toMatch(/base-currency \(INR\)/i);
    }

    // 2. Setting prices with INR base row succeeds
    const setRes = await offeringsService.setOfferingPrices(adminCtx, {
      offeringId: off.offering.id,
      prices: [
        { currency: "INR", amountMinor: 399900, compareAtMinor: 499900 },
        { currency: "USD", amountMinor: 4900 },
      ],
    });
    expect(setRes.prices.length).toBe(2);

    // 3. Check isPublishReady: has price but NO payment methods yet -> false
    const readyBeforeMethods = await withTx((tx) =>
      offeringsService.isPublishReady(prodRes.productId, tx),
    );
    expect(readyBeforeMethods).toBe(false);

    // 4. Set payment methods
    await offeringsService.setOfferingPaymentMethods(adminCtx, {
      offeringId: off.offering.id,
      methods: ["manual_upi"],
    });

    // 5. Now isPublishReady should be true
    const readyAfterMethods = await withTx((tx) =>
      offeringsService.isPublishReady(prodRes.productId, tx),
    );
    expect(readyAfterMethods).toBe(true);
  });
});

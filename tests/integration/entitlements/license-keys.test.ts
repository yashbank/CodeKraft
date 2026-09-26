import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { entitlementsService } from "@/modules/entitlements/service";
import { deliveryService } from "@/modules/delivery/service";
import { entitlements } from "../../../drizzle/schema/delivery";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createEntitlement } from "../../factories/delivery";
import { buildContext } from "@/lib/authz/context";

describe("License Keys Delivery & Audited Reveal (API-DEL-03, API-DEL-08, SA-14)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("stores key encrypted at rest and reveals plaintext securely to buyer", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const product = await createProduct({ createdBy: admin.id });
    const offering = await createOffering({
      productId: product.id,
      deliveryType: "license",
    });
    const buyer = await createUser({ emailVerified: true });

    const ent = await createEntitlement({
      offering,
      userId: buyer.id,
      deliveryType: "license",
      status: "active",
      provisioningState: "pending",
    });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    const plainKey = "CK-LIC-ENTERPRISE-9876543210-PRO";

    // 1. Admin sets license key
    await deliveryService.setLicenseKey(adminCtx, {
      entitlementId: ent.id,
      licenseKey: plainKey,
      notifyEmail: true,
    });

    // Verify encrypted at rest (not stored as plaintext)
    const [row] = await db.select().from(entitlements).where(eq(entitlements.id, ent.id));
    expect(row?.licenseKeyEnc).toBeDefined();
    expect(row?.licenseKeyEnc).not.toBe(plainKey);
    expect(row?.licenseKeyEnc).toMatch(/^v1:/);
    expect(row?.provisioningState).toBe("done");

    // 2. Buyer reveals key
    const buyerCtx = buildContext({
      user: { id: buyer.id },
      session: { id: "sess-buyer" },
      roles: ["customer"],
    });

    const revealRes = await entitlementsService.revealLicenseKey(buyerCtx, {
      entitlementId: ent.id,
    });

    expect(revealRes.licenseKey).toBe(plainKey);
  });
});

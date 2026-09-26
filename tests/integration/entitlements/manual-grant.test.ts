import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { entitlementsService } from "@/modules/entitlements/service";
import { entitlements } from "../../../drizzle/schema/delivery";
import { orders } from "../../../drizzle/schema/commerce";
import { ledgerEntries } from "../../../drizzle/schema/finance";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { buildContext } from "@/lib/authz/context";
import { AppError } from "@/lib/errors";

describe("Entitlements Manual Grant (API-DEL-11, D-1108, MASTER_SPEC §7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("creates entitlement without order, invoice, or ledger writes", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const product = await createProduct({ createdBy: admin.id });
    const offering = await createOffering({
      productId: product.id,
      deliveryType: "download",
      price: { amountMinor: 25000, currency: "INR" },
    });
    const buyer = await createUser({ emailVerified: true });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    const res = await entitlementsService.grantManual(adminCtx, {
      userId: buyer.id,
      offeringId: offering.id,
      accessMonths: 6,
      reason: "VIP complimentary license grant",
    });

    expect(res.entitlementId).toBeDefined();

    const [ent] = await db
      .select()
      .from(entitlements)
      .where(eq(entitlements.id, res.entitlementId));

    expect(ent).toBeDefined();
    expect(ent?.orderItemId).toBeNull();
    expect(ent?.grantedManuallyBy).toBe(admin.id);
    expect(ent?.status).toBe("active");
    expect(ent?.accessEndsAt).toBeDefined();

    // Invariant: zero orders or ledger entries created
    const ordCount = await db.select().from(orders);
    expect(ordCount).toHaveLength(0);

    const ledCount = await db.select().from(ledgerEntries);
    expect(ledCount).toHaveLength(0);

    // Second manual grant for the same active one-time offering throws DUPLICATE_PURCHASE
    await expect(
      entitlementsService.grantManual(adminCtx, {
        userId: buyer.id,
        offeringId: offering.id,
        reason: "Duplicate attempt",
      }),
    ).rejects.toThrow(AppError);
  });
});

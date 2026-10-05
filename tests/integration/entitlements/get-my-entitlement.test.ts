import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { getMyEntitlementQuery } from "@/modules/entitlements/queries";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createEntitlement } from "../../factories/delivery";

function ctxFor(userId: string) {
  return buildContext({ user: { id: userId }, session: { id: `sess-${userId}` }, roles: ["customer"] });
}

describe("getMyEntitlementQuery (API-DEL-01, SCR-ACC-03 entitlement detail page)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("returns the caller's own entitlement, scoped by ctx.userId", async () => {
    await truncateAll();

    const buyer = await createUser({ emailVerified: true });
    const product = await createProduct({});
    const offering = await createOffering({ productId: product.id, deliveryType: "download" });
    const ent = await createEntitlement({
      userId: buyer.id,
      offering,
      deliveryType: "download",
      status: "active",
    });

    const res = await getMyEntitlementQuery({ entitlementId: ent.id }, ctxFor(buyer.id));

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.entitlementId).toBe(ent.id);
      expect(res.data.deliveryType).toBe("download");
      expect(res.data.status).toBe("active");
    }
  });

  it("returns NOT_FOUND for an entitlement owned by a different customer", async () => {
    await truncateAll();

    const buyer = await createUser({ emailVerified: true });
    const otherUser = await createUser({ emailVerified: true });
    const product = await createProduct({});
    const offering = await createOffering({ productId: product.id, deliveryType: "download" });
    const ent = await createEntitlement({ userId: buyer.id, offering });

    const res = await getMyEntitlementQuery({ entitlementId: ent.id }, ctxFor(otherUser.id));

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("returns NOT_FOUND for an entitlement id that doesn't exist", async () => {
    await truncateAll();
    const buyer = await createUser({ emailVerified: true });

    const res = await getMyEntitlementQuery(
      { entitlementId: "00000000-0000-0000-0000-000000000000" },
      ctxFor(buyer.id),
    );

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("returns VALIDATION for a malformed (non-uuid) entitlement id", async () => {
    const buyer = await createUser({ emailVerified: true });
    const res = await getMyEntitlementQuery({ entitlementId: "not-a-uuid" }, ctxFor(buyer.id));

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe(ErrorCode.VALIDATION);
  });
});

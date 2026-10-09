import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { listMyEntitlementsQuery } from "@/modules/entitlements/queries";
import { entitlementsService } from "@/modules/entitlements/service";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createEntitlement } from "../../factories/delivery";

function ctxFor(userId: string, roles: string[] = ["customer"]) {
  return buildContext({ user: { id: userId }, session: { id: `sess-${userId}` }, roles } as never);
}

describe("listMyEntitlementsQuery with no filters (SCR-ACC purchases page)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("resolves with an empty list for a customer with no entitlements", async () => {
    await truncateAll();
    const buyer = await createUser({ emailVerified: true });

    const res = await listMyEntitlementsQuery({ limit: 100 }, ctxFor(buyer.id));

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.items).toEqual([]);
  });

  it("returns the caller's entitlement", async () => {
    await truncateAll();
    const buyer = await createUser({ emailVerified: true });
    const product = await createProduct({});
    const offering = await createOffering({ productId: product.id, deliveryType: "download" });
    const ent = await createEntitlement({ userId: buyer.id, offering, deliveryType: "download" });

    const res = await listMyEntitlementsQuery({ limit: 100 }, ctxFor(buyer.id));

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.items).toHaveLength(1);
      expect(res.data.items[0]!.entitlementId).toBe(ent.id);
    }
  });

  it("admin list works with no filters", async () => {
    await truncateAll();
    const admin = await createUser({ emailVerified: true });

    const res = await entitlementsService.listEntitlementsAdmin(ctxFor(admin.id, ["admin"]), {
      limit: 100,
    });

    expect(res.items).toEqual([]);
  });
});

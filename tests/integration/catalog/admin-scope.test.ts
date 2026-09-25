import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { AppError, ErrorCode } from "@/lib/errors";
import { createAdmin, createSuperAdmin } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("catalog admin scope & partner isolation (D-512, S-19, PHASE-03 P3.6)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("restricts partners to only their own products in admin lists and graphs", async () => {
    await truncateAll();

    const superAdmin = await createSuperAdmin();
    const partnerA = await createAdmin({ name: "Partner Alice" });
    const partnerB = await createAdmin({ name: "Partner Bob" });

    const superAdminCtx = buildContext({
      user: { id: superAdmin.id },
      session: { id: "sess-sa" },
      roles: ["super_admin"],
    });

    const partnerACtx = buildContext({
      user: { id: partnerA.id },
      session: { id: "sess-pa" },
      roles: ["admin", "partner"],
    });

    const partnerBCtx = buildContext({
      user: { id: partnerB.id },
      session: { id: "sess-pb" },
      roles: ["admin", "partner"],
    });

    // Create product by Partner A
    const productA = await createProduct({
      name: "Product by Alice",
      slug: "product-by-alice",
      createdBy: partnerA.id,
    });

    // Create product by Partner B
    const productB = await createProduct({
      name: "Product by Bob",
      slug: "product-by-bob",
      createdBy: partnerB.id,
    });

    // 1. Super Admin sees all products
    const saList = await catalogService.listProductsAdmin(superAdminCtx, {
      sort: "updatedAt:desc",
      limit: 10,
    });
    expect(saList.items.length).toBe(2);

    // 2. Partner A sees only product A
    const paList = await catalogService.listProductsAdmin(partnerACtx, {
      sort: "updatedAt:desc",
      limit: 10,
    });
    expect(paList.items.length).toBe(1);
    expect(paList.items[0]?.id).toBe(productA.id);

    // 3. Partner B sees only product B
    const pbList = await catalogService.listProductsAdmin(partnerBCtx, {
      sort: "updatedAt:desc",
      limit: 10,
    });
    expect(pbList.items.length).toBe(1);
    expect(pbList.items[0]?.id).toBe(productB.id);

    // 4. Partner A accessing Product B via getProductAdmin -> FORBIDDEN
    await expect(
      catalogService.getProductAdmin(partnerACtx, { productId: productB.id }),
    ).rejects.toThrowError(AppError);

    try {
      await catalogService.getProductAdmin(partnerACtx, { productId: productB.id });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.FORBIDDEN);
    }
  });
});

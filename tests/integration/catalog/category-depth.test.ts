import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { AppError, ErrorCode } from "@/lib/errors";
import { createAdmin } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("catalog category depth & hierarchy (D-303, PHASE-03 P3.6)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("allows root categories and child categories, but rejects depth > 2", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-cat" },
      roles: ["admin"],
    });

    // 1. Create root category (depth 1)
    const { category: root } = await catalogService.upsertCategory(adminCtx, {
      name: "Software & SaaS",
      slug: "software-saas",
      position: 0,
      description: "Root software category",
    });
    expect(root.id).toBeDefined();
    expect(root.parentId).toBeNull();

    // 2. Create child category (depth 2)
    const { category: child } = await catalogService.upsertCategory(adminCtx, {
      name: "Developer Tools",
      slug: "developer-tools",
      parentId: root.id,
      position: 1,
    });
    expect(child.id).toBeDefined();
    expect(child.parentId).toBe(root.id);

    // 3. Attempt to create depth 3 (child of child) -> Must fail with VALIDATION
    await expect(
      catalogService.upsertCategory(adminCtx, {
        name: "CLI Tools",
        slug: "cli-tools",
        parentId: child.id,
        position: 0,
      }),
    ).rejects.toThrowError(AppError);

    try {
      await catalogService.upsertCategory(adminCtx, {
        name: "CLI Tools",
        slug: "cli-tools",
        parentId: child.id,
        position: 0,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.VALIDATION);
    }
  });

  it("refuses to delete a category that has subcategories", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-cat" },
      roles: ["admin"],
    });

    const { category: root } = await catalogService.upsertCategory(adminCtx, {
      name: "Hardware",
      slug: "hardware",
      position: 0,
    });

    await catalogService.upsertCategory(adminCtx, {
      name: "Monitors",
      slug: "monitors",
      parentId: root.id,
      position: 0,
    });

    await expect(
      catalogService.deleteCategory(adminCtx, { categoryId: root.id }),
    ).rejects.toThrowError(AppError);
  });
});

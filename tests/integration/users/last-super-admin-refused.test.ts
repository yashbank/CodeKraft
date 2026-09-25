import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { usersService } from "@/modules/users/service";
import { createPartner, createSuperAdmin } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOwnership } from "../../factories/ownership";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("last super_admin and active partner refusal (API-ADM-11, MASTER_SPEC §7, PHASE-03 P3.4)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("refuses to remove the last super_admin with STATE_INVALID", async () => {
    await truncateAll();
    const soleSuperAdmin = await createSuperAdmin();

    const adminCtx = buildContext({
      user: { id: soleSuperAdmin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    await expect(
      usersService.removeAdmin(adminCtx, { userId: soleSuperAdmin.id }),
    ).rejects.toMatchObject({
      code: ErrorCode.STATE_INVALID,
      message: /cannot remove the last super_admin/i,
    });
  });

  it("refuses to demote the last super_admin with STATE_INVALID", async () => {
    await truncateAll();
    const soleSuperAdmin = await createSuperAdmin();

    const adminCtx = buildContext({
      user: { id: soleSuperAdmin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    await expect(
      usersService.changeAdminRole(adminCtx, {
        userId: soleSuperAdmin.id,
        role: "admin",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.STATE_INVALID,
      message: /cannot demote the last super_admin/i,
    });
  });

  it("allows removing a super_admin when another super_admin exists", async () => {
    await truncateAll();
    const super1 = await createSuperAdmin();
    const super2 = await createSuperAdmin();

    const super1Ctx = buildContext({
      user: { id: super1.id },
      session: { id: "sess-super1" },
      roles: ["super_admin"],
    });

    const res = await usersService.removeAdmin(super1Ctx, { userId: super2.id });
    expect(res.approvalRequestId).toBeDefined();
  });

  it("refuses to remove a partner holding an active product ownership share with STATE_INVALID", async () => {
    await truncateAll();
    const superAdmin = await createSuperAdmin();
    await createSuperAdmin();
    const partner = await createPartner();
    const product = await createProduct();

    // Create an active product ownership split assigning share to partner
    await createOwnership({
      productId: product.id,
      createdBy: superAdmin.id,
      status: "active",
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    const adminCtx = buildContext({
      user: { id: superAdmin.id },
      session: { id: "sess-super" },
      roles: ["super_admin"],
    });

    await expect(
      usersService.removeAdmin(adminCtx, { userId: partner.userId }),
    ).rejects.toMatchObject({
      code: ErrorCode.STATE_INVALID,
      message: /cannot remove a partner holding an active product ownership share/i,
    });
  });
});

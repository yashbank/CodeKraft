import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { usersService } from "@/modules/users/service";
import { createAdmin, createSuperAdmin } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("fewer-than-two-admins warning (API-ADM-11, MASTER_SPEC §7, PHASE-03 P3.4)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("returns warning: fewer_than_two_admins when removing an admin leaves only 1 active admin", async () => {
    await truncateAll();
    const super1 = await createSuperAdmin();
    const super2 = await createSuperAdmin();

    const super1Ctx = buildContext({
      user: { id: super1.id },
      session: { id: "sess-super1" },
      roles: ["super_admin"],
    });

    // Currently 2 admins in system: super1 and super2. Removing super2 leaves only 1.
    const result = await usersService.removeAdmin(super1Ctx, { userId: super2.id });

    expect(result.approvalRequestId).toBeDefined();
    expect(result.warning).toBe("fewer_than_two_admins");
  });

  it("does not return warning when removing an admin leaves 2 or more active admins", async () => {
    await truncateAll();
    const super1 = await createSuperAdmin();
    await createSuperAdmin();
    const admin3 = await createAdmin();

    const super1Ctx = buildContext({
      user: { id: super1.id },
      session: { id: "sess-super1" },
      roles: ["super_admin"],
    });

    // Currently 3 admins. Removing admin3 leaves 2 active admins.
    const result = await usersService.removeAdmin(super1Ctx, { userId: admin3.id });

    expect(result.approvalRequestId).toBeDefined();
    expect(result.warning).toBeUndefined();
  });
});

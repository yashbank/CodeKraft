import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { usersService } from "@/modules/users/service";
import { createAdmin, createSuperAdmin, createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("magic link and reset link rules (API-ADM-09, MASTER_SPEC §7, PHASE-03 P3.4)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("never returns magic link token or URL to the admin caller", async () => {
    await truncateAll();
    const admin = await createSuperAdmin();
    const customer = await createUser();

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    const res = await usersService.sendMagicLink(adminCtx, {
      userId: customer.id,
      kind: "magic",
    });

    // Acceptance criterion: magic link never returned to the admin caller
    expect(res).toEqual({ sentTo: customer.email });
    expect((res as Record<string, unknown>).token).toBeUndefined();
    expect((res as Record<string, unknown>).url).toBeUndefined();
    expect((res as Record<string, unknown>).link).toBeUndefined();
  });

  it("never returns reset link token to caller", async () => {
    await truncateAll();
    const admin = await createSuperAdmin();
    const customer = await createUser();

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    const res = await usersService.sendResetLink(adminCtx, {
      userId: customer.id,
      kind: "reset",
    });

    expect(res).toEqual({ sentTo: customer.email });
    expect((res as Record<string, unknown>).token).toBeUndefined();
    expect((res as Record<string, unknown>).url).toBeUndefined();
  });

  it("refuses sending auth links to administrative accounts with FORBIDDEN", async () => {
    await truncateAll();
    const superAdmin = await createSuperAdmin();
    const targetAdmin = await createAdmin();

    const adminCtx = buildContext({
      user: { id: superAdmin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    await expect(
      usersService.sendMagicLink(adminCtx, {
        userId: targetAdmin.id,
        kind: "magic",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });

    await expect(
      usersService.sendResetLink(adminCtx, {
        userId: targetAdmin.id,
        kind: "reset",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });
});

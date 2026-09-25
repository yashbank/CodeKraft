import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { usersService } from "@/modules/users/service";
import { sessions, users } from "../../../drizzle/schema/auth";
import { createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("suspend customer revokes sessions (API-ADM-08, FR-AUTH-12, PHASE-03 P3.4)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("suspends customer and revokes all active sessions immediately", async () => {
    await truncateAll();
    const admin = await createUser({ role: "super_admin" });
    const customer = await createUser();

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin-1" },
      roles: ["super_admin"],
    });

    const db = (await import("@/lib/db")).db;

    // Create two active sessions for the customer
    await db.insert(sessions).values([
      {
        userId: customer.id,
        token: "tok-cust-1",
        expiresAt: new Date(Date.now() + 1000 * 3600),
        host: "site",
      },
      {
        userId: customer.id,
        token: "tok-cust-2",
        expiresAt: new Date(Date.now() + 1000 * 3600),
        host: "site",
      },
    ]);

    const beforeSessions = await db.select().from(sessions).where(eq(sessions.userId, customer.id));
    expect(beforeSessions).toHaveLength(2);

    // Suspend the customer
    const res = await usersService.suspendCustomer(adminCtx, {
      userId: customer.id,
      reason: "Suspicious activity reported",
    });

    expect(res.user.status).toBe("suspended");

    // Verify all sessions were revoked immediately
    const afterSessions = await db.select().from(sessions).where(eq(sessions.userId, customer.id));
    expect(afterSessions).toHaveLength(0);

    // Reinstate customer
    const reinstateRes = await usersService.reinstateCustomer(adminCtx, {
      userId: customer.id,
      reason: "Identity verified",
    });
    expect(reinstateRes.user.status).toBe("active");
  });

  it("refuses to suspend or reinstate a deleted customer with STATE_INVALID", async () => {
    await truncateAll();
    const admin = await createUser({ role: "super_admin" });
    const customer = await createUser();

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin-1" },
      roles: ["super_admin"],
    });

    const db = (await import("@/lib/db")).db;
    await db.update(users).set({ status: "deleted" }).where(eq(users.id, customer.id));

    await expect(
      usersService.suspendCustomer(adminCtx, {
        userId: customer.id,
        reason: "Test",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.STATE_INVALID,
    });

    await expect(
      usersService.reinstateCustomer(adminCtx, {
        userId: customer.id,
        reason: "Test",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.STATE_INVALID,
    });
  });
});

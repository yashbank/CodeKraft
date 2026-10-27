import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { usersService } from "@/modules/users/service";
import { approvalsService } from "@/modules/approvals/service";
import { userRoles, users, verifications } from "../../../drizzle/schema/auth";
import { partners } from "../../../drizzle/schema/users-ext";
import { createAdmin, createSuperAdmin } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("admin.user_change dual-approval workflow (API-ADM-11, MASTER_SPEC §7, PHASE-03 P3.4)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("processes inviteAdmin approval and applies user creation, roles, and partner rows", async () => {
    await truncateAll();
    const db = (await import("@/lib/db")).db;

    const requester = await createSuperAdmin();
    const decider = await createAdmin();

    const requesterCtx = buildContext({
      user: { id: requester.id },
      session: { id: "sess-req" },
      roles: ["super_admin"],
    });

    const deciderCtx = buildContext({
      user: { id: decider.id },
      session: { id: "sess-dec" },
      roles: ["admin"],
    });

    // 1. Requester invites a new admin with partner details
    const result = await usersService.inviteAdmin(requesterCtx, {
      email: "newpartner@example.com",
      role: "admin",
      partner: { displayName: "Acme Partner Studios" },
    });

    expect(result.approvalRequestId).toBeDefined();

    // 2. Decider approves the request
    const decision = await approvalsService.approveRequest(deciderCtx, {
      approvalRequestId: result.approvalRequestId,
      comment: "Approved by second admin",
    });

    expect(decision.status).toBe("applied");
    expect(decision.applied).toBe(true);

    // 3. Verify user was created with active status
    const [invitedUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "newpartner@example.com"));

    expect(invitedUser).toBeDefined();
    expect(invitedUser!.status).toBe("active");
    expect(invitedUser!.name).toBe("Acme Partner Studios");

    // 4. Verify userRoles has admin role
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, invitedUser!.id));

    expect(roles.some((r) => r.roleKey === "admin")).toBe(true);

    // 5. Verify partner row was inserted
    const [partner] = await db.select().from(partners).where(eq(partners.userId, invitedUser!.id));

    expect(partner).toBeDefined();
    expect(partner!.displayName).toBe("Acme Partner Studios");
    expect(partner!.active).toBe(true);

    // 6. R8-09: the invitee gets a set-password link (Better Auth reset-password token) -- before
    // this, the password-less user was created and nothing was sent, so they could never sign in.
    const tokens = await db
      .select()
      .from(verifications)
      .where(eq(verifications.value, invitedUser!.id));
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.identifier).toMatch(/^reset-password:/);
    expect(tokens[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
  });

  it("staff invite is approved by a second super admin and the staff role is limited", async () => {
    await truncateAll();
    const db = (await import("@/lib/db")).db;
    const requester = await createSuperAdmin();
    const decider = await createSuperAdmin();
    const ctx = (id: string) =>
      buildContext({ user: { id }, session: { id: `s-${id}` }, roles: ["super_admin"] });

    const { approvalRequestId } = await usersService.inviteAdmin(ctx(requester.id), {
      email: "new.staff@example.com",
      role: "staff",
    });
    // The requester can never approve their own request (BR-13).
    await expect(
      approvalsService.approveRequest(ctx(requester.id), { approvalRequestId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const decision = await approvalsService.approveRequest(ctx(decider.id), { approvalRequestId });
    expect(decision.applied).toBe(true);

    const [staff] = await db.select().from(users).where(eq(users.email, "new.staff@example.com"));
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, staff!.id));
    expect(roles.map((r) => r.roleKey)).toEqual(["staff"]);

    const staffCtx = buildContext({
      user: { id: staff!.id },
      session: { id: "s" },
      roles: ["staff"],
    });
    expect(staffCtx.permissions.has("users.admin.manage")).toBe(false);
    expect(staffCtx.permissions.has("approvals.decide")).toBe(false);
    await expect(
      usersService.inviteAdmin(staffCtx, { email: "x@example.com", role: "admin" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

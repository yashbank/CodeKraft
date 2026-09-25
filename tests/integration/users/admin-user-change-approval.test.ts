import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { usersService } from "@/modules/users/service";
import { approvalsService } from "@/modules/approvals/service";
import { userRoles, users } from "../../../drizzle/schema/auth";
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
  });
});

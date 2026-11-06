/**
 * G18 admin swap safety: approvals show who must approve, a super admin cannot be removed until two
 * others have a verified login, the Admin users list carries a verification status, and partner
 * invites / removals behave. Real Postgres.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { usersService } from "@/modules/users/service";
import { approvalsService } from "@/modules/approvals/service";
import { listAdminVerification } from "@/modules/users/admin-verification";
import { approvalRequests } from "../../../drizzle/schema/approvals";
import { userRoles, users } from "../../../drizzle/schema/auth";
import { ledgerEntries } from "../../../drizzle/schema/finance";
import { partners } from "../../../drizzle/schema/users-ext";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createSuperAdmin } from "../../factories/users";
import { markSignedIn } from "../../factories/sign-in";

const ctxFor = (id: string, role: "super_admin" | "admin" = "super_admin") =>
  buildContext({ user: { id }, session: { id: `s-${id}` }, roles: [role] });

/** Every other admin-class user approves, so the request applies. */
async function approveAll(requesterId: string, approvalRequestId: string, skip: string[] = []) {
  const rows = await db
    .selectDistinct({ id: userRoles.userId })
    .from(userRoles)
    .where(inArray(userRoles.roleKey, ["super_admin", "admin"]));
  for (const { id } of rows) {
    if (id === requesterId || skip.includes(id)) continue;
    await approvalsService.approveRequest(ctxFor(id), { approvalRequestId });
  }
  const [row] = await db
    .select({ status: approvalRequests.status, error: approvalRequests.error })
    .from(approvalRequests)
    .where(eq(approvalRequests.id, approvalRequestId));
  expect(row).toEqual({ status: "applied", error: null });
}

describe("admin swap safety", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("approvals list who is required and who already approved, by name and email", async () => {
    await truncateAll();
    const a = await createSuperAdmin({ email: "a@example.com", name: "Asha" });
    const b = await createSuperAdmin({ email: "b@example.com", name: "Bala" });
    const c = await createSuperAdmin({ email: "c@example.com", name: "Chitra" });
    const { approvalRequestId } = await usersService.inviteAdmin(ctxFor(a.id), {
      email: "new@example.com",
      role: "admin",
    });
    await approvalsService.approveRequest(ctxFor(b.id), { approvalRequestId });

    const view = await approvalsService.getApproval(ctxFor(a.id), { approvalRequestId });
    expect(view.approvers).toEqual([
      { userId: b.id, name: "Bala", email: "b@example.com", state: "approved" },
      { userId: c.id, name: "Chitra", email: "c@example.com", state: "pending" },
    ]);
    const list = await approvalsService.listApprovals(ctxFor(a.id), { limit: 25 });
    expect(list.items[0]?.approvers?.map((p) => p.state)).toEqual(["approved", "pending"]);
  });

  it("the person being removed is not listed as an approver of their own removal", async () => {
    await truncateAll();
    const a = await createSuperAdmin({ email: "a@example.com" });
    const b = await createSuperAdmin({ email: "b@example.com" });
    const c = await createSuperAdmin({ email: "c@example.com" });
    const d = await createSuperAdmin({ email: "d@example.com" });
    for (const u of [b, c, d]) await markSignedIn(u.id);
    const { approvalRequestId } = await usersService.removeAdmin(ctxFor(a.id), { userId: b.id });
    const view = await approvalsService.getApproval(ctxFor(a.id), { approvalRequestId });
    expect(view.approvers?.map((p) => p.email)).toEqual(["c@example.com", "d@example.com"]);
  });

  it("refuses to remove a super admin until two others have a verified login", async () => {
    await truncateAll();
    const oldA = await createSuperAdmin({ email: "old.a@example.com" });
    const oldB = await createSuperAdmin({ email: "old.b@example.com" });
    for (const email of ["new.a@crestline.technologies.in", "new.b@crestline.technologies.in"]) {
      const { approvalRequestId } = await usersService.inviteAdmin(ctxFor(oldA.id), {
        email,
        role: "super_admin",
      });
      await approveAll(oldA.id, approvalRequestId);
    }
    const [newA] = await db
      .select()
      .from(users)
      .where(eq(users.email, "new.a@crestline.technologies.in"));
    const [newB] = await db
      .select()
      .from(users)
      .where(eq(users.email, "new.b@crestline.technologies.in"));

    // Invited but never signed in: refused, and the message says what is missing for whom.
    const refused = usersService.removeAdmin(ctxFor(newA!.id), { userId: oldA.id });
    await expect(refused).rejects.toMatchObject({ code: "STATE_INVALID" });
    await expect(refused).rejects.toThrow(/new\.a@crestline\.technologies\.in/);
    await expect(refused).rejects.toThrow(/has never signed in/);
    await expect(refused).rejects.toThrow(/no password set and no Google account linked/);
    await expect(refused).rejects.toThrow(/0 ready, 2 more needed/);

    // One verified is still not enough.
    await markSignedIn(newA!.id);
    await expect(usersService.removeAdmin(ctxFor(newA!.id), { userId: oldA.id })).rejects.toThrow(
      /1 ready, 1 more needed/,
    );

    // Both verified: removing the old ones works.
    await markSignedIn(newB!.id);
    for (const target of [oldA.id, oldB.id]) {
      const { approvalRequestId } = await usersService.removeAdmin(ctxFor(newA!.id), {
        userId: target,
      });
      await approveAll(newA!.id, approvalRequestId, [target]);
    }
    const supers = await db
      .select({ email: users.email })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(eq(userRoles.roleKey, "super_admin"));
    expect(supers.map((s) => s.email).sort()).toEqual([
      "new.a@crestline.technologies.in",
      "new.b@crestline.technologies.in",
    ]);
  });

  it("verification status reports email, sign-in method, last sign-in, role and partner", async () => {
    await truncateAll();
    const root = await createSuperAdmin({ email: "root@example.com" });
    const ready = await createSuperAdmin({ email: "ready@example.com" });
    const partnerAdmin = await createAdmin({ email: "pa@example.com", withAccount: false });
    await createPartner({ user: partnerAdmin });
    await markSignedIn(ready.id);

    const rows = await listAdminVerification(db);
    const by = new Map(rows.map((r) => [r.email, r]));
    expect(by.get("ready@example.com")).toMatchObject({
      role: "super_admin",
      emailVerified: true,
      canSignIn: true,
      signInMethods: ["password"],
      hasSignedIn: true,
      isPartner: false,
      verified: true,
      missing: [],
    });
    expect(by.get("root@example.com")).toMatchObject({ hasSignedIn: false, verified: false });
    expect(by.get("pa@example.com")).toMatchObject({
      role: "admin",
      canSignIn: false,
      isPartner: true,
      verified: false,
    });

    const list = await usersService.listAdminUsers(ctxFor(root.id), {});
    const row = list.items.find((i) => i.email === "ready@example.com");
    expect(row?.verification).toMatchObject({ verified: true, canSignIn: true });
    expect(row?.lastSignInAt).toBeTruthy();
  });

  it("invites info@crestline.technologies.in as an admin with a partner profile (staff cannot be a partner)", async () => {
    await truncateAll();
    const a = await createSuperAdmin();
    await createSuperAdmin();

    await expect(
      usersService.inviteAdmin(ctxFor(a.id), {
        email: "info@crestline.technologies.in",
        role: "staff",
        partner: { displayName: "Crestline" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const { approvalRequestId } = await usersService.inviteAdmin(ctxFor(a.id), {
      email: "info@crestline.technologies.in",
      role: "admin",
      partner: { displayName: "Crestline Technologies" },
    });
    await approveAll(a.id, approvalRequestId);
    const [u] = await db
      .select()
      .from(users)
      .where(eq(users.email, "info@crestline.technologies.in"));
    expect(u).toBeTruthy();
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, u!.id));
    expect(roles.map((r) => r.roleKey)).toEqual(["admin"]);
    const [p] = await db.select().from(partners).where(eq(partners.userId, u!.id));
    expect(p).toMatchObject({ displayName: "Crestline Technologies", active: true });
  });

  it("removing an admin deletes their partner row when it holds no money rows, refuses otherwise", async () => {
    await truncateAll();
    const a = await createSuperAdmin();
    const b = await createSuperAdmin();
    const clean = await createAdmin({ email: "clean@example.com" });
    const cleanPartner = await createPartner({ user: clean });
    const busy = await createAdmin({ email: "busy@example.com" });
    const busyPartner = await createPartner({ user: busy });
    await db.insert(ledgerEntries).values({
      entryType: "adjustment",
      partyType: "partner",
      partnerId: busyPartner.id,
      amountMinor: 100,
      currency: "INR",
      amountInrMinor: 100,
      fxRateToInr: "1",
      createdBy: a.id,
    } as never);

    const { approvalRequestId } = await usersService.removeAdmin(ctxFor(a.id), {
      userId: clean.id,
    });
    await approveAll(a.id, approvalRequestId);
    expect(await db.select().from(partners).where(eq(partners.id, cleanPartner.id))).toHaveLength(
      0,
    );
    expect(await db.select().from(users).where(eq(users.id, clean.id))).toHaveLength(0);
    void b;

    const refused = usersService.removeAdmin(ctxFor(a.id), { userId: busy.id });
    await expect(refused).rejects.toMatchObject({ code: "STATE_INVALID" });
    await expect(refused).rejects.toThrow(/still has ledger entries/);
    expect(await db.select().from(users).where(eq(users.id, busy.id))).toHaveLength(1);
  });
});

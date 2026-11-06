import { beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { usersService } from "@/modules/users/service";
import { approvalsService } from "@/modules/approvals/service";
import {
  PURGE_NULL_COLUMNS,
  PURGE_OWNED_COLUMNS,
  PURGE_PARTNER_COLUMNS,
  PURGE_REASSIGN_COLUMNS,
  purgeUser,
} from "@/modules/users/purge-user";
import { runReset } from "@/modules/settings/site-reset";
import { listCustomers } from "@/modules/users/customers";
import { auditLogs } from "../../../drizzle/schema/audit";
import { userRoles, users } from "../../../drizzle/schema/auth";
import { orders } from "../../../drizzle/schema/commerce";
import { downloads, entitlements } from "../../../drizzle/schema/delivery";
import { products } from "../../../drizzle/schema/catalog";
import { approvalRequests } from "../../../drizzle/schema/approvals";
import { partners } from "../../../drizzle/schema/users-ext";
import { createApprovalRequest } from "../../factories/approvals";
import { createMedia, createProduct } from "../../factories/catalog";
import { createOrder } from "../../factories/commerce";
import { createEntitlement } from "../../factories/delivery";
import { createOwnership } from "../../factories/ownership";
import { createAdmin, createPartner, createSuperAdmin, createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

const ctxFor = (id: string, role: "super_admin" | "admin" = "super_admin") =>
  buildContext({ user: { id }, session: { id: `s-${id}` }, roles: [role] });

describe("permanent user delete (purgeUser, deleteCustomer, admin removal)", () => {
  const sqlc = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("every non-cascading foreign key to users is handled by the purge", async () => {
    const rows = await sqlc<{ tbl: string; col: string; del: string }[]>`
      select cl.relname tbl, a.attname col, con.confdeltype del
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_class ft on ft.oid = con.confrelid
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
      where con.contype = 'f' and ft.relname = 'users' and con.confdeltype in ('a', 'r')`;
    const handled = new Set<string>([
      ...PURGE_OWNED_COLUMNS,
      ...PURGE_REASSIGN_COLUMNS,
      ...PURGE_NULL_COLUMNS,
      ...PURGE_PARTNER_COLUMNS,
    ]);
    expect(rows.map((r) => `${r.tbl}.${r.col}`).filter((k) => !handled.has(k))).toEqual([]);
  });

  it("deletes a customer for good: own rows go, orders stay anonymised, email is free again", async () => {
    await truncateAll();
    const db = (await import("@/lib/db")).db;
    const root = await createSuperAdmin();
    const customer = await createUser({ email: "demo.customer@example.com" });
    const order = await createOrder({ user: customer });
    const ent = await createEntitlement({ user: customer });
    const file = await createMedia();
    await db
      .insert(downloads)
      .values({ userId: customer.id, entitlementId: ent.id, mediaId: file.id });

    const res = await usersService.deleteCustomer(ctxFor(root.id), { userId: customer.id });
    expect(res.deleted).toBe(true);

    expect(await db.select().from(users).where(eq(users.id, customer.id))).toHaveLength(0);
    expect(
      await db.select().from(entitlements).where(eq(entitlements.userId, customer.id)),
    ).toHaveLength(0);
    expect(await db.select().from(downloads).where(eq(downloads.userId, customer.id))).toHaveLength(
      0,
    );
    const [kept] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(kept?.userId).toBeNull();

    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.action, "user.purged"));
    expect(log?.actorId).toBe(root.id);
    expect(log?.subjectId).toBe(customer.id);

    // the address can be used again
    const again = await createUser({ email: "demo.customer@example.com" });
    expect(again.id).not.toBe(customer.id);
  });

  it("deleteCustomer refuses admins, needs customers.delete, and keeps the list free of admins", async () => {
    await truncateAll();
    const db = (await import("@/lib/db")).db;
    const root = await createSuperAdmin();
    const admin = await createAdmin();
    const staffLike = await createUser({ role: "staff" });
    const customer = await createUser();

    await expect(
      usersService.deleteCustomer(ctxFor(root.id), { userId: admin.id }),
    ).rejects.toMatchObject({ code: "STATE_INVALID" });
    await expect(
      usersService.deleteCustomer(ctxFor(admin.id, "admin"), { userId: customer.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      usersService.deleteCustomer(ctxFor(root.id), { userId: root.id }),
    ).rejects.toMatchObject({ code: "STATE_INVALID" });

    const list = await listCustomers(ctxFor(root.id), { limit: 50 }, db);
    const ids = list.items.map((r) => r.user.id);
    expect(ids).toContain(customer.id);
    expect(ids).not.toContain(root.id);
    expect(ids).not.toContain(admin.id);
    expect(ids).not.toContain(staffLike.id);
  });

  it("an admin who authored records is deleted; records go to the actor", async () => {
    await truncateAll();
    const db = (await import("@/lib/db")).db;
    const actor = await createSuperAdmin();
    const old = await createSuperAdmin();
    const product = await createProduct({ createdBy: old.id });
    const approval = await createApprovalRequest({ requestedBy: old.id });

    await db.transaction((tx) => purgeUser(tx, { targetId: old.id, actorId: actor.id }));

    expect(await db.select().from(users).where(eq(users.id, old.id))).toHaveLength(0);
    const [p] = await db.select().from(products).where(eq(products.id, product.id));
    expect(p?.createdBy).toBe(actor.id);
    expect(p?.updatedBy).toBe(actor.id);
    const [a] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, approval.id));
    expect(a?.requestedBy).toBe(actor.id);
    const triggers =
      await sqlc`select count(*)::int n from pg_trigger t join pg_class c on c.oid = t.tgrelid
      where c.relname = 'audit_logs' and not t.tgisinternal and t.tgenabled = 'D'`;
    expect(triggers[0]?.n).toBe(0);
  });

  it("refuses the last super admin and a partner that still has ownership shares", async () => {
    await truncateAll();
    const db = (await import("@/lib/db")).db;
    const only = await createSuperAdmin();
    const helper = await createAdmin();
    await expect(
      db.transaction((tx) => purgeUser(tx, { targetId: only.id, actorId: helper.id })),
    ).rejects.toMatchObject({ code: "STATE_INVALID" });

    const partnerAdmin = await createAdmin();
    const partner = await createPartner({ user: partnerAdmin });
    const prod = await createProduct();
    await createOwnership({
      productId: prod.id,
      companyCutBps: 0,
      lines: [{ partnerId: partner.id, shareBps: 10_000 }],
      status: "superseded",
    });
    await expect(
      db.transaction((tx) => purgeUser(tx, { targetId: partnerAdmin.id, actorId: only.id })),
    ).rejects.toMatchObject({ code: "STATE_INVALID" });
    expect(await db.select().from(users).where(eq(users.id, partnerAdmin.id))).toHaveLength(1);
  });

  it("partner without finance rows is deleted with the user", async () => {
    await truncateAll();
    const db = (await import("@/lib/db")).db;
    const actor = await createSuperAdmin();
    const admin = await createAdmin();
    await createPartner({ user: admin, active: false });
    await db.transaction((tx) => purgeUser(tx, { targetId: admin.id, actorId: actor.id }));
    expect(await db.select().from(partners)).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.id, admin.id))).toHaveLength(0);
  });

  it("rotation: invite two new super admins, then remove both old ones through approvals", async () => {
    await truncateAll();
    const db = (await import("@/lib/db")).db;
    const oldA = await createSuperAdmin({ email: "old.a@example.com" });
    const oldB = await createSuperAdmin({ email: "old.b@example.com" });
    await createPartner({ user: oldA });
    await createPartner({ user: oldB });
    const product = await createProduct({ createdBy: oldA.id });

    // Everyone else who counts as an approver (not the requester, not the person being removed).
    const approveAll = async (
      requesterId: string,
      approvalRequestId: string,
      skip: string[] = [],
    ) => {
      const rows = await db
        .selectDistinct({ id: userRoles.userId })
        .from(userRoles)
        .where(inArray(userRoles.roleKey, ["super_admin", "admin"]));
      const deciders = rows
        .map((r) => r.id)
        .filter((id) => id !== requesterId && !skip.includes(id));
      let last: Awaited<ReturnType<typeof approvalsService.approveRequest>> | undefined;
      for (const id of deciders) {
        last = await approvalsService.approveRequest(ctxFor(id), { approvalRequestId });
      }
      const [row] = await db
        .select({ error: approvalRequests.error })
        .from(approvalRequests)
        .where(eq(approvalRequests.id, approvalRequestId));
      expect({ applied: last?.applied, status: last?.status, error: row?.error ?? null }).toEqual({
        error: null,
        applied: true,
        status: "applied",
      });
    };

    // old A invites both new super admins, old B approves
    for (const email of ["new.a@example.com", "new.b@example.com"]) {
      const { approvalRequestId } = await usersService.inviteAdmin(ctxFor(oldA.id), {
        email,
        role: "super_admin",
        partner: { displayName: email },
      });
      await approveAll(oldA.id, approvalRequestId);
    }
    const [newA] = await db.select().from(users).where(eq(users.email, "new.a@example.com"));
    const [newB] = await db.select().from(users).where(eq(users.email, "new.b@example.com"));
    expect(newA && newB).toBeTruthy();

    // new A removes old A and old B; new B approves both
    for (const target of [oldA.id, oldB.id]) {
      const { approvalRequestId } = await usersService.removeAdmin(ctxFor(newA!.id), {
        userId: target,
      });
      await approveAll(newA!.id, approvalRequestId, [target]);
    }

    expect(await db.select().from(users).where(eq(users.id, oldA.id))).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.id, oldB.id))).toHaveLength(0);
    const supers = await db
      .select({ email: users.email })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(eq(userRoles.roleKey, "super_admin"));
    expect(supers.map((s) => s.email).sort()).toEqual(["new.a@example.com", "new.b@example.com"]);

    // authored records survive and now belong to an active super admin
    const [p] = await db.select().from(products).where(eq(products.id, product.id));
    expect([newA!.id, newB!.id]).toContain(p?.createdBy);
    // the old email can be invited again
    const { approvalRequestId } = await usersService.inviteAdmin(ctxFor(newA!.id), {
      email: "old.a@example.com",
      role: "admin",
    });
    await approveAll(newA!.id, approvalRequestId);
    const rows = await db.execute(sql`select 1 from users where email = 'old.a@example.com'`);
    expect([...rows]).toHaveLength(1);
  });

  it("reset site data removes ex-admins left without a role, keeps one with ownership shares", async () => {
    await truncateAll();
    const root = await createSuperAdmin();
    const gone = await createUser({ email: "ex.admin@example.com" });
    await createPartner({ user: gone, active: false });
    const blocked = await createUser({ email: "ex.partner@example.com" });
    const partner = await createPartner({ user: blocked, active: false });
    const prod = await createProduct();
    await createOwnership({
      productId: prod.id,
      companyCutBps: 0,
      lines: [{ partnerId: partner.id, shareBps: 10_000 }],
    });

    await sqlc.begin(async (tx) => {
      await runReset({ run: async (t) => [...(await tx.unsafe(t))] as Record<string, unknown>[] }, [
        "customers_orders",
      ]);
    });

    const emails = (await sqlc`select email from users order by email`).map((r) => r.email);
    expect(emails).toContain(root.email);
    expect(emails).toContain("ex.partner@example.com");
    expect(emails).not.toContain("ex.admin@example.com");
  });
});

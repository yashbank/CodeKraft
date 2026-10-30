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

const ctx = (id: string, role: "super_admin" | "admin" = "super_admin") =>
  buildContext({ user: { id }, session: { id: `s-${id}` }, roles: [role] });

describe("P14-02 admin -> partner path", () => {
  getTestDb();
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("invited admin + partner shows in the partner list and drops out of the candidates", async () => {
    await truncateAll();
    const a = await createSuperAdmin();
    const b = await createSuperAdmin();
    const { approvalRequestId } = await usersService.inviteAdmin(ctx(a.id), {
      email: "p1402.partner@example.com",
      role: "admin",
      partner: { displayName: "P1402 Partner" },
    });
    await approvalsService.approveRequest(ctx(b.id), { approvalRequestId });
    const list = await usersService.listPartners(ctx(a.id), { limit: 50 });
    expect(list.items.map((p) => p.displayName)).toContain("P1402 Partner");
    const cands = await usersService.listPartnerCandidates(ctx(a.id));
    expect(cands.items.map((c) => c.email)).not.toContain("p1402.partner@example.com");
  });

  it("an existing admin added as partner is listed and cannot be added twice", async () => {
    await truncateAll();
    const a = await createSuperAdmin();
    const admin = await createAdmin();
    const first = await usersService.createPartner(ctx(a.id), { userId: admin.id });
    expect(first.partner.userId).toBe(admin.id);
    const list = await usersService.listPartners(ctx(a.id), { limit: 50 });
    expect(list.items.map((p) => p.userId)).toContain(admin.id);
    await expect(usersService.createPartner(ctx(a.id), { userId: admin.id })).rejects.toMatchObject(
      { code: "CONFLICT" },
    );
  });

  it("double submit: concurrent createPartner creates exactly one row, the losers get CONFLICT", async () => {
    await truncateAll();
    const a = await createSuperAdmin();
    const admin = await createAdmin();
    const results = await Promise.allSettled([
      usersService.createPartner(ctx(a.id), { userId: admin.id }),
      usersService.createPartner(ctx(a.id), { userId: admin.id }),
      usersService.createPartner(ctx(a.id), { userId: admin.id }),
    ]);
    const db = (await import("@/lib/db")).db;
    expect(await db.select().from(partners).where(eq(partners.userId, admin.id))).toHaveLength(1);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "CONFLICT" });
    }
  });

  it("re-inviting a removed admin as a partner reactivates the old partner row", async () => {
    await truncateAll();
    const a = await createSuperAdmin();
    const b = await createSuperAdmin();
    const gone = await createAdmin();
    const db = (await import("@/lib/db")).db;
    await usersService.createPartner(ctx(a.id), { userId: gone.id, displayName: "Old Name" });
    // what an approved "remove" does
    await db.delete(userRoles).where(eq(userRoles.userId, gone.id));
    await db.update(partners).set({ active: false }).where(eq(partners.userId, gone.id));
    const [u] = await db.select().from(users).where(eq(users.id, gone.id));
    const { approvalRequestId } = await usersService.inviteAdmin(ctx(a.id), {
      email: String(u!.email),
      role: "admin",
      partner: { displayName: "New Name" },
    });
    await approvalsService.approveRequest(ctx(b.id), { approvalRequestId });
    const [p] = await db.select().from(partners).where(eq(partners.userId, gone.id));
    expect(p).toMatchObject({ active: true, displayName: "New Name" });
  });

  it("a staff invite cannot carry a partner (partners are admin-class only)", async () => {
    await truncateAll();
    const a = await createSuperAdmin();
    await createSuperAdmin();
    await expect(
      usersService.inviteAdmin(ctx(a.id), {
        email: "p1402.staff@example.com",
        role: "staff",
        partner: { displayName: "Nope" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

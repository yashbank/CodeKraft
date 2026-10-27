import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { createCustomer } from "@/modules/users/customers";
import { userRoles, users } from "../../../drizzle/schema/auth";
import { createAdmin, createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("admin createCustomer (BUG-066)", () => {
  getTestDb();
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("creates a customer-role user, sends set-password email, rejects duplicates", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "s" },
      roles: ["super_admin"],
    });
    const send = vi.fn().mockResolvedValue(undefined);
    const r = await createCustomer(
      ctx,
      { email: "New.Person@Example.com", name: "New Person", company: "Acme" },
      db,
      send,
    );
    expect(r.emailSent).toBe(true);
    expect(send).toHaveBeenCalledWith("new.person@example.com");
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, r.userId));
    expect(roles.map((x) => x.roleKey)).toEqual(["customer"]);
    const [u] = await db.select().from(users).where(eq(users.id, r.userId));
    expect(u?.status).toBe("active");

    await expect(
      createCustomer(ctx, { email: "new.person@example.com", name: "Dup" }, db, send),
    ).rejects.toThrow(/already exists/);
  });

  it("keeps the account when email send fails, and refuses non-admins", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "s" },
      roles: ["super_admin"],
    });
    const r = await createCustomer(
      ctx,
      { email: "x@example.com", name: "X" },
      db,
      vi.fn().mockRejectedValue(new Error("smtp")),
    );
    expect(r.emailSent).toBe(false);

    const cust = await createUser({ role: "customer" });
    const cctx = buildContext({
      user: { id: cust.id },
      session: { id: "s2" },
      roles: ["customer"],
    });
    await expect(createCustomer(cctx, { email: "y@example.com", name: "Y" }, db)).rejects.toThrow();
  });
});

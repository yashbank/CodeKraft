import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { getCustomer, listCustomers } from "@/modules/users/customers";
import { createAdmin, createUser } from "../../factories/users";
import { createOrder } from "../../factories/commerce";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("customers with orders", () => {
  getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("listCustomers and getCustomer return lastOrderAt as an ISO string", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });
    await createOrder({ user: customer });
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "s" },
      roles: ["super_admin"],
    });

    const list = await listCustomers(ctx, { limit: 25 }, db);
    const row = list.items.find((c) => c.user.id === customer.id);
    expect(row?.lastOrderAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const detail = await getCustomer(ctx, { userId: customer.id }, db);
    expect(detail.lastOrderAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

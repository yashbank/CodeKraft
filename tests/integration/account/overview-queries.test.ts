import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { listMyEntitlementsQuery } from "@/modules/entitlements/queries";
import { listMyInvoicesQuery } from "@/modules/invoices/queries";
import { listMyQueriesQuery } from "@/modules/queries/queries";
import { listMyWishlistQuery } from "@/modules/catalog/queries";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createUser } from "../../factories/users";

describe("account overview queries for a fresh unverified customer", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("all four succeed", async () => {
    await truncateAll();
    const u = await createUser({ emailVerified: false });
    const ctx = buildContext({ user: { id: u.id }, session: { id: "s" }, roles: ["customer"] });
    const res = await Promise.all([
      listMyEntitlementsQuery({ limit: 5 }, ctx),
      listMyInvoicesQuery({ limit: 5 }, ctx),
      listMyQueriesQuery({ limit: 5 }, ctx),
      listMyWishlistQuery({ limit: 100, displayCurrency: "INR" }, ctx),
    ]);
    expect(res.map((r) => (r.ok ? "ok" : r.error.code))).toEqual(["ok", "ok", "ok", "ok"]);
  });
});

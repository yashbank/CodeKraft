import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createUser } from "../../factories/users";

describe("audit listAuditLogs filters & cursor pagination (API-ADM-05, PHASE-03 P3.1)", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("filters by actorId, action prefix, subjectType, and paginates with cursor", async () => {
    await truncateAll(sql);

    const admin1 = await createUser({ role: "super_admin" });
    const admin2 = await createUser({ role: "admin" });

    const adminCtx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-1" },
      roles: ["super_admin"],
    });

    const otherUserCtx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-2" },
      roles: ["admin"],
    });

    // Seed test audit entries
    await withTx(async (tx) => {
      // 3 catalog entries
      await auditService.log(
        adminCtx,
        "API-CAT-01 product.create",
        { type: "product", id: "prod-1" },
        null,
        { title: "Product 1" },
        tx,
      );
      await auditService.log(
        adminCtx,
        "API-CAT-02 product.update",
        { type: "product", id: "prod-1" },
        { title: "Product 1" },
        { title: "Product 1 Updated" },
        tx,
      );
      await auditService.log(
        otherUserCtx,
        "API-CAT-03 product.delete",
        { type: "product", id: "prod-2" },
        { title: "Product 2" },
        null,
        tx,
      );

      // 1 settings entry
      await auditService.log(
        adminCtx,
        "API-ADM-10 settings.update",
        { type: "settings", id: "site" },
        null,
        { baseCurrency: "INR" },
        tx,
      );
    });

    // 1. Filter by action prefix "API-CAT"
    const catLogs = await auditService.listAuditLogs(adminCtx, {
      filters: { action: "API-CAT" },
      limit: 10,
    });
    expect(catLogs.items.length).toBe(3);
    expect(catLogs.items.every((item) => item.action.startsWith("API-CAT"))).toBe(true);

    // 2. Filter by actorId
    const otherUserLogs = await auditService.listAuditLogs(adminCtx, {
      filters: { actorId: admin2.id },
      limit: 10,
    });
    expect(otherUserLogs.items.length).toBe(1);
    expect(otherUserLogs.items[0]?.subject.id).toBe("prod-2");

    // 3. Filter by subjectType
    const settingsLogs = await auditService.listAuditLogs(adminCtx, {
      filters: { subjectType: "settings" },
      limit: 10,
    });
    expect(settingsLogs.items.length).toBe(1);
    expect(settingsLogs.items[0]?.subject.type).toBe("settings");

    // 4. Test pagination with limit 2
    const page1 = await auditService.listAuditLogs(adminCtx, {
      limit: 2,
    });
    expect(page1.items.length).toBe(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await auditService.listAuditLogs(adminCtx, {
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.items.length).toBe(2);
    expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
    expect(page2.items[0]?.id).not.toBe(page1.items[1]?.id);
  });

  it("refuses unauthorized callers without audit.read", async () => {
    const buyer = await createUser({ role: "customer" });
    const unauthedCtx = buildContext({
      user: { id: buyer.id },
      session: { id: "sess-buyer" },
      roles: ["customer"],
    });

    await expect(auditService.listAuditLogs(unauthedCtx, { limit: 10 })).rejects.toThrow();
  });
});

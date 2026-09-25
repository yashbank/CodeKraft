import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createUser } from "../../factories/users";

describe("audit exportAuditLogs (API-ADM-05, PHASE-03 P3.1)", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("exports CSV, returns presigned URL, and audits the export operation", async () => {
    await truncateAll(sql);

    const admin = await createUser({ role: "super_admin" });
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-1" },
      roles: ["super_admin"],
    });

    // Create a few logs to export
    await withTx(async (tx) => {
      await auditService.log(
        adminCtx,
        "API-CAT-01 product.create",
        { type: "product", id: "prod-export-1" },
        null,
        { title: "Export Test Product" },
        tx,
      );
    });

    // Run export
    const exportResult = await auditService.exportAuditLogs(adminCtx, {});

    expect(exportResult.url).toContain("https://storage.codekraft.local");
    expect(exportResult.filename).toMatch(/^audit-export-.*\.csv$/);
    expect(new Date(exportResult.expiresAt).getTime()).toBeGreaterThan(Date.now());

    // Verify the export itself was audited
    const [exportAuditRow] = await sql<{ id: string; action: string; subject_id: string }[]>`
      select id, action, subject_id from audit_logs where action = 'API-ADM-05 audit.export'
    `;

    expect(exportAuditRow).toBeDefined();
    expect(exportAuditRow?.subject_id).toBe(exportResult.filename);
  });

  it("refuses unauthorized callers without audit.export", async () => {
    const customer = await createUser({ role: "customer" });
    const unauthedCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-buyer" },
      roles: ["customer"],
    });

    await expect(auditService.exportAuditLogs(unauthedCtx, {})).rejects.toThrow();
  });
});

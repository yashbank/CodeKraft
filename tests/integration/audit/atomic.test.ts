import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { REDACTED_PLACEHOLDER } from "@/modules/audit/redact";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createUser } from "../../factories/users";

describe("audit atomic writes & redaction (PHASE-03 P3.1, SA-23, MASTER_SPEC §4.9)", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("writes an audit row within the caller's transaction and rolls back on failure", async () => {
    await truncateAll(sql);

    const admin = await createUser({ role: "super_admin" });
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-1" },
      roles: ["super_admin"],
    });

    // Case 1: Transaction rolls back on error
    await expect(
      withTx(async (tx) => {
        await auditService.log(
          ctx,
          "API-ADM-05 audit.test",
          { type: "test", id: "rollback-1" },
          null,
          { test: true },
          tx,
        );
        throw new Error("Simulated domain failure");
      }),
    ).rejects.toThrow("Simulated domain failure");

    // Verify row was rolled back and does not exist in DB
    const [rowAfterRollback] = await sql<{ id: string }[]>`
      select id from audit_logs where action = 'API-ADM-05 audit.test' and subject_id = 'rollback-1'
    `;
    expect(rowAfterRollback).toBeUndefined();

    // Case 2: Successful transaction commits audit row
    const result = await withTx(async (tx) => {
      return await auditService.log(
        ctx,
        "API-ADM-05 audit.test",
        { type: "test", id: "commit-1" },
        null,
        { committed: true },
        tx,
      );
    });

    expect(result.auditLogId).toBeDefined();

    const [committedRow] = await sql<{ id: string; subject_id: string }[]>`
      select id, subject_id from audit_logs where id = ${result.auditLogId}
    `;
    expect(committedRow?.subject_id).toBe("commit-1");
  });

  it("redacts encrypted and secret credentials from before and after payloads", async () => {
    await truncateAll(sql);

    const admin = await createUser({ role: "super_admin" });
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-1" },
      roles: ["super_admin"],
    });

    const sensitiveBefore = {
      license_key_enc: "enc:raw-key-old",
      password: "old-password",
      normalField: "keep",
    };

    const sensitiveAfter = {
      license_key_enc: "enc:raw-key-new",
      payout_bank_details_enc: "enc:bank-details",
      token: "secret-token",
      apiKey: "secret-api-key",
      normalField: "updated",
    };

    const { auditLogId } = await withTx(async (tx) => {
      return await auditService.log(
        ctx,
        "API-ADM-05 audit.test_redact",
        { type: "credentials", id: "cred-1" },
        sensitiveBefore,
        sensitiveAfter,
        tx,
      );
    });

    const [row] = await sql<{ before: any; after: any }[]>`
      select before, after from audit_logs where id = ${auditLogId}
    `;

    expect(row?.before.license_key_enc).toBe(REDACTED_PLACEHOLDER);
    expect(row?.before.password).toBe(REDACTED_PLACEHOLDER);
    expect(row?.after.license_key_enc).toBe(REDACTED_PLACEHOLDER);
    expect(row?.after.payout_bank_details_enc).toBe(REDACTED_PLACEHOLDER);
    expect(row?.after.token).toBe(REDACTED_PLACEHOLDER);
    expect(row?.after.apiKey).toBe(REDACTED_PLACEHOLDER);
    expect(row?.after.normalField).toBe("updated");
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { sql as dsql } from "drizzle-orm";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createUser } from "../../factories/users";

describe("approval apply handler that fails with a SQL error", () => {
  const sql = getTestDb();
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("rolls back the handler's writes, stores the real DB error, and leaves status approved", async () => {
    await truncateAll(sql);
    const requester = await createUser({ role: "admin" });
    const superAdmin = await createUser({ role: "super_admin" });
    const ctx = buildContext({
      user: { id: superAdmin.id },
      session: { id: "s" },
      roles: ["super_admin"],
    });
    approvalsService.registerApplyHandler("payout.record", async (_c, _p, tx) => {
      await tx.execute(
        dsql`insert into site_settings (key, value) values ('half_wiped', '1'::jsonb)`,
      );
      // unique violation: aborts the surrounding transaction unless a savepoint isolates it
      await tx.execute(dsql`insert into roles (key) select key from roles limit 1`);
    });
    const partnerId = crypto.randomUUID();
    const { approvalRequestId } = await withTx((tx) =>
      approvalsService.request(
        "payout.record",
        { type: "partner", id: partnerId },
        { partnerId, amountMinor: 1, currency: "INR", paidOn: "2026-09-25", reference: "r" },
        requester.id,
        tx,
      ),
    );

    const res = await approvalsService.approveRequest(ctx, { approvalRequestId });
    expect(res.applied).toBe(false);

    const [row] = await sql<{ status: string; error: string | null }[]>`
      select status, error from approval_requests where id = ${approvalRequestId}`;
    expect(row?.status).toBe("approved");
    expect(row?.error).toContain("roles_pkey"); // the constraint, not just "Failed query: ..."
    const [half] = await sql`select count(*)::int c from site_settings where key = 'half_wiped'`;
    expect(half?.c).toBe(0);
  });
});

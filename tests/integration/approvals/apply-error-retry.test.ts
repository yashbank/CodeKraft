import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createUser } from "../../factories/users";

describe("approvals apply error and retry (PHASE-03 P3.2, API-ADM-04)", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("leaves status approved with error on handler failure, and allows super admin retry", async () => {
    await truncateAll(sql);

    const requester = await createUser({ role: "admin" });
    const superAdmin = await createUser({ role: "super_admin" });

    const superAdminCtx = buildContext({
      user: { id: superAdmin.id },
      session: { id: "sess-superadmin" },
      roles: ["super_admin"],
    });

    let failApply = true;
    approvalsService.registerApplyHandler("payout.record", async () => {
      if (failApply) {
        throw new Error("Temporary banking gateway failure");
      }
    });

    const partnerId = crypto.randomUUID();
    const { approvalRequestId } = await withTx(async (tx) => {
      return await approvalsService.request(
        "payout.record",
        { type: "partner", id: partnerId },
        {
          partnerId,
          amountMinor: 25000,
          currency: "INR",
          paidOn: "2026-09-25",
          reference: "BANK-REF-9999",
        },
        requester.id,
        tx,
      );
    });

    // 1. Initial decision: apply fails
    const initialResult = await approvalsService.approveRequest(superAdminCtx, {
      approvalRequestId,
      comment: "Approved for payout",
    });

    expect(initialResult.status).toBe("approved");
    expect(initialResult.applied).toBe(false);

    // Assert DB state: status approved + error message stored
    const [row] = await sql<{ status: string; error: string | null }[]>`
      select status, error from approval_requests where id = ${approvalRequestId}
    `;
    expect(row?.status).toBe("approved");
    expect(row?.error).toContain("Temporary banking gateway failure");

    // 2. Fix external issue and retry as super admin
    failApply = false;
    const retryResult = await approvalsService.retryApply(superAdminCtx, {
      approvalRequestId,
    });

    expect(retryResult.status).toBe("applied");
    expect(retryResult.applied).toBe(true);

    const [retriedRow] = await sql<{ status: string; error: string | null; applied_at: Date }[]>`
      select status, error, applied_at from approval_requests where id = ${approvalRequestId}
    `;
    expect(retriedRow?.status).toBe("applied");
    expect(retriedRow?.error).toBeNull();
    expect(retriedRow?.applied_at).toBeDefined();
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createUser } from "../../factories/users";

describe("approvals lifecycle integration tests (PHASE-03 P3.2, MASTER_SPEC §4.5)", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("completes full lifecycle: request -> decide (approve) -> applied", async () => {
    await truncateAll(sql);

    // Create 2 admins: requester and approver
    const requester = await createUser({ role: "super_admin" });
    const approver = await createUser({ role: "admin" });

    const approverCtx = buildContext({
      user: { id: approver.id },
      session: { id: "sess-approver" },
      roles: ["admin"],
    });

    let applyHandlerCalled = false;
    approvalsService.registerApplyHandler("ledger.adjustment", async (ctx, payload, _tx) => {
      applyHandlerCalled = true;
      expect(ctx.requestedBy).toBe(requester.id);
      expect(ctx.decidedBy).toBe(approver.id);
      expect(payload.reason).toBe("Correction of inventory valuation");
    });

    // 1. Requester submits approval request
    const { approvalRequestId } = await withTx(async (tx) => {
      return await approvalsService.request(
        "ledger.adjustment",
        { type: "ledger", id: "00000000-0000-0000-0000-000000000010" },
        {
          lines: [
            {
              partyType: "company",
              amountMinor: 5000,
              currency: "INR",
              memo: "Correction of inventory valuation",
            },
          ],
          reason: "Correction of inventory valuation",
        },
        requester.id,
        tx,
      );
    });

    expect(approvalRequestId).toBeDefined();

    // Verify pending status in DB
    const [pendingReq] = await sql<{ status: string }[]>`
      select status from approval_requests where id = ${approvalRequestId}
    `;
    expect(pendingReq?.status).toBe("pending");

    // 2. Approver approves request
    const result = await approvalsService.approveRequest(approverCtx, {
      approvalRequestId,
      comment: "Approved by finance manager",
    });

    expect(result.status).toBe("applied");
    expect(result.applied).toBe(true);
    expect(applyHandlerCalled).toBe(true);

    // Verify applied status and applied_at timestamp in DB
    const [appliedReq] = await sql<{ status: string; applied_at: Date; error: string | null }[]>`
      select status, applied_at, error from approval_requests where id = ${approvalRequestId}
    `;
    expect(appliedReq?.status).toBe("applied");
    expect(appliedReq?.applied_at).toBeDefined();
    expect(appliedReq?.error).toBeNull();
  });
});

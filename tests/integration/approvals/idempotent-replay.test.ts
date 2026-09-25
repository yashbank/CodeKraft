import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createUser } from "../../factories/users";

describe("approvals idempotent replay (docs/06 §1.5, PHASE-03 P3.2)", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("returns idempotent replay when approving a second time after applied", async () => {
    await truncateAll(sql);

    const requester = await createUser({ role: "super_admin" });
    const approver = await createUser({ role: "admin" });

    const approverCtx = buildContext({
      user: { id: approver.id },
      session: { id: "sess-approver" },
      roles: ["admin"],
    });

    let applyCallCount = 0;
    approvalsService.registerApplyHandler("ledger.adjustment", async () => {
      applyCallCount++;
    });

    const { approvalRequestId } = await withTx(async (tx) => {
      return await approvalsService.request(
        "ledger.adjustment",
        { type: "ledger", id: "00000000-0000-0000-0000-000000000004" },
        {
          lines: [
            {
              partyType: "company",
              amountMinor: 1000,
              currency: "INR",
              memo: "Adjustment test",
            },
          ],
          reason: "Adjustment test",
        },
        requester.id,
        tx,
      );
    });

    // First approve -> runs apply
    const firstResult = await approvalsService.approveRequest(approverCtx, {
      approvalRequestId,
      comment: "First approve",
    });

    expect(firstResult.status).toBe("applied");
    expect(firstResult.applied).toBe(true);
    expect(applyCallCount).toBe(1);

    // Second approve -> must not throw, must return idempotent result, must NOT call apply again
    const secondResult = await approvalsService.approveRequest(approverCtx, {
      approvalRequestId,
      comment: "Second approve replay",
    });

    expect(secondResult.status).toBe("applied");
    expect(secondResult.applied).toBe(true);
    expect(applyCallCount).toBe(1);
  });
});

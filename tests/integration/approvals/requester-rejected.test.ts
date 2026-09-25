import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createUser } from "../../factories/users";

describe("approvals self-approval prevention (SA-08, BR-13, PHASE-03 P3.2)", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("prevents requester from approving at the service level AND at the database trigger level", async () => {
    await truncateAll(sql);

    const requester = await createUser({ role: "super_admin" });
    const _otherAdmin = await createUser({ role: "admin" });

    const requesterCtx = buildContext({
      user: { id: requester.id },
      session: { id: "sess-requester" },
      roles: ["super_admin"],
    });

    const productId = crypto.randomUUID();
    const { approvalRequestId } = await withTx(async (tx) => {
      return await approvalsService.request(
        "product.archive",
        { type: "product", id: productId },
        { productId, reason: "End of lifecycle" },
        requester.id,
        tx,
      );
    });

    // 1. Service-level check: must be rejected with FORBIDDEN
    await expect(
      approvalsService.approveRequest(requesterCtx, {
        approvalRequestId,
        comment: "I approve my own request",
      }),
    ).rejects.toThrow(/Requester cannot approve/i);

    // 2. Database-level check: raw INSERT bypassing service must trip the trigger `approver_is_requester`
    await expect(
      sql`
        insert into approval_decisions (request_id, decided_by, decision, comment)
        values (${approvalRequestId}, ${requester.id}, 'approve', 'bypassing service trigger test')
      `,
    ).rejects.toThrow(/approver_is_requester/i);
  });
});

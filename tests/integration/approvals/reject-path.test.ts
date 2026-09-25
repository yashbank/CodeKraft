import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createUser } from "../../factories/users";

describe("approvals reject path integration tests (PHASE-03 P3.2, API-ADM-03)", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("rejects request, executes reject handler, and enforces required comment", async () => {
    await truncateAll(sql);

    const requester = await createUser({ role: "super_admin" });
    const approver = await createUser({ role: "admin" });

    const approverCtx = buildContext({
      user: { id: approver.id },
      session: { id: "sess-approver" },
      roles: ["admin"],
    });

    let rejectHandlerCalled = false;
    approvalsService.registerRejectHandler("product.archive", async (ctx, payload, _tx) => {
      rejectHandlerCalled = true;
      expect(ctx.decidedBy).toBe(approver.id);
      expect(payload.reason).toBe("Product has open warranties");
    });

    const productId = crypto.randomUUID();
    const { approvalRequestId } = await withTx(async (tx) => {
      return await approvalsService.request(
        "product.archive",
        { type: "product", id: productId },
        {
          productId,
          reason: "Product has open warranties",
        },
        requester.id,
        tx,
      );
    });

    // Attempt to reject without comment -> must fail validation
    await expect(
      approvalsService.rejectRequest(approverCtx, {
        approvalRequestId,
        comment: "",
      }),
    ).rejects.toThrow();

    // Reject with valid comment
    const result = await approvalsService.rejectRequest(approverCtx, {
      approvalRequestId,
      comment: "Cannot archive while active warranties exist",
    });

    expect(result.status).toBe("rejected");
    expect(result.applied).toBe(false);
    expect(rejectHandlerCalled).toBe(true);

    const [row] = await sql<{ status: string }[]>`
      select status from approval_requests where id = ${approvalRequestId}
    `;
    expect(row?.status).toBe("rejected");
  });
});

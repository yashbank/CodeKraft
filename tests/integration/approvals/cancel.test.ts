import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createUser } from "../../factories/users";

describe("approvals cancel integration tests (PHASE-03 P3.2, API-ADM-04)", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("allows requester to cancel while pending, and refuses non-requesters", async () => {
    await truncateAll(sql);

    const requester = await createUser({ role: "super_admin" });
    const otherAdmin = await createUser({ role: "admin" });

    const requesterCtx = buildContext({
      user: { id: requester.id },
      session: { id: "sess-requester" },
      roles: ["super_admin"],
    });

    const otherCtx = buildContext({
      user: { id: otherAdmin.id },
      session: { id: "sess-other" },
      roles: ["admin"],
    });

    const productId = crypto.randomUUID();
    const { approvalRequestId } = await withTx(async (tx) => {
      return await approvalsService.request(
        "product.archive",
        { type: "product", id: productId },
        { productId, reason: "Draft mistake" },
        requester.id,
        tx,
      );
    });

    // 1. Non-requester tries to cancel -> FORBIDDEN
    await expect(approvalsService.cancelRequest(otherCtx, { approvalRequestId })).rejects.toThrow(
      /Only the original requester can cancel/i,
    );

    // 2. Requester cancels -> cancelled
    const result = await approvalsService.cancelRequest(requesterCtx, { approvalRequestId });
    expect(result.status).toBe("cancelled");

    const [row] = await sql<{ status: string }[]>`
      select status from approval_requests where id = ${approvalRequestId}
    `;
    expect(row?.status).toBe("cancelled");

    // 3. Trying to cancel again -> STATE_INVALID
    await expect(
      approvalsService.cancelRequest(requesterCtx, { approvalRequestId }),
    ).rejects.toThrow();
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { financeService } from "@/modules/finance/service";
import { approvalsService } from "@/modules/approvals/service";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner } from "../../factories/users";
import { buildContext } from "@/lib/authz/context";
import { AppError } from "@/lib/errors";

describe("adjustment requester self-approval prevention (BR-13, SA-09, API-ADM-02)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("blocks the requesting admin from approving their own adjustment", async () => {
    await truncateAll();

    const admin1 = await createAdmin();
    // Need at least 2 admins in system for approval request to be valid
    await createAdmin();
    const partner = await createPartner();

    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["admin"],
      permissions: [
        "finance.ledger.read",
        "finance.ledger.read_all",
        "finance.adjustment.propose",
        "approvals.decide",
      ],
    });

    const { approvalRequestId } = await financeService.proposeAdjustment(admin1Ctx, {
      lines: [
        {
          partyType: "partner",
          partnerId: partner.id,
          amountMinor: 1000,
          currency: "INR",
          memo: "Self bonus attempt",
        },
      ],
      reason: "Self adjustment attempt",
    });

    // Requester attempting to approve own adjustment request
    await expect(
      approvalsService.approveRequest(admin1Ctx, {
        approvalRequestId,
        comment: "Self approving",
      }),
    ).rejects.toThrow(AppError);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { financeService } from "@/modules/finance/service";
import { approvalsService } from "@/modules/approvals/service";
import { ledgerEntries } from "../../../drizzle/schema/finance";
import { approvalRequests } from "../../../drizzle/schema/approvals";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner } from "../../factories/users";
import { buildContext } from "@/lib/authz/context";

describe("ledger adjustment approval and apply lifecycle (API-FIN-07, API-FIN-08, BR-17, D-517)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("proposes adjustment, approves with second admin, inserts adjustment ledger entry referencing approval", async () => {
    await truncateAll();

    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const partner = await createPartner({ userId: admin1.id });

    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["super_admin"],
    });

    const admin2Ctx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-admin-2" },
      roles: ["super_admin"],
    });

    // Propose adjustment crediting partner 7500 INR
    const { approvalRequestId } = await financeService.proposeAdjustment(admin1Ctx, {
      lines: [
        {
          partyType: "partner",
          partnerId: partner.id,
          amountMinor: 7500,
          currency: "INR",
          memo: "Historical allocation correction",
        },
      ],
      reason: "Correcting missed partner share for batch reconciliation",
    });

    expect(approvalRequestId).toBeDefined();

    // Verify request is pending
    const [req] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, approvalRequestId));
    expect(req?.status).toBe("pending");

    // Admin2 approves
    const decideRes = await approvalsService.approveRequest(admin2Ctx, {
      approvalRequestId,
      comment: "Approved adjustment after verifying ledger audit logs",
    });

    expect(decideRes.status).toBe("applied");

    // Check ledger entry
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.approvalRequestId, approvalRequestId));

    expect(entries.length).toBe(1);
    expect(entries[0]?.entryType).toBe("adjustment");
    expect(entries[0]?.partyType).toBe("partner");
    expect(entries[0]?.partnerId).toBe(partner.id);
    expect(entries[0]?.amountMinor).toBe(7500);
    expect(entries[0]?.approvalRequestId).toBe(approvalRequestId);

    // Partner balance reflects adjustment
    const [bal] = await financeService.getPartnerBalances(admin1Ctx, { partnerId: partner.id });
    expect(bal?.byCurrency[0]?.balance).toBe(7500);
  });
});

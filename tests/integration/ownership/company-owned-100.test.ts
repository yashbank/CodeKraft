import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { ownershipService } from "@/modules/ownership/service";
import { catalogService } from "@/modules/catalog/service";
import { db } from "@/lib/db";
import { productOwnerships, productOwnershipLines } from "../../../drizzle/schema/ownership";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";

describe("company-owned 100 % ownership (no partner lines)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("proposes with no lines, activates on approval, and satisfies the readiness ownership check", async () => {
    await truncateAll();
    const requester = await createAdmin();
    const approver = await createAdmin();
    const requesterCtx = buildContext({
      user: { id: requester.id },
      session: { id: "sess-req" },
      roles: ["admin"],
    });
    const approverCtx = buildContext({
      user: { id: approver.id },
      session: { id: "sess-appr" },
      roles: ["admin"],
    });

    const product = await catalogService.createProduct(requesterCtx, {
      name: "Company Owned",
      slug: "company-owned",
      shortDescription: "Company-owned product",
    });

    const res = await ownershipService.proposeOwnership(requesterCtx, {
      productId: product.productId,
      companyCutBps: 10000,
      lines: [],
    });
    await approvalsService.approveRequest(approverCtx, {
      approvalRequestId: res.approvalRequestId,
    });

    const [own] = await db
      .select()
      .from(productOwnerships)
      .where(eq(productOwnerships.id, res.ownershipId));
    expect(own!.status).toBe("active");
    expect(own!.companyCutBps).toBe(10000);
    const lines = await db
      .select()
      .from(productOwnershipLines)
      .where(eq(productOwnershipLines.ownershipId, res.ownershipId));
    expect(lines).toHaveLength(0);

    // Readiness: submit-for-approval must not fail on the ownership check (offering/image checks may).
    const submit = catalogService.submitForApproval(requesterCtx, { productId: product.productId });
    await expect(submit).rejects.toThrow(/readiness/i);
    await submit.catch((e: Error) => expect(e.message).not.toMatch(/ownership/i));
  });
});

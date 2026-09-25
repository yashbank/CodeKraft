import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { catalogService } from "@/modules/catalog/service";
import { db } from "@/lib/db";
import { products } from "../../../drizzle/schema/catalog";
import { offerings } from "../../../drizzle/schema/offerings";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createOffering } from "../../factories/offerings";

describe("catalog product archive and delete lifecycle (API-CAT-14..15, P3.9)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("handles archive flow: request -> approve -> archived and inactives offerings", async () => {
    await truncateAll();
    const requester = await createAdmin();
    const approver = await createAdmin();

    const requesterCtx = buildContext({
      user: { id: requester.id },
      session: { id: "sess-req-arc" },
      roles: ["admin"],
    });

    const approverCtx = buildContext({
      user: { id: approver.id },
      session: { id: "sess-appr-arc" },
      roles: ["admin"],
    });

    const { productId } = await catalogService.createProduct(requesterCtx, {
      name: "Product To Archive",
      slug: "product-to-archive",
      shortDescription: "Will be archived",
    });

    const off = await createOffering({
      productId,
      status: "active",
      methods: ["manual_upi"],
    });

    // 1. Request archive
    const { approvalRequestId } = await catalogService.requestArchive(requesterCtx, {
      productId,
      reason: "Product end of life",
    });

    // 2. Approve archive
    const approvalRes = await approvalsService.approveRequest(approverCtx, {
      approvalRequestId,
      comment: "Approved archive",
    });
    expect(approvalRes.status).toBe("applied");

    // 3. Verify product is archived and offering is inactive
    const [prodArchived] = await db.select().from(products).where(eq(products.id, productId));
    expect(prodArchived?.status).toBe("archived");
    expect(prodArchived?.archivedAt).toBeDefined();

    const [offInactive] = await db.select().from(offerings).where(eq(offerings.id, off.id));
    expect(offInactive?.status).toBe("inactive");
  });

  it("handles delete flow for product without orders: request -> approve -> deleted", async () => {
    await truncateAll();
    const requester = await createAdmin();
    const approver = await createAdmin();

    const requesterCtx = buildContext({
      user: { id: requester.id },
      session: { id: "sess-req-del" },
      roles: ["admin"],
    });

    const approverCtx = buildContext({
      user: { id: approver.id },
      session: { id: "sess-appr-del" },
      roles: ["admin"],
    });

    const { productId } = await catalogService.createProduct(requesterCtx, {
      name: "Product To Delete",
      slug: "product-to-delete",
      shortDescription: "Will be deleted",
    });

    // 1. Request delete
    const { approvalRequestId } = await catalogService.requestDelete(requesterCtx, {
      productId,
      reason: "Mistakenly created duplicate",
    });

    // 2. Approve delete
    const approvalRes = await approvalsService.approveRequest(approverCtx, {
      approvalRequestId,
      comment: "Approved deletion",
    });
    expect(approvalRes.status).toBe("applied");

    // 3. Verify product row is completely gone
    const [prodGone] = await db.select().from(products).where(eq(products.id, productId));
    expect(prodGone).toBeUndefined();
  });
});

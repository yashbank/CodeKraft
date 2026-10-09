import { beforeAll, describe, expect, it } from "vitest";
import { getDb, withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { mapApprovalToItem, resolveSubjectLabels } from "@/lib/admin/approvals-view";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";

describe("approvals inbox subject labels", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("labels product and user subjects by name, falls back to short id", async () => {
    await truncateAll(sql);
    const requester = await createUser({ role: "super_admin" });
    const target = await createUser({ role: "admin" });
    const product = await createProduct({ name: "Label Widget" });
    const ghostId = crypto.randomUUID();

    await withTx(async (tx) => {
      await approvalsService.request(
        "product.archive",
        { type: "product", id: product.id },
        { productId: product.id, reason: "x" },
        requester.id,
        tx,
      );
      await approvalsService.request(
        "admin.user_change",
        { type: "user", id: target.id },
        { kind: "remove", userId: target.id },
        requester.id,
        tx,
      );
      await approvalsService.request(
        "product.delete",
        { type: "product", id: ghostId },
        { productId: ghostId, reason: "x" },
        requester.id,
        tx,
      );
    });

    const ctx = buildContext({
      user: { id: requester.id },
      session: { id: "s" },
      roles: ["super_admin"],
    });
    const { items } = await approvalsService.listApprovals(ctx, { limit: 25 });
    const labels = await resolveSubjectLabels(getDb(), items);
    const subjects = items.map((a) =>
      mapApprovalToItem(a, new Map(), new Date().toISOString(), labels),
    );

    expect(subjects.map((s) => s.subject).sort()).toEqual(
      ["Label Widget", `Admin change: ${target.email}`, `product ${ghostId.slice(0, 8)}`].sort(),
    );
    expect(subjects.find((s) => s.subject === "Label Widget")?.subjectId).toBe(product.id);
  });
});

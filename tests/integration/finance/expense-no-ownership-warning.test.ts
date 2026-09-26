import { beforeAll, describe, expect, it } from "vitest";
import { financeService } from "@/modules/finance/service";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { buildContext } from "@/lib/authz/context";
import { AppError } from "@/lib/errors";

describe("shared expense validation on product without active ownership (API-FIN-06, docs/06 §2.6)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("fails with VALIDATION when recording shared expense on product without active ownership", async () => {
    await truncateAll();

    const admin = await createAdmin();
    // Product created with draft status and no active ownership
    const product = await createProduct({ createdBy: admin.id });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
      permissions: [
        "finance.ledger.read",
        "finance.ledger.read_all",
        "finance.expense.write",
      ],
    });

    await expect(
      financeService.recordExpense(adminCtx, {
        productId: product.id,
        category: "design",
        description: "Logo design",
        amountMinor: 15000,
        currency: "INR",
        incurredOn: "2026-09-26",
        sharedBySplit: true,
      }),
    ).rejects.toThrow(AppError);
  });
});

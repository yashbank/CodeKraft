import { beforeAll, describe, expect, it } from "vitest";
import { financeService } from "@/modules/finance/service";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner } from "../../factories/users";
import { buildContext } from "@/lib/authz/context";
import { AppError } from "@/lib/errors";

describe("statement export scoping (API-FIN-10, D-1105)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("prevents standard admin from exporting another partner's statement", async () => {
    await truncateAll();

    const admin1 = await createAdmin();
    const admin2 = await createAdmin();

    const partner1 = await createPartner({ userId: admin1.id });
    const partner2 = await createPartner({ userId: admin2.id });

    // admin1 context with admin role (owns partner1, cannot read partner2)
    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["admin"],
    });

    // Attempt to export partner2 statement as admin1
    await expect(
      financeService.exportStatement(admin1Ctx, {
        partnerId: partner2.id,
        dateFrom: "2026-01-01",
        dateTo: "2026-12-31",
        format: "csv",
      }),
    ).rejects.toThrow(AppError);

    // Can export own statement
    const ownRes = await financeService.exportStatement(admin1Ctx, {
      partnerId: partner1.id,
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      format: "csv",
    });

    expect(ownRes.filename).toBeDefined();
  });
});

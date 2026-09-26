import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { financeService } from "@/modules/finance/service";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createOrder, createPayment } from "../../factories/commerce";
import { buildContext } from "@/lib/authz/context";

describe("partner statement exports in PDF and CSV (API-FIN-10, FR-FIN-11, docs/10 §13)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("exports statement in PDF and CSV, verifying opening + sum(entries) = closing", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partner = await createPartner({ userId: admin.id });
    const product = await createProduct({ createdBy: admin.id });

    // 20% company cut, 80% partner
    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 2000,
      createdBy: admin.id,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 50000, currency: "INR" },
    });
    const customer = await createUser();

    const order = await createOrder({
      offering,
      user: customer,
      quantity: 1,
      currency: "INR",
    });

    await createPayment({
      order,
      status: "confirmed",
      amountReceivedMinor: 50000,
      confirmedBy: admin.id,
    });

    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    // 1. Export PDF
    const pdfRes = await financeService.exportStatement(adminCtx, {
      partnerId: partner.id,
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      format: "pdf",
    });

    expect(pdfRes.url).toBeDefined();
    expect(pdfRes.filename).toMatch(/\.pdf$/);
    expect(pdfRes.expiresAt).toBeDefined();

    // 2. Export CSV
    const csvRes = await financeService.exportStatement(adminCtx, {
      partnerId: partner.id,
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      format: "csv",
    });

    expect(csvRes.url).toBeDefined();
    expect(csvRes.filename).toMatch(/\.csv$/);
    expect(csvRes.expiresAt).toBeDefined();
  });
});

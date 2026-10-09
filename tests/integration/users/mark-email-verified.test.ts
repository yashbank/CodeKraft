import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { ordersService } from "@/modules/orders/service";
import { usersService } from "@/modules/users/service";
import { users } from "../../../drizzle/schema/auth";
import { auditLogs } from "../../../drizzle/schema/audit";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

const ACTION = "API-ADM-09 customer.mark_email_verified";

describe("mark customer email verified (API-ADM-09 fallback)", () => {
  getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  const ctxFor = (id: string, role: "super_admin" | "staff") =>
    buildContext({ user: { id }, session: { id: `sess-${id}` }, roles: [role] });
  const verified = async (id: string) =>
    (await db.select().from(users).where(eq(users.id, id)))[0]!.emailVerified;

  it("flips the flag, audits it, is idempotent, and unblocks checkout", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: false });
    const partner = await createPartner({ userId: admin.id });
    const product = await createProduct({ createdBy: admin.id });
    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 1000,
      createdBy: admin.id,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });
    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 5000, currency: "INR" },
    });
    const custCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust" },
      roles: ["user"],
    });
    const order = () =>
      ordersService.createOrder(custCtx, {
        offeringId: offering.id,
        paymentMethod: "manual_upi",
        billing: { name: "T", email: customer.email, country: "IN" },
      });
    await expect(order()).rejects.toMatchObject({ code: ErrorCode.EMAIL_UNVERIFIED });

    const ctx = ctxFor(admin.id, "super_admin");
    const input = { userId: customer.id, reason: "Resend sandbox" };
    await usersService.markCustomerEmailVerified(ctx, input);
    expect(await verified(customer.id)).toBe(true);
    const rows = await db.select().from(auditLogs).where(eq(auditLogs.action, ACTION));
    expect(rows).toHaveLength(1);

    await expect(usersService.markCustomerEmailVerified(ctx, input)).resolves.toBeDefined();
    expect(await db.select().from(auditLogs).where(eq(auditLogs.action, ACTION))).toHaveLength(1);

    await expect(order()).resolves.toBeDefined();
  });

  it("refuses staff callers and admin targets", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const staff = await createUser({ role: "staff" });
    const customer = await createUser({ emailVerified: false });
    const input = { userId: customer.id, reason: "x" };

    await expect(
      usersService.markCustomerEmailVerified(ctxFor(staff.id, "staff"), input),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    expect(await verified(customer.id)).toBe(false);

    await expect(
      usersService.markCustomerEmailVerified(ctxFor(admin.id, "super_admin"), {
        userId: staff.id,
        reason: "x",
      }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });
});

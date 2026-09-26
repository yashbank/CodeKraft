import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { queriesService } from "@/modules/queries/service";
import { createAdmin, createUser } from "../../factories/users";
import { createOrder } from "../../factories/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { queries } from "../../../drizzle/schema/queries";
import { eq } from "drizzle-orm";

describe("Queries Integration (P6.5)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it("creates customer query and deducts duplicate refund requests into existing thread", async () => {
    const customer = await createUser({ email: "query-cust@test.com" });
    const order = await createOrder({ userId: customer.id, status: "paid" });

    // First refund query
    const res1 = await queriesService.createQuery(
      { userId: customer.id, roles: ["customer"] } as any,
      {
        source: "order",
        subject: "Refund request for Order",
        orderId: order.id,
        refundRequest: true,
        bodyJson: { type: "doc", content: [{ type: "paragraph", text: "Please refund my order." }] },
      },
    );

    expect(res1.queryId).toBeDefined();
    expect(res1.existing).toBe(false);

    // Second refund query on same order -> returns existing thread! (BR-09)
    const res2 = await queriesService.createQuery(
      { userId: customer.id, roles: ["customer"] } as any,
      {
        source: "order",
        subject: "Another refund inquiry",
        orderId: order.id,
        refundRequest: true,
        bodyJson: { type: "doc", content: [{ type: "paragraph", text: "Still waiting for refund." }] },
      },
    );

    expect(res2.queryId).toBe(res1.queryId);
    expect(res2.existing).toBe(true);
  });

  it("handles reply status flips and admin assignment", async () => {
    const customer = await createUser({ email: "reply-cust@test.com" });
    const admin = await createAdmin({ email: "admin-reply@test.com" });

    const q = await queriesService.createQuery(
      { userId: customer.id, roles: ["customer"] } as any,
      {
        source: "dashboard",
        subject: "How do I setup webhooks?",
        bodyJson: { type: "doc", content: [{ type: "paragraph", text: "Help with webhooks please." }] },
      },
    );

    // Admin replies -> sets waiting_customer
    const adminReply = await queriesService.replyToQuery(
      { userId: admin.id, roles: ["admin"] } as any,
      {
        queryId: q.queryId,
        bodyJson: { type: "doc", content: [{ type: "paragraph", text: "You can find webhooks in Settings." }] },
      },
    );
    expect(adminReply.status).toBe("waiting_customer");

    // Customer replies -> reopens to open
    const custReply = await queriesService.replyToQuery(
      { userId: customer.id, roles: ["customer"] } as any,
      {
        queryId: q.queryId,
        bodyJson: { type: "doc", content: [{ type: "paragraph", text: "Thank you, that worked!" }] },
      },
    );
    expect(custReply.status).toBe("open");
  });

  it("auto-closes resolved query after 7 days without reply", async () => {
    const customer = await createUser({ email: "autoclose-cust@test.com" });
    const q = await queriesService.createQuery(
      { userId: customer.id, roles: ["customer"] } as any,
      {
        source: "dashboard",
        subject: "General Question",
        bodyJson: { type: "doc", content: [{ type: "paragraph", text: "Question here." }] },
      },
    );

    // Customer marks resolved
    await queriesService.replyToQuery(
      { userId: customer.id, roles: ["customer"] } as any,
      {
        queryId: q.queryId,
        setStatus: "resolved",
        bodyJson: { type: "doc", content: [{ type: "paragraph", text: "Resolved." }] },
      },
    );

    // Simulate 8 days later
    const eightDaysLater = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const outcome = await queriesService.runAutoCloseJob({
      jobId: "autoclose-test",
      now: eightDaysLater,
    });

    expect(outcome.status).toBe("ok");
    expect(outcome.detail.closed).toBeGreaterThanOrEqual(1);

    const db = getDb();
    const updated = await db
      .select()
      .from(queries)
      .where(eq(queries.id, q.queryId))
      .limit(1);

    expect(updated[0].status).toBe("closed");
  });
});

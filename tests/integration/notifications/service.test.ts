import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { notificationsService } from "@/modules/notifications/service";
import { emailOutboxRetryJob } from "@/jobs/email-outbox";
import { createUser } from "../../factories/users";
import { userRoles } from "../../../drizzle/schema/auth";
import { emailOutbox, notifications } from "../../../drizzle/schema/notifications";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { eq } from "drizzle-orm";

describe("Notifications Integration", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it("delivers in-app only to admins, and in-app + email to customers", async () => {
    const db = getDb();
    const admin = await createUser({ email: "admin-notif@test.com", status: "active" });
    await db.insert(userRoles).values({ userId: admin.id, roleKey: "admin" });

    const customer = await createUser({ email: "cust-notif@test.com", status: "active" });

    // Emit to admins
    const adminRes = await notificationsService.emit(
      "admins",
      "lead.new",
      { leadName: "Test Lead", message: "Inquiry" },
      undefined,
      db,
    );

    expect(adminRes.recipients).toContain(admin.id);
    expect(adminRes.emailOutboxIds.length).toBe(0); // Admin gets in-app only

    // Emit to customer
    const custRes = await notificationsService.emit(
      customer.id,
      "order.created",
      { orderNumber: "CK-9999", orderId: "ord-1" },
      ["inapp", "email"],
      db,
    );

    expect(custRes.recipients).toContain(customer.id);
    expect(custRes.emailOutboxIds.length).toBe(1); // Customer gets email queued in outbox
  });

  it("polls notifications and marks as read", async () => {
    const db = getDb();
    const customer = await createUser({ email: "cust-poll@test.com", status: "active" });

    const before = new Date(Date.now() - 1000).toISOString();

    const emitRes = await notificationsService.emit(
      customer.id,
      "order.paid",
      { orderNumber: "CK-7777" },
      ["inapp"],
      db,
    );

    const poll = await notificationsService.pollNotifications(
      { userId: customer.id, roles: ["customer"] } as any,
      { since: before },
    );

    expect(poll.unreadCount).toBeGreaterThanOrEqual(1);
    expect(poll.items.some((i) => i.id === emitRes.notificationIds[0])).toBe(true);

    // Mark as read
    const markRes = await notificationsService.markRead(
      { userId: customer.id, roles: ["customer"] } as any,
      { notificationIds: emitRes.notificationIds },
    );

    expect(markRes.unreadCount).toBe(0);
  });

  it("email outbox retry job processes queued emails", async () => {
    const db = getDb();
    const [row] = await db
      .insert(emailOutbox)
      .values({
        toEmail: "job-test@example.com",
        template: "verify-email",
        payload: { url: "https://codekraft.in/verify" },
        priority: 1,
        status: "queued",
      })
      .returning();

    const jobOutcome = await emailOutboxRetryJob.run();
    expect(jobOutcome.success).toBe(true);

    const updated = await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.id, row.id))
      .limit(1);

    expect(updated[0].status).toBe("sent");
    expect(updated[0].sentAt).toBeDefined();
  });
});


/**
 * Phase 6 Gate Scenarios: Leads, Notifications, Queries, Chat & Analytics
 * Covering: S-14, S-15, SA-15, SA-16, SA-20
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { leadsService } from "@/modules/leads/service";
import { notificationsService } from "@/modules/notifications/service";
import { queriesService } from "@/modules/queries/service";
import { chatService } from "@/modules/chat/service";
import { analyticsService } from "@/modules/analytics/service";
import { FakeProvider } from "@/modules/chat/providers/fake";
import { leadDigestJob } from "@/jobs/lead-digest";
import { chatPurgeJob } from "@/jobs/chat-purge";
import { createAdmin, createUser } from "../../factories/users";
import { createOrder } from "../../factories/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { leads } from "../../../drizzle/schema/leads";
import { queries } from "../../../drizzle/schema/queries";
import { conversations, chatMessages } from "../../../drizzle/schema/chat";
import { eq } from "drizzle-orm";

describe("Phase 6 Gate Scenarios (P6.1..P6.9)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it("Scenario 1 (S-14, SA-16): Public lead creation, Turnstile validation, assignment conflict, and overdue digest", async () => {
    const admin1 = await createAdmin({ email: "lead-admin-1@test.com" });
    const admin2 = await createAdmin({ email: "lead-admin-2@test.com" });

    // Step 1: Turnstile validation & lead creation
    const leadRes = await leadsService.createLead(
      { userId: null, roles: [] } as any,
      {
        source: "inquiry_form",
        name: "Enterprise Buyer",
        email: "enterprise@client.com",
        company: "Global Tech Inc",
        message: "We need custom enterprise architecture and implementation support",
        turnstileToken: "test-valid-token",
      },
    );

    expect(leadRes.leadId).toBeDefined();

    // Step 2: Lead claimed & conflict check (SA-16)
    const claimed = await leadsService.claimLead(
      { userId: admin1.id, roles: ["admin"] } as any,
      { leadId: leadRes.leadId },
    );
    expect(claimed.assignedTo?.id).toBe(admin1.id);

    await expect(
      leadsService.claimLead(
        { userId: admin2.id, roles: ["admin"] } as any,
        { leadId: leadRes.leadId },
      ),
    ).rejects.toThrowError(/already claimed/);

    // Step 3: Status progression & validation
    await leadsService.updateLeadStatus(
      { userId: admin1.id, roles: ["admin"] } as any,
      { leadId: leadRes.leadId, status: "contacted" },
    );

    // Step 4: Overdue digest
    const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    await leadsService.setFollowUp(
      { userId: admin1.id, roles: ["admin"] } as any,
      { leadId: leadRes.leadId, nextFollowUpAt: pastDate },
    );

    const digestOutcome = await leadDigestJob.run(new Date());
    expect(digestOutcome.status).toBe("ok");
    expect(digestOutcome.detail.overdueLeads).toBeGreaterThanOrEqual(1);
    expect(digestOutcome.detail.emailsQueued).toBeGreaterThanOrEqual(1);
  });

  it("Scenario 2 (S-15, SA-20): AI Chatbot lifecycle, menu answers, SSE streaming, no-PII guard, lead confirmation, escalation", async () => {
    const customer = await createUser({ email: "chat-buyer@test.com", emailVerified: true });
    const order = await createOrder({ user: customer, status: "paid" });

    // Step 1: Start conversation
    const started = await chatService.startConversation(
      { userId: customer.id, roles: ["customer"] } as any,
      {},
    );
    expect(started.conversationId).toBeDefined();
    expect(started.menu.length).toBeGreaterThanOrEqual(4);

    // Step 2: Menu answer without LLM call
    const menuRes = await chatService.menuIntent(
      { userId: customer.id, roles: ["customer"] } as any,
      { intent: "order_status" },
    );
    expect(menuRes.messages[0].card?.kind).toBe("order");
    expect(menuRes.messages[0].content).toContain(order.orderNo);

    // Step 3: Stream message with FakeProvider
    const fakeProvider = new FakeProvider();
    const events: any[] = [];

    for await (const evt of chatService.sendMessage(
      { userId: customer.id, roles: ["customer"] } as any,
      { conversationId: started.conversationId, content: "I need a custom software build" },
      fakeProvider,
    )) {
      events.push(evt);
    }

    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).toContain("meta");
    expect(eventTypes).toContain("delta");
    expect(eventTypes).toContain("lead_intent");
    expect(eventTypes).toContain("done");

    // Step 4 (SA-20): Assert Provider request payload contains NO customer PII
    const recordedRequest = fakeProvider.lastRequest;
    expect(recordedRequest).toBeDefined();
    const serializedPayload = JSON.stringify(recordedRequest?.messages);
    expect(serializedPayload).not.toContain(customer.email);
    expect(serializedPayload).not.toContain(order.orderNo);

    // Step 5: Confirm lead capture (API-CHAT-15)
    const confirmedLead = await chatService.confirmLeadCapture(
      { userId: customer.id, roles: ["customer"] } as any,
      {
        conversationId: started.conversationId,
        name: "Enterprise Buyer",
        email: "enterprise@company.com",
        need: "Full platform build",
      },
    );
    expect(confirmedLead.leadId).toBeDefined();

    // Step 6: Escalate to support query
    const escalation = await chatService.escalateConversation(
      { userId: customer.id, roles: ["customer"] } as any,
      { conversationId: started.conversationId, subject: "Complex architecture inquiry" },
    );
    expect(escalation.queryId).toBeDefined();

    const db = getDb();
    const query = await db
      .select()
      .from(queries)
      .where(eq(queries.id, escalation.queryId))
      .limit(1);

    expect(query[0].source).toBe("chatbot");
    expect(query[0].conversationId).toBe(started.conversationId);

    // Step 7: Retention purge sweep
    const outcome = await chatPurgeJob.run(new Date());
    expect(outcome.status).toBe("ok");
  });

  it("Scenario 3: Single open refund query deduplication per order (BR-09)", async () => {
    const customer = await createUser({ email: "refund-user@test.com" });
    const order = await createOrder({ user: customer, status: "paid" });

    const q1 = await queriesService.createQuery(
      { userId: customer.id, roles: ["customer"] } as any,
      {
        source: "order",
        subject: "Refund Request",
        orderId: order.id,
        refundRequest: true,
        bodyJson: { type: "doc", content: [{ type: "paragraph", text: "Please process refund" }] },
      },
    );

    expect(q1.existing).toBe(false);

    // Second refund query returns existing thread
    const q2 = await queriesService.createQuery(
      { userId: customer.id, roles: ["customer"] } as any,
      {
        source: "order",
        subject: "Status of my refund request",
        orderId: order.id,
        refundRequest: true,
        bodyJson: { type: "doc", content: [{ type: "paragraph", text: "Any update?" }] },
      },
    );

    expect(q2.queryId).toBe(q1.queryId);
    expect(q2.existing).toBe(true);
  });
});

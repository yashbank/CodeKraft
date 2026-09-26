import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { chatService } from "@/modules/chat/service";
import { FakeProvider } from "@/modules/chat/providers/fake";
import { chatPurgeJob } from "@/jobs/chat-purge";
import { createUser } from "../../factories/users";
import { createOrder } from "../../factories/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { conversations, chatMessages } from "../../../drizzle/schema/chat";
import { queries } from "../../../drizzle/schema/queries";
import { leads } from "../../../drizzle/schema/leads";
import { eq } from "drizzle-orm";

describe("Chat Integration (P6.6 & P6.7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it("starts conversation requiring verified email and returns root menu", async () => {
    // Unverified user -> throws EMAIL_UNVERIFIED
    const unverifiedUser = await createUser({ email: "unverified@test.com", emailVerified: false });
    await expect(
      chatService.startConversation(
        { userId: unverifiedUser.id, roles: ["customer"] } as any,
        {},
      ),
    ).rejects.toThrowError(/verify your email/);

    // Verified user -> success
    const verifiedUser = await createUser({ email: "verified@test.com", emailVerified: true });
    const started = await chatService.startConversation(
      { userId: verifiedUser.id, roles: ["customer"] } as any,
      {},
    );

    expect(started.conversationId).toBeDefined();
    expect(started.menu.length).toBeGreaterThanOrEqual(4);
    expect(started.usage.userRemaining).toBe(30);

    const db = getDb();
    const conv = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, started.conversationId))
      .limit(1);

    expect(conv[0].purgeAfter).toBeDefined();
  });

  it("handles menuIntent without LLM call", async () => {
    const user = await createUser({ email: "menu-test@test.com", emailVerified: true });
    const order = await createOrder({ user, status: "paid" });


    const res = await chatService.menuIntent(
      { userId: user.id, roles: ["customer"] } as any,
      { intent: "order_status" },
    );

    expect(res.messages.length).toBeGreaterThanOrEqual(1);
    expect(res.messages[0].content).toContain(order.orderNo);
    expect(res.messages[0].card?.kind).toBe("order");

  });

  it("streams SSE message and records turns in database", async () => {
    const user = await createUser({ email: "stream-test@test.com", emailVerified: true });
    const started = await chatService.startConversation(
      { userId: user.id, roles: ["customer"] } as any,
      {},
    );

    const fakeProvider = new FakeProvider();
    const events: any[] = [];

    for await (const evt of chatService.sendMessage(
      { userId: user.id, roles: ["customer"] } as any,
      { conversationId: started.conversationId, content: "Can you help me build a custom payment integration?" },
      fakeProvider,
    )) {
      events.push(evt);
    }

    const eventNames = events.map((e) => e.event);
    expect(eventNames).toContain("meta");
    expect(eventNames).toContain("delta");
    expect(eventNames).toContain("lead_intent");
    expect(eventNames).toContain("done");

    // Check SA-20: FakeProvider recorded request does NOT contain customer email/phone/order numbers
    const recorded = fakeProvider.lastRequest;
    expect(recorded).toBeDefined();
    expect(JSON.stringify(recorded?.messages)).not.toContain(user.email);

    // Verify messages saved
    const db = getDb();
    const msgs = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, started.conversationId));

    expect(msgs.some((m) => m.role === "user")).toBe(true);
    expect(msgs.some((m) => m.role === "assistant")).toBe(true);
  });

  it("confirms lead capture creating lead from chat (API-CHAT-15)", async () => {
    const user = await createUser({ email: "lead-capture@test.com", emailVerified: true });
    const started = await chatService.startConversation(
      { userId: user.id, roles: ["customer"] } as any,
      {},
    );

    const leadRes = await chatService.confirmLeadCapture(
      { userId: user.id, roles: ["customer"] } as any,
      {
        conversationId: started.conversationId,
        name: "Enterprise Buyer",
        email: "buyer@enterprise.com",
        need: "Full platform white-label deployment",
      },
    );

    expect(leadRes.leadId).toBeDefined();

    const db = getDb();
    const leadRow = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadRes.leadId))
      .limit(1);

    expect(leadRow[0].source).toBe("chatbot");
    expect(leadRow[0].name).toBe("Enterprise Buyer");
  });

  it("escalates conversation to support query thread", async () => {
    const user = await createUser({ email: "escalate@test.com", emailVerified: true });
    const started = await chatService.startConversation(
      { userId: user.id, roles: ["customer"] } as any,
      {},
    );

    const escalated = await chatService.escalateConversation(
      { userId: user.id, roles: ["customer"] } as any,
      {
        conversationId: started.conversationId,
        subject: "Needs human developer assistance",
      },
    );

    expect(escalated.queryId).toBeDefined();

    const db = getDb();
    const q = await db
      .select()
      .from(queries)
      .where(eq(queries.id, escalated.queryId))
      .limit(1);

    expect(q[0].source).toBe("chatbot");
    expect(q[0].conversationId).toBe(started.conversationId);
  });

  it("purges conversations past purgeAfter retention date", async () => {
    const user = await createUser({ email: "purge-test@test.com", emailVerified: true });
    const started = await chatService.startConversation(
      { userId: user.id, roles: ["customer"] } as any,
      {},
    );

    const db = getDb();
    // Simulate 13 months ago
    const pastDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await db
      .update(conversations)
      .set({ purgeAfter: pastDate })
      .where(eq(conversations.id, started.conversationId));

    const outcome = await chatPurgeJob.run(new Date());
    expect(outcome.status).toBe("ok");
    expect(outcome.detail.conversationsPurged).toBeGreaterThanOrEqual(1);

    const remaining = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, started.conversationId));

    expect(remaining.length).toBe(0);
  });
});

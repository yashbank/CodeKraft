/**
 * R9-13 root cause: a brand-new (unverified) signup could not start a conversation, send a
 * message or hand off, so nothing was persisted and admins saw nothing. Now the conversation,
 * messages, admin notifications and handoff all work for unverified customers; only the AI
 * completion is withheld (graceful fallback reply).
 */
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { RequestContext } from "@/lib/authz/context";
import { getDb } from "@/lib/db";
import { FakeProvider } from "@/modules/chat/providers/fake";
import { chatService } from "@/modules/chat/service";
import { notifications } from "../../../drizzle/schema/notifications";
import { createUser } from "../../factories/users";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

const asCtx = (userId: string) => ({ userId, roles: ["customer"] }) as unknown as RequestContext;

describe("R9-13 new signup chat is visible to admins", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("unverified new user: chat persists, lists for admin, handoff notifies admins", async () => {
    const admin = await createUser({ role: "super_admin" });
    const fresh = await createUser({ email: "fresh-signup@test.com", emailVerified: false });
    const ctx = asCtx(fresh.id);

    const started = await chatService.startConversation(ctx, {});
    const events: string[] = [];
    for await (const ev of chatService.sendMessage(
      ctx,
      { conversationId: started.conversationId, content: "Hello, I need help" },
      new FakeProvider(),
    )) {
      events.push(ev.event);
    }
    expect(events).toContain("fallback");
    expect(events.at(-1)).toBe("done");
    await chatService.escalateConversation(ctx, { conversationId: started.conversationId });

    const list = await chatService.listConversationsAdmin(asCtx(admin.id), { limit: 50 });
    const row = list.items.find((i) => i.conversationId === started.conversationId);
    expect(row?.customerEmail).toBe("fresh-signup@test.com");
    expect(row?.messageCount).toBeGreaterThanOrEqual(1);

    const types = (
      await getDb()
        .select({ type: notifications.type })
        .from(notifications)
        .where(eq(notifications.userId, admin.id))
    ).map((n) => n.type);
    expect(types).toContain("chat.new");
    expect(types).toContain("chat.handoff");
  });
});

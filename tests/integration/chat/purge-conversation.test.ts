import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { chatService } from "@/modules/chat/service";
import { purgeConversationAction, dryRunAction } from "@/modules/chat/actions";
import { createAdmin, createUser } from "../../factories/users";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { chatMessages, conversations } from "../../../drizzle/schema/chat";

describe("Admin single-conversation purge + dry run", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("purges one conversation and its messages, leaves others, dry run persists nothing", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "s-purge" },
      roles: ["admin"],
    });
    const user = await createUser({ email: "purge@test.com", emailVerified: true });
    const uctx = { userId: user.id, roles: ["customer"] } as any;
    const a = await chatService.startConversation(uctx, {});
    const b = await chatService.startConversation(uctx, {});
    const db = getDb();
    for (const c of [a, b]) {
      await db.insert(chatMessages).values([
        { conversationId: c.conversationId, role: "user", content: "hi" },
        { conversationId: c.conversationId, role: "assistant", content: "hello" },
      ] as any);
    }

    const before = await db.select().from(conversations);
    const res = await purgeConversationAction({ conversationId: a.conversationId }, ctx);
    expect(res.ok && res.data.purged).toBe(true);

    expect(
      await db.select().from(conversations).where(eq(conversations.id, a.conversationId)),
    ).toHaveLength(0);
    expect(
      await db.select().from(chatMessages).where(eq(chatMessages.conversationId, a.conversationId)),
    ).toHaveLength(0);
    expect(
      await db.select().from(chatMessages).where(eq(chatMessages.conversationId, b.conversationId)),
    ).toHaveLength(2);
    expect((await db.select().from(conversations)).length).toBe(before.length - 1);

    const msgsBefore = (await db.select().from(chatMessages)).length;
    const dry = await dryRunAction({ message: "hello" }, ctx);
    expect(dry.ok && dry.data.answer.length).toBeGreaterThan(0);
    expect((await db.select().from(chatMessages)).length).toBe(msgsBefore);
  });
});

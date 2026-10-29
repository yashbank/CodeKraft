/**
 * R8-05/R8-06/R8-08 root causes:
 *  - a chatbot handoff gave admins only a generic query alert; now `chat.handoff` deep-links to
 *    the query thread, and a customer's first chat message raises `chat.new` (once).
 *  - the verified-email gate only covered `startConversation` + `createOrder`; messages, menu
 *    intents, handoff and payment/quote paths were open to unverified customers server-side.
 */
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { RequestContext } from "@/lib/authz/context";
import { getDb } from "@/lib/db";
import { assertEmailVerified } from "@/modules/auth/verified";
import { FakeProvider } from "@/modules/chat/providers/fake";
import { chatService } from "@/modules/chat/service";
import { notifications } from "../../../drizzle/schema/notifications";
import { createUser } from "../../factories/users";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

const asCtx = (userId: string, roles: string[] = ["customer"]) =>
  ({ userId, roles }) as unknown as RequestContext;

describe("chat handoff notifications + verified-email gate", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("handoff notifies every admin with a link to the new query", async () => {
    const admin = await createUser({ role: "super_admin" });
    const customer = await createUser({ name: "Asha Buyer", emailVerified: true });
    const started = await chatService.startConversation(asCtx(customer.id), {});

    const { queryId } = await chatService.escalateConversation(asCtx(customer.id), {
      conversationId: started.conversationId,
      subject: "Need a human",
    });

    const rows = await getDb()
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, admin.id), eq(notifications.type, "chat.handoff")));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.link).toBe(`/admin/queries/${queryId}`);
    expect(rows[0]?.body).toContain("Asha Buyer");
  });

  it("first customer message raises chat.new once per conversation", async () => {
    const admin = await createUser({ role: "admin" });
    const customer = await createUser({ emailVerified: true });
    const started = await chatService.startConversation(asCtx(customer.id), {});
    const provider = new FakeProvider();
    for (const content of ["Hello there", "Second message"]) {
      for await (const _ of chatService.sendMessage(
        asCtx(customer.id),
        { conversationId: started.conversationId, content },
        provider,
      )) {
        // drain the stream
      }
    }
    const rows = await getDb()
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, admin.id), eq(notifications.type, "chat.new")));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.body).toContain("Hello there");
  });

  it("unverified customers are blocked from messages, menu intents and handoff", async () => {
    const customer = await createUser({ emailVerified: false });
    const ctx = asCtx(customer.id);
    await expect(chatService.assertCanChat(ctx)).rejects.toMatchObject({
      code: "EMAIL_UNVERIFIED",
    });
    await expect(
      chatService.menuIntent(ctx, {
        conversationId: "00000000-0000-4000-8000-000000000000",
        intent: "order_status",
      }),
    ).rejects.toMatchObject({ code: "EMAIL_UNVERIFIED" });
    // R9-13: handoff is deliberately open to unverified customers (see r9-13 test).
  });

  it("assertEmailVerified: unverified customer blocked, verified passes, staff exempt", async () => {
    const db = getDb();
    const unverified = await createUser({ emailVerified: false });
    const verified = await createUser({ emailVerified: true });
    const staffUnverified = await createUser({ role: "staff", emailVerified: false });

    await expect(assertEmailVerified(asCtx(unverified.id), db)).rejects.toMatchObject({
      code: "EMAIL_UNVERIFIED",
      httpStatus: 403,
    });
    await expect(assertEmailVerified(asCtx(verified.id), db)).resolves.toBeUndefined();
    await expect(
      assertEmailVerified(asCtx(staffUnverified.id, ["staff"]), db),
    ).resolves.toBeUndefined();
  });
});

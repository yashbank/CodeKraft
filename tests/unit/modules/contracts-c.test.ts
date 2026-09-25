/**
 * P2.7 contracts C — Zod inputs for entitlements, delivery, subscriptions, leads, queries, chat,
 * notifications, analytics, dashboard-widgets (docs/06 §2.5, §2.7 ADM-13/14, §2.8, §2.9, §2.11,
 * §2.13, §3.2 SSE). Fixtures are transcribed from the docs/06 rows.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as entitlements from "@/modules/entitlements";
import * as delivery from "@/modules/delivery";
import * as subscriptions from "@/modules/subscriptions";
import * as leads from "@/modules/leads";
import * as queries from "@/modules/queries";
import * as chat from "@/modules/chat";
import * as notifications from "@/modules/notifications";
import * as analytics from "@/modules/analytics";
import * as widgets from "@/modules/dashboard-widgets";
import { PERMISSIONS } from "@/lib/authz/permissions";
import type { LLMEvent, LLMProvider } from "@/modules/chat";
import type { DeliveryHandler as DH } from "@/modules/delivery";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-09-25T10:15:00.000Z";
const DOC = { type: "doc", content: [{ type: "paragraph" }] };

const bad = (schema: z.ZodType, value: unknown, path?: string) => {
  const r = schema.safeParse(value);
  expect(r.success).toBe(false);
  if (path !== undefined && !r.success) {
    expect(r.error.issues.map((i) => i.path.join("."))).toContain(path);
  }
};
const good = <S extends z.ZodType>(schema: S, value: unknown): z.output<S> => {
  const r = schema.safeParse(value);
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};

describe("module exports expose Zod schemas", () => {
  const modules = {
    entitlements,
    delivery,
    subscriptions,
    leads,
    queries,
    chat,
    notifications,
    analytics,
    widgets,
  };
  for (const [name, mod] of Object.entries(modules)) {
    it(`${name}: every *Schema export is a Zod schema and every *_KEYS/*S tuple is non-empty`, () => {
      const schemaNames = Object.keys(mod).filter((k) => k.endsWith("Schema"));
      expect(schemaNames.length).toBeGreaterThan(0);
      for (const key of schemaNames) {
        const value = (mod as Record<string, unknown>)[key];
        expect(value, key).toBeInstanceOf(z.ZodType);
      }
      for (const key of Object.keys(mod).filter((k) => /^[A-Z_]+$/.test(k))) {
        const value = (mod as Record<string, unknown>)[key];
        if (Array.isArray(value)) expect(value.length, key).toBeGreaterThan(0);
      }
    });
  }
});

describe("entitlements (API-DEL-01/02/03/06/11/12/13/14)", () => {
  it("grantEntitlement requires a reason of ≥ 1 char (MASTER_SPEC §7 manual grants)", () => {
    good(entitlements.grantEntitlementSchema, {
      userId: U1,
      offeringId: U2,
      accessMonths: 12,
      reason: "goodwill",
    });
    good(entitlements.grantEntitlementSchema, {
      userId: U1,
      offeringId: U2,
      accessMonths: null,
      reason: "x",
    });
    bad(entitlements.grantEntitlementSchema, { userId: U1, offeringId: U2 }, "reason");
    bad(entitlements.grantEntitlementSchema, { userId: U1, offeringId: U2, reason: "" }, "reason");
    bad(
      entitlements.grantEntitlementSchema,
      { userId: U1, offeringId: U2, reason: "   " },
      "reason",
    );
    bad(entitlements.grantEntitlementSchema, {
      userId: U1,
      offeringId: U2,
      reason: "ok",
      extra: 1,
    });
  });

  it("revoke/reset/reveal/download inputs", () => {
    good(entitlements.revokeEntitlementSchema, { entitlementId: U1, reason: "refund" });
    bad(entitlements.revokeEntitlementSchema, { entitlementId: U1 }, "reason");
    good(entitlements.resetDownloadCountSchema, { entitlementId: U1 });
    good(entitlements.resetDownloadCountSchema, { entitlementId: U1, newCap: 5 });
    bad(entitlements.resetDownloadCountSchema, { entitlementId: U1, newCap: 0 }, "newCap");
    good(entitlements.issueDownloadLinkSchema, { entitlementId: U1, mediaId: U2 });
    bad(
      entitlements.issueDownloadLinkSchema,
      { entitlementId: "nope", mediaId: U2 },
      "entitlementId",
    );
    good(entitlements.revealLicenseKeySchema, { entitlementId: U1 });
  });

  it("extendAccess takes exactly one of accessEndsAt | periodEnd", () => {
    good(entitlements.extendAccessSchema, { entitlementId: U1, accessEndsAt: NOW, reason: "r" });
    good(entitlements.extendAccessSchema, {
      entitlementId: U1,
      accessEndsAt: null,
      reason: "lifetime",
    });
    good(entitlements.extendAccessSchema, { entitlementId: U1, periodEnd: NOW, reason: "r" });
    bad(entitlements.extendAccessSchema, { entitlementId: U1, reason: "r" });
    bad(entitlements.extendAccessSchema, {
      entitlementId: U1,
      accessEndsAt: NOW,
      periodEnd: NOW,
      reason: "r",
    });
  });

  it("list params follow docs/06 §1.8 (limit default 25, typed sort, strict filters)", () => {
    const parsed = good(entitlements.listEntitlementsAdminSchema, {
      filters: { status: ["active"], provisioningState: "pending" },
    });
    expect(parsed.limit).toBe(25);
    good(entitlements.listEntitlementsAdminSchema, { sort: "createdAt:desc", limit: 100 });
    bad(entitlements.listEntitlementsAdminSchema, { limit: 101 }, "limit");
    bad(entitlements.listEntitlementsAdminSchema, { sort: "foo:asc" }, "sort");
    bad(entitlements.listEntitlementsAdminSchema, { filters: { unknown: 1 } });
  });

  it("EntitlementView output schema accepts a download entitlement and a subscription", () => {
    const view = {
      entitlementId: U1,
      product: { id: U2, name: "Resume Website", slug: "resume-website", published: true },
      offering: { id: U2, name: "Download" },
      deliveryType: "download",
      status: "active",
      access: { startsAt: NOW, endsAt: null },
      updatePolicy: "all_free",
      orderNo: "CK-ORD-000001",
      invoiceNo: "CK/2026-27/0001",
      grantedAt: NOW,
      instructionsHtml: null,
      versions: [{ version: "1.0.0", releasedAt: NOW, changelog: null }],
      downloads: {
        used: 1,
        cap: 3,
        files: [
          {
            mediaId: U2,
            version: "1.0.0",
            name: "site.zip",
            sizeBytes: 10,
            releasedAt: NOW,
            notes: null,
          },
        ],
      },
      subscription: {
        subscriptionId: U2,
        interval: "monthly",
        status: "past_due",
        periodStart: NOW,
        periodEnd: NOW,
        graceUntil: NOW,
        cancelAtPeriodEnd: false,
        renewalOrderNo: null,
        canRenew: true,
      },
    };
    good(entitlements.entitlementViewSchema, view);
    bad(entitlements.entitlementViewSchema, { ...view, status: "paid" }, "status");
    expect(entitlements.DELIVERY_TYPES).toEqual([
      "saas",
      "hosted",
      "download",
      "license",
      "service",
      "custom",
    ]);
    expect(entitlements.SUBSCRIPTION_STATUSES).toContain("past_due");
    expect(entitlements.SUBSCRIPTION_STATUSES).toContain("suspended");
  });
});

describe("delivery (API-DEL-07..10) and DeliveryHandler registry", () => {
  it("completeProvisioning / setLicenseKey / markServiceStep / tasks", () => {
    good(delivery.completeProvisioningSchema, {
      entitlementId: U1,
      notes: { loginUrl: "https://app.example.com", username: "u" },
      credentialsEmail: true,
    });
    bad(delivery.completeProvisioningSchema, {
      entitlementId: U1,
      notes: { loginUrl: "not a url" },
      credentialsEmail: true,
    });
    bad(delivery.completeProvisioningSchema, { entitlementId: U1, notes: {} }, "credentialsEmail");
    good(delivery.setLicenseKeySchema, {
      entitlementId: U1,
      licenseKey: "ABCD-EFGH-1234",
      notifyEmail: true,
    });
    bad(
      delivery.setLicenseKeySchema,
      { entitlementId: U1, licenseKey: "short", notifyEmail: true },
      "licenseKey",
    );
    good(delivery.markServiceStepSchema, { entitlementId: U1, stepKey: "kickoff", done: true });
    good(delivery.listDeliveryTasksSchema, {
      filters: { kind: "revoke_external", status: "open", assignedTo: "me" },
    });
    good(delivery.completeDeliveryTaskSchema, { taskId: U1, note: "done" });
    good(delivery.assignDeliveryTaskSchema, { taskId: U1, assignedTo: null });
  });

  it("registry registers one handler per type and rejects duplicates", () => {
    const registry = delivery.createDeliveryHandlerRegistry();
    const handler: DH<"download"> = {
      type: "download",
      onGranted: async () => ({
        status: "active",
        provisioningState: "n/a",
        taskIds: [],
        emails: [],
      }),
      onRevoked: async () => ({ automatic: true }),
      customerView: () => ({ type: "download", downloads: { used: 0, cap: 3, files: [] } }),
      adminActions: () => [],
      isFulfilled: (e) => e.status === "active",
    };
    expect(registry.has("download")).toBe(false);
    registry.register(handler);
    expect(registry.get("download")).toBe(handler);
    expect(registry.types()).toEqual(["download"]);
    expect(() => registry.register(handler)).toThrow(RangeError);
    expect(() => registry.get("license")).toThrow(RangeError);
  });
});

describe("subscriptions (API-DEL-04/05/14)", () => {
  it("renew / cancel inputs", () => {
    good(subscriptions.renewSubscriptionSchema, { entitlementId: U1, paymentMethod: "manual_upi" });
    good(subscriptions.renewSubscriptionSchema, {
      entitlementId: U1,
      paymentMethod: "manual_bank",
      billing: { name: "A", email: "a@example.com", country: "in" },
    });
    bad(
      subscriptions.renewSubscriptionSchema,
      { entitlementId: U1, paymentMethod: "razorpay" },
      "paymentMethod",
    );
    good(subscriptions.cancelSubscriptionSchema, { entitlementId: U1 });
    const admin = good(subscriptions.cancelSubscriptionAdminSchema, {
      entitlementId: U1,
      reason: "fraud",
    });
    expect(admin.immediate).toBe(false);
    bad(subscriptions.cancelSubscriptionAdminSchema, { entitlementId: U1 }, "reason");
  });
});

describe("leads (API-LEAD-01..07)", () => {
  const base = {
    name: "Asha",
    email: "asha@example.com",
    message: "We need a portal for our clinic.",
  };

  it("public createLead requires a Turnstile token; manual does not", () => {
    good(leads.createLeadSchema, { source: "inquiry_form", ...base, turnstileToken: "tok" });
    bad(leads.createLeadSchema, { source: "inquiry_form", ...base }, "turnstileToken");
    bad(
      leads.createLeadSchema,
      { source: "inquiry_form", ...base, turnstileToken: "" },
      "turnstileToken",
    );
    bad(leads.createLeadSchema, { source: "manual", ...base, turnstileToken: "tok" }, "source");
    bad(
      leads.createLeadSchema,
      { source: "product_cta", ...base, turnstileToken: "tok" },
      "productId",
    );
    good(leads.createLeadSchema, {
      source: "product_cta",
      ...base,
      productId: U1,
      turnstileToken: "tok",
    });
    bad(
      leads.createLeadSchema,
      { source: "inquiry_form", ...base, message: "short", turnstileToken: "tok" },
      "message",
    );
    good(leads.createLeadManualSchema, { source: "manual", name: "Walk-in", phone: "9999999999" });
    bad(leads.createLeadManualSchema, { source: "inquiry_form", ...base }, "source");
    // union: the public branch still demands the token
    bad(leads.leadCreateInputSchema, { source: "inquiry_form", ...base });
    good(leads.leadCreateInputSchema, {
      source: "chatbot",
      conversationId: U1,
      userId: U2,
      ...base,
    });
  });

  it("pipeline transitions and follow-ups", () => {
    good(leads.updateLeadStatusSchema, { leadId: U1, status: "won", wonOrderId: U2 });
    bad(leads.updateLeadStatusSchema, { leadId: U1, status: "lost" }, "lostReason");
    good(leads.updateLeadStatusSchema, { leadId: U1, status: "lost", lostReason: "budget" });
    bad(
      leads.updateLeadStatusSchema,
      { leadId: U1, status: "contacted", wonOrderId: U2 },
      "wonOrderId",
    );
    bad(leads.updateLeadStatusSchema, { leadId: U1, status: "archived" }, "status");
    good(leads.assignLeadSchema, { leadId: U1, assignedTo: null });
    good(leads.addLeadNoteSchema, { leadId: U1, kind: "call", body: "Spoke, call back Monday" });
    bad(leads.addLeadNoteSchema, { leadId: U1, kind: "status_change", body: "x" }, "kind");
    good(leads.setFollowUpSchema, { leadId: U1, nextFollowUpAt: NOW, priority: "high" });
    good(leads.setFollowUpSchema, { leadId: U1, nextFollowUpAt: null });
    good(leads.listLeadsSchema, {
      filters: { assignedTo: "unassigned", overdue: true, status: ["new", "contacted"] },
      sort: "nextFollowUpAt:asc",
    });
    bad(leads.listLeadsSchema, { filters: { assignedTo: "someone" } });
    expect(leads.LEAD_STATUSES).toEqual([
      "new",
      "contacted",
      "qualified",
      "proposal",
      "won",
      "lost",
    ]);
  });
});

describe("queries (API-CHAT-01..05, 14)", () => {
  it("createQuery: refund requests need source order; guests need Turnstile", () => {
    good(queries.createQuerySchema, { subject: "Help", bodyJson: DOC, source: "dashboard" });
    good(queries.createQuerySchema, {
      subject: "Refund",
      bodyJson: DOC,
      source: "order",
      orderId: U1,
      refundRequest: true,
    });
    bad(
      queries.createQuerySchema,
      { subject: "Refund", bodyJson: DOC, source: "dashboard", refundRequest: true },
      "refundRequest",
    );
    bad(
      queries.createQuerySchema,
      { subject: "Refund", bodyJson: DOC, source: "order" },
      "orderId",
    );
    bad(
      queries.createQuerySchema,
      { subject: "Hi", bodyJson: DOC, source: "form", guestEmail: "g@example.com" },
      "turnstileToken",
    );
    good(queries.createQuerySchema, {
      subject: "Hi there",
      bodyJson: DOC,
      source: "form",
      guestEmail: "g@example.com",
      turnstileToken: "t",
    });
    bad(
      queries.createQuerySchema,
      { subject: "Hi there", bodyJson: DOC, source: "dashboard", attachments: [U1, U1, U1, U1] },
      "attachments",
    );
    bad(
      queries.createQuerySchema,
      { subject: "Hi there", bodyJson: DOC, source: "chatbot" },
      "source",
    );
  });

  it("reply / assign / close / reopen / admin create", () => {
    good(queries.replyToQuerySchema, { queryId: U1, bodyJson: DOC, setStatus: "resolved" });
    bad(
      queries.replyToQuerySchema,
      { queryId: U1, bodyJson: DOC, setStatus: "closed" },
      "setStatus",
    );
    good(queries.assignQuerySchema, { queryId: U1, assignedTo: U2 });
    good(queries.closeQuerySchema, { queryId: U1 });
    good(queries.reopenQuerySchema, { queryId: U1 });
    good(queries.createQueryAdminSchema, {
      userId: U1,
      subject: "Inbound",
      bodyJson: DOC,
      source: "email",
    });
    good(queries.createQueryAdminSchema, {
      guestEmail: "x@example.com",
      subject: "Inbound",
      bodyJson: DOC,
      source: "manual",
    });
    bad(
      queries.createQueryAdminSchema,
      { subject: "Inbound", bodyJson: DOC, source: "manual" },
      "userId",
    );
    bad(
      queries.createQueryAdminSchema,
      {
        userId: U1,
        guestEmail: "x@example.com",
        subject: "Inbound",
        bodyJson: DOC,
        source: "manual",
      },
      "guestEmail",
    );
    bad(
      queries.createQueryAdminSchema,
      { userId: U1, subject: "R", bodyJson: DOC, source: "manual", refundRequest: true },
      "orderId",
    );
    good(queries.listQueriesAdminSchema, {
      filters: { status: ["open"], assignedTo: "me" },
      sort: "updatedAt:desc",
    });
  });
});

describe("chat (API-CHAT-06..13, 15, §3.2 SSE)", () => {
  it("inputs", () => {
    good(chat.startConversationSchema, {});
    good(chat.startConversationSchema, { entry: "menu", context: { productSlug: "fitdesk-pro" } });
    good(chat.menuIntentSchema, {
      conversationId: U1,
      intent: "order_status",
      args: { orderNo: "CK-ORD-000001" },
    });
    bad(chat.menuIntentSchema, { conversationId: U1, intent: "refund" }, "intent");
    const msg = good(chat.sendMessageSchema, {
      conversationId: U1,
      content: "  hello\u0000 world  ",
    });
    expect(msg.content).toBe("hello world");
    bad(chat.sendMessageSchema, { conversationId: U1, content: "x".repeat(2001) }, "content");
    bad(chat.sendMessageSchema, { conversationId: U1, content: "   " }, "content");
    good(chat.escalateConversationSchema, { conversationId: U1, summary: "need a human" });
    good(chat.confirmLeadCaptureSchema, { conversationId: U1, need: "Build me a booking portal" });
    bad(chat.confirmLeadCaptureSchema, { conversationId: U1, need: "short" }, "need");
    good(chat.createPromptVersionSchema, {
      name: "default",
      systemPrompt: "Answer only from context.",
    });
    bad(chat.createPromptVersionSchema, { name: "default", systemPrompt: "" }, "systemPrompt");
    good(chat.activatePromptVersionSchema, { promptVersionId: U1 });
    good(chat.rollbackPromptVersionSchema, { name: "default" });
    good(chat.reindexKnowledgeSchema, {});
    good(chat.reindexKnowledgeSchema, { sourceType: "faq" });
    bad(chat.reindexKnowledgeSchema, { sourceType: "blog" }, "sourceType");
  });

  it("SSE event union parses every documented event and rejects unknown ones", () => {
    const events = [
      {
        event: "meta",
        data: { messageId: U1, usage: { userRemaining: 19, platformRemaining: 180 } },
      },
      { event: "delta", data: { text: "Hel" } },
      {
        event: "citations",
        data: { chunks: [{ title: "Refund policy", sourceType: "legal", href: "/legal/refunds" }] },
      },
      { event: "lead_intent", data: { need: "A booking site", email: "a@b.co" } },
      {
        event: "fallback",
        data: { menu: [{ intent: "order_status", label: "Order status" }], reason: "limit" },
      },
      { event: "done", data: { tokensIn: 120, tokensOut: 40, stopReason: "end_turn" } },
      { event: "error", data: { code: "UPSTREAM_UNAVAILABLE", message: "provider down" } },
    ];
    for (const ev of events) {
      const parsed = good(chat.chatSseEventSchema, ev);
      expect(parsed.event).toBe(ev.event);
    }
    expect(events.map((e) => e.event)).toEqual([...chat.CHAT_SSE_EVENTS]);
    bad(chat.chatSseEventSchema, { event: "token", data: { text: "x" } });
    bad(chat.chatSseEventSchema, { event: "lead_intent", data: { name: "x" } });
    bad(chat.chatSseEventSchema, { event: "fallback", data: { menu: [], reason: "bored" } });
    bad(chat.chatSseEventSchema, {
      event: "done",
      data: { tokensIn: -1, tokensOut: 0, stopReason: "end_turn" },
    });
  });

  it("LLMProvider contract: a scripted fake streams text → tool → done", async () => {
    const script: LLMEvent[] = [
      { type: "text", text: "Sure" },
      { type: "tool", id: "t1", name: chat.CAPTURE_LEAD_TOOL.name, input: { need: "portal" } },
      {
        type: "done",
        stopReason: "tool_use",
        usage: { inputTokens: 10, outputTokens: 5 },
        model: "fake",
      },
    ];
    const provider: LLMProvider = {
      id: "fake",
      model: "fake",
      async *stream() {
        yield* script;
      },
    };
    const seen: LLMEvent["type"][] = [];
    for await (const ev of provider.stream("sys", [{ role: "user", content: "hi" }], {
      model: "fake",
      maxTokens: 600,
      timeoutMs: 20_000,
    })) {
      seen.push(ev.type);
    }
    expect(seen).toEqual(["text", "tool", "done"]);
    expect(chat.LLM_STOP_REASONS).toContain("refusal");
    expect(chat.CAPTURE_LEAD_TOOL.inputSchema).toMatchObject({ required: ["need"] });
  });
});

describe("notifications (API-NOTIF-01..04, master plan §5 emit)", () => {
  it("enumerates the docs/06 §2.11 types (29) plus finance.reconcile_failed", () => {
    const docs06 = [
      "order.created",
      "order.paid",
      "payment.submitted",
      "payment.failed",
      "invoice.issued",
      "delivery.task",
      "service.progress",
      "license.ready",
      "subscription.reminder",
      "subscription.grace",
      "subscription.suspended",
      "subscription.cancelled",
      "refund.issued",
      "approval.requested",
      "approval.approved",
      "approval.rejected",
      "lead.new",
      "lead.assigned",
      "lead.overdue_digest",
      "query.new",
      "query.replied",
      "query.customer_replied",
      "product.published",
      "product.updated",
      "quote.sent",
      "entitlement.granted_manually",
      "chat.cap_reached",
      "system.job_failed",
      "system.fx_stale",
    ];
    expect(docs06).toHaveLength(29);
    for (const t of docs06) expect(notifications.NOTIFICATION_TYPES).toContain(t);
    expect(notifications.NOTIFICATION_TYPES).toHaveLength(30);
    expect(new Set(notifications.NOTIFICATION_TYPES).size).toBe(30);
  });

  it("emit input, list/poll/markRead, preferences", () => {
    good(notifications.emitNotificationSchema, {
      target: "admins",
      type: "lead.new",
      payload: { leadId: U1 },
    });
    good(notifications.emitNotificationSchema, {
      target: [U1, U2],
      type: "query.replied",
      payload: {},
      channels: ["inapp", "email"],
    });
    bad(
      notifications.emitNotificationSchema,
      { target: "everyone", type: "lead.new", payload: {} },
      "target",
    );
    bad(
      notifications.emitNotificationSchema,
      { target: U1, type: "lead.deleted", payload: {} },
      "type",
    );
    bad(
      notifications.emitNotificationSchema,
      { target: U1, type: "lead.new", payload: {}, channels: [] },
      "channels",
    );
    good(notifications.listNotificationsSchema, { unreadOnly: true });
    good(notifications.pollNotificationsSchema, { since: NOW });
    bad(notifications.pollNotificationsSchema, { since: "yesterday" }, "since");
    good(notifications.markReadSchema, { notificationIds: [U1] });
    bad(notifications.markReadSchema, { notificationIds: [] }, "notificationIds");
    good(notifications.notificationPreferencesSchema, {
      email: { orderUpdates: true, productUpdates: false },
    });
    bad(
      notifications.notificationPreferencesSchema,
      { email: { orderUpdates: false, productUpdates: false } },
      "email.orderUpdates",
    );
    bad(
      notifications.notificationPreferencesSchema,
      { email: { orderUpdates: true, productUpdates: true, marketing: true } },
      "email.marketing",
    );
  });
});

describe("analytics (API-OPS-01..03, §3.3 job keys)", () => {
  it("trackEvent enum and props limits", () => {
    good(analytics.trackEventSchema, { name: "product_view", productId: U1, anonId: U2 });
    good(analytics.trackEventSchema, {
      name: "checkout_start",
      orderId: U1,
      props: { method: "manual_upi", amount: 100, first: true },
    });
    bad(analytics.trackEventSchema, { name: "purchase" }, "name");
    const tooMany = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]));
    bad(analytics.trackEventSchema, { name: "page_view", props: tooMany }, "props");
    bad(
      analytics.trackEventSchema,
      { name: "page_view", props: { big: "x".repeat(2100) } },
      "props",
    );
    for (const n of [
      "inquiry_submitted",
      "product_view",
      "wishlist_add",
      "checkout_start",
      "payment_submitted",
      "payment_confirmed",
      "signup",
      "login",
      "chat_started",
      "chat_escalated",
      "chat_lead_captured",
      "web_vital",
      "page_view",
    ]) {
      expect(analytics.ANALYTICS_EVENTS).toContain(n);
    }
    for (const n of analytics.CLIENT_ANALYTICS_EVENTS)
      expect(analytics.ANALYTICS_EVENTS).toContain(n);
    good(analytics.webVitalSchema, {
      metric: "LCP",
      value: 1800,
      rating: "good",
      route: "/products/[slug]",
    });
    bad(
      analytics.webVitalSchema,
      { metric: "FID", value: 1, rating: "good", route: "/" },
      "metric",
    );
  });

  it("cron job keys match docs/06 §3.3 and map to their endpoint", () => {
    expect(analytics.FREQUENT_JOB_KEYS).toHaveLength(6);
    expect(analytics.DAILY_JOB_KEYS).toHaveLength(13);
    expect(analytics.CRON_ENDPOINT_FOR_JOB["orders.expire"]).toBe("frequent");
    expect(analytics.CRON_ENDPOINT_FOR_JOB["subscriptions.remind_grace_suspend"]).toBe("daily");
    expect(analytics.CRON_ENDPOINT_FOR_JOB["vitals.rollup"]).toBe("daily");
    good(analytics.listJobRunsSchema, { filters: { job: "fx.refresh", status: "error" } });
    bad(analytics.listJobRunsSchema, { filters: { job: "nope" } });
  });
});

describe("dashboard-widgets (API-ADM-13/14)", () => {
  it("20 widget keys, each with catalog metadata and a real permission", () => {
    expect(widgets.WIDGET_KEYS).toHaveLength(20);
    expect(new Set(widgets.WIDGET_KEYS).size).toBe(20);
    expect(widgets.WIDGET_KEYS).toEqual([
      "revenue_by_period",
      "revenue_by_product",
      "revenue_by_partner",
      "my_share",
      "outstanding_payouts",
      "expenses_vs_profit",
      "payments_awaiting",
      "publish_approvals",
      "split_approvals",
      "service_checklists_due",
      "revocation_tasks",
      "new_leads",
      "pipeline_funnel",
      "overdue_follow_ups",
      "conversion_rate",
      "open_queries",
      "visits_top_products",
      "chatbot_usage",
      "catalog_status_counts",
      "new_customers",
    ]);
    for (const key of widgets.WIDGET_KEYS) {
      const m = widgets.WIDGET_CATALOG[key];
      expect(m.key).toBe(key);
      expect(PERMISSIONS).toContain(m.requiredPermission);
      expect(widgets.WIDGET_GROUPS).toContain(m.group);
      expect(m.minSize.w).toBeLessThanOrEqual(m.defaultSize.w);
      expect(m.minSize.h).toBeLessThanOrEqual(m.defaultSize.h);
      expect(m.defaultSize.w).toBeLessThanOrEqual(widgets.GRID_COLUMNS);
    }
    for (const key of widgets.DEFAULT_WIDGET_KEYS) expect(widgets.WIDGET_KEYS).toContain(key);
  });

  it("layout bounds: 12 columns, x + w ≤ 12, unique keys, known keys only", () => {
    good(widgets.saveDashboardLayoutSchema, {
      layout: [
        { i: "new_leads", x: 0, y: 0, w: 4, h: 4 },
        { i: "open_queries", x: 8, y: 0, w: 4, h: 4 },
      ],
    });
    good(widgets.saveDashboardLayoutSchema, { layout: [] });
    bad(
      widgets.saveDashboardLayoutSchema,
      { layout: [{ i: "new_leads", x: 9, y: 0, w: 4, h: 4 }] },
      "layout.0.w",
    );
    bad(
      widgets.saveDashboardLayoutSchema,
      { layout: [{ i: "new_leads", x: 12, y: 0, w: 1, h: 1 }] },
      "layout.0.x",
    );
    bad(
      widgets.saveDashboardLayoutSchema,
      { layout: [{ i: "new_leads", x: 0, y: 0, w: 0, h: 1 }] },
      "layout.0.w",
    );
    bad(
      widgets.saveDashboardLayoutSchema,
      { layout: [{ i: "new_leads", x: 0, y: -1, w: 1, h: 1 }] },
      "layout.0.y",
    );
    bad(
      widgets.saveDashboardLayoutSchema,
      { layout: [{ i: "weather", x: 0, y: 0, w: 1, h: 1 }] },
      "layout.0.i",
    );
    bad(
      widgets.saveDashboardLayoutSchema,
      {
        layout: [
          { i: "new_leads", x: 0, y: 0, w: 1, h: 1 },
          { i: "new_leads", x: 4, y: 0, w: 1, h: 1 },
        ],
      },
      "layout",
    );
    bad(
      widgets.saveDashboardLayoutSchema,
      { layout: [{ i: "new_leads", x: 0, y: 0, w: 1, h: 1.5 }] },
      "layout.0.h",
    );
    good(widgets.loadWidgetDataSchema, {
      widgetKey: "revenue_by_period",
      params: { range: "fy", currency: "INR" },
    });
    bad(
      widgets.loadWidgetDataSchema,
      { widgetKey: "revenue_by_period", params: { range: "1y" } },
      "params.range",
    );
  });
});

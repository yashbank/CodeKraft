/**
 * Quick-reply menus — API-CHAT-06/07, docs/04 §9 ("menu intents resolve without the LLM"),
 * MASTER_SPEC §7 "Chatbot contact menu" (no public contact details: `contact` offers escalation),
 * docs/09 §11 data minimisation (order status, downloads, renewals and invoices are answered from
 * the caller's own rows, never by the model).
 *
 * `MenuDataSource` is the port; `createDrizzleMenuDataSource` reads the commerce/delivery tables
 * scoped to the caller's user id. Tests swap in a fake.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { products } from "../../../drizzle/schema/catalog";
import { orders } from "../../../drizzle/schema/commerce";
import { entitlements, releaseFiles, subscriptions } from "../../../drizzle/schema/delivery";
import { invoices } from "../../../drizzle/schema/invoices";
import type { MenuAction, MenuIntent, MenuMessage, MenuNode } from "./types";

export const MENU_LIST_LIMIT = 5;

export interface OwnOrder {
  orderNo: string;
  status: string;
  createdAt: Date;
}

export interface OwnDownload {
  entitlementId: string;
  product: string;
  files: Array<{ mediaId: string; name: string; version: string }>;
  downloadsRemaining: number | null;
}

export interface OwnRenewal {
  entitlementId: string;
  product: string;
  periodEnd: Date;
  canRenew: boolean;
}

export interface OwnInvoice {
  invoiceNo: string;
  orderNo: string;
}

/** Reads scoped to one user; every method returns only that user's rows. */
export interface MenuDataSource {
  listOrders(userId: string, limit: number): Promise<OwnOrder[]>;
  findOrder(userId: string, orderNo: string): Promise<OwnOrder | null>;
  listDownloads(userId: string, limit: number): Promise<OwnDownload[]>;
  listRenewals(userId: string, limit: number): Promise<OwnRenewal[]>;
  listInvoices(userId: string, limit: number): Promise<OwnInvoice[]>;
}

// ---------------------------------------------------------------------------------------------
// Menu tree
// ---------------------------------------------------------------------------------------------

export const ROOT_MENU: readonly MenuNode[] = Object.freeze([
  { intent: "order_status", label: "Order status", description: "Where is my order?" },
  { intent: "downloads", label: "Downloads", description: "Files I can download" },
  { intent: "renewal", label: "Renewals", description: "Subscription periods and renewal" },
  { intent: "invoices", label: "Invoices", description: "Invoices for my orders" },
  { intent: "contact", label: "Contact", description: "Reach the CodeKraft team" },
  { intent: "talk_to_human", label: "Talk to a human", description: "Open a support query" },
]);

/** Menu shown with every fallback event (docs/06 §3.2). */
export function fallbackMenu(): MenuNode[] {
  return ROOT_MENU.map((n) => ({ ...n }));
}

const BACK: MenuAction = { label: "Back to menu", intent: "back" };
const HUMAN: MenuAction = { label: "Talk to a human", intent: "talk_to_human" };
/** Client marker: the widget calls `escalateConversation` (API-CHAT-09) — an explicit UI action (TM-08). */
export const ESCALATE_HREF = "#escalate";

function rootActions(): MenuAction[] {
  return ROOT_MENU.map((n) => ({ label: n.label, intent: n.intent }));
}

export function rootMenuMessage(): MenuMessage {
  return {
    role: "menu",
    content: "Hi! I can answer questions about CodeKraft products and services, or help with:",
    actions: rootActions(),
  };
}

export function orderHref(orderNo: string): string {
  return `/account/orders/${encodeURIComponent(orderNo)}`;
}

export function invoiceHref(orderNo: string): string {
  return `${orderHref(orderNo)}/invoice`;
}

function humanStatus(status: string): string {
  return status.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------------------------

export interface ResolveMenuInput {
  userId: string;
  intent: MenuIntent;
  args?: { orderNo?: string } | undefined;
}

/** Resolve one intent to menu bubbles from the caller's own rows. Never calls the LLM. */
export async function resolveMenuIntent(
  source: MenuDataSource,
  input: ResolveMenuInput,
): Promise<MenuMessage[]> {
  const { userId, intent } = input;
  switch (intent) {
    case "back":
      return [rootMenuMessage()];

    case "order_status": {
      const orderNo = input.args?.orderNo?.trim();
      if (orderNo !== undefined && orderNo !== "") {
        const order = await source.findOrder(userId, orderNo);
        if (order === null) {
          return [
            {
              role: "menu",
              content: `I could not find an order ${orderNo} on your account.`,
              actions: [{ label: "My orders", intent: "order_status" }, BACK],
            },
          ];
        }
        return [
          {
            role: "menu",
            content: `Order ${order.orderNo} is ${humanStatus(order.status)}.`,
            actions: [{ label: "Open order", href: orderHref(order.orderNo) }, BACK],
            card: {
              kind: "order",
              orderNo: order.orderNo,
              status: order.status,
              href: orderHref(order.orderNo),
            },
          },
        ];
      }
      const list = await source.listOrders(userId, MENU_LIST_LIMIT);
      if (list.length === 0) {
        return [
          {
            role: "menu",
            content: "You have no orders yet.",
            actions: [{ label: "Browse products", href: "/products" }, BACK],
          },
        ];
      }
      return [
        {
          role: "menu",
          content: "Which order would you like to check?",
          actions: [
            ...list.map((o) => ({
              label: `${o.orderNo} · ${humanStatus(o.status)}`,
              intent: "order_status" as const,
              args: { orderNo: o.orderNo },
            })),
            BACK,
          ],
        },
      ];
    }

    case "downloads": {
      const list = await source.listDownloads(userId, MENU_LIST_LIMIT);
      if (list.length === 0) {
        return [
          {
            role: "menu",
            content: "You have no downloadable products at the moment.",
            actions: [{ label: "Browse products", href: "/products" }, BACK],
          },
        ];
      }
      return list.map((d) => ({
        role: "menu",
        content:
          d.downloadsRemaining === null
            ? `${d.product}: your files are ready to download.`
            : `${d.product}: ${d.downloadsRemaining} download${d.downloadsRemaining === 1 ? "" : "s"} remaining.`,
        actions: [{ label: "Go to downloads", href: "/account/downloads" }, BACK],
        card: {
          kind: "downloads",
          entitlementId: d.entitlementId,
          product: d.product,
          files: d.files,
          downloadsRemaining: d.downloadsRemaining,
        },
      }));
    }

    case "renewal": {
      const list = await source.listRenewals(userId, MENU_LIST_LIMIT);
      if (list.length === 0) {
        return [
          {
            role: "menu",
            content: "You have no subscriptions to renew.",
            actions: [BACK],
          },
        ];
      }
      return list.map((r) => ({
        role: "menu",
        content: `${r.product}: current period ends on ${r.periodEnd.toISOString().slice(0, 10)}.${r.canRenew ? " You can renew from your dashboard." : ""}`,
        actions: [{ label: "Manage subscription", href: "/account/subscriptions" }, BACK],
        card: {
          kind: "renewal",
          entitlementId: r.entitlementId,
          product: r.product,
          periodEnd: r.periodEnd.toISOString(),
          canRenew: r.canRenew,
        },
      }));
    }

    case "invoices": {
      const list = await source.listInvoices(userId, MENU_LIST_LIMIT);
      if (list.length === 0) {
        return [{ role: "menu", content: "No invoices have been issued yet.", actions: [BACK] }];
      }
      return list.map((i) => ({
        role: "menu",
        content: `Invoice ${i.invoiceNo} for order ${i.orderNo}.`,
        actions: [{ label: "Open invoice", href: invoiceHref(i.orderNo) }, BACK],
        card: { kind: "invoice", invoiceNo: i.invoiceNo, orderNo: i.orderNo, href: invoiceHref(i.orderNo) },
      }));
    }

    case "contact":
      // D-808 / MASTER_SPEC §7: no public phone or email; contact = open a support query.
      return [
        {
          role: "menu",
          content:
            "The fastest way to reach the CodeKraft team is a support query: an admin replies in your account and by email. Shall I open one with this conversation attached?",
          actions: [HUMAN, BACK],
        },
      ];

    case "talk_to_human":
      return [
        {
          role: "menu",
          content:
            "I will hand this conversation to the team as a support query (the transcript is attached so you do not have to repeat yourself). Confirm to continue.",
          actions: [{ label: "Create a support query", href: ESCALATE_HREF }, BACK],
        },
      ];
  }
}

// ---------------------------------------------------------------------------------------------
// Drizzle data source (own rows only)
// ---------------------------------------------------------------------------------------------

export function createDrizzleMenuDataSource(db: DbOrTx): MenuDataSource {
  return {
    async listOrders(userId, limit) {
      return db
        .select({ orderNo: orders.orderNo, status: orders.status, createdAt: orders.createdAt })
        .from(orders)
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt))
        .limit(limit);
    },

    async findOrder(userId, orderNo) {
      const rows = await db
        .select({ orderNo: orders.orderNo, status: orders.status, createdAt: orders.createdAt })
        .from(orders)
        .where(and(eq(orders.userId, userId), eq(orders.orderNo, orderNo)))
        .limit(1);
      return rows[0] ?? null;
    },

    async listDownloads(userId, limit) {
      const rows = await db
        .select({
          entitlementId: entitlements.id,
          productId: entitlements.productId,
          product: products.name,
          downloadCap: entitlements.downloadCap,
          downloadsUsed: entitlements.downloadsUsed,
        })
        .from(entitlements)
        .innerJoin(products, eq(products.id, entitlements.productId))
        .where(
          and(
            eq(entitlements.userId, userId),
            eq(entitlements.status, "active"),
            eq(entitlements.deliveryType, "download"),
          ),
        )
        .orderBy(desc(entitlements.createdAt))
        .limit(limit);
      if (rows.length === 0) return [];
      const files = await db
        .select({
          productId: releaseFiles.productId,
          mediaId: releaseFiles.mediaId,
          version: releaseFiles.version,
        })
        .from(releaseFiles)
        .where(
          inArray(
            releaseFiles.productId,
            rows.map((r) => r.productId),
          ),
        )
        .orderBy(desc(releaseFiles.releasedAt));
      return rows.map((r) => ({
        entitlementId: r.entitlementId,
        product: r.product,
        files: files
          .filter((f) => f.productId === r.productId)
          .slice(0, 3)
          .map((f) => ({ mediaId: f.mediaId, name: `${r.product} ${f.version}`, version: f.version })),
        downloadsRemaining:
          r.downloadCap === null ? null : Math.max(0, r.downloadCap - r.downloadsUsed),
      }));
    },

    async listRenewals(userId, limit) {
      const rows = await db
        .select({
          entitlementId: entitlements.id,
          product: products.name,
          periodEnd: subscriptions.currentPeriodEnd,
          status: subscriptions.status,
          cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        })
        .from(subscriptions)
        .innerJoin(entitlements, eq(entitlements.id, subscriptions.entitlementId))
        .innerJoin(products, eq(products.id, entitlements.productId))
        .where(eq(entitlements.userId, userId))
        .orderBy(subscriptions.currentPeriodEnd)
        .limit(limit);
      return rows.map((r) => ({
        entitlementId: r.entitlementId,
        product: r.product,
        periodEnd: r.periodEnd,
        canRenew: (r.status === "active" || r.status === "past_due") && !r.cancelAtPeriodEnd,
      }));
    },

    async listInvoices(userId, limit) {
      return db
        .select({ invoiceNo: invoices.invoiceNo, orderNo: orders.orderNo })
        .from(invoices)
        .innerJoin(orders, eq(orders.id, invoices.orderId))
        .where(eq(orders.userId, userId))
        .orderBy(desc(invoices.issuedAt))
        .limit(limit);
    },
  };
}

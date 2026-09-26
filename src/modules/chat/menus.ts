import { desc, eq } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import { getDb } from "@/lib/db";
import { orders } from "../../../drizzle/schema/commerce";
import { entitlements, subscriptions } from "../../../drizzle/schema/delivery";
import { invoices } from "../../../drizzle/schema/invoices";
import type { MenuIntentInput, MenuIntentResult, MenuMessage, MenuNode } from "./types";

export const ROOT_MENU_NODES: MenuNode[] = [
  { intent: "order_status", label: "Order Status", description: "Check status of your recent purchases" },
  { intent: "downloads", label: "Downloads & Files", description: "Access software files and downloads" },
  { intent: "renewal", label: "Subscriptions", description: "Manage subscription renewals" },
  { intent: "invoices", label: "Invoices", description: "Download tax invoices" },
  { intent: "talk_to_human", label: "Contact Support", description: "Escalate to a human support query" },
];

export async function resolveMenuIntent(
  ctx: RequestContext,
  input: MenuIntentInput,
): Promise<MenuIntentResult> {
  const db = getDb();
  const userId = ctx.userId;

  switch (input.intent) {
    case "order_status": {
      const recentOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt))
        .limit(3);

      if (recentOrders.length === 0) {
        return {
          messages: [
            {
              role: "menu",
              content: "You don't have any recent orders on your account.",
              actions: [{ label: "Browse Catalog", href: "/products" }, { label: "Main Menu", intent: "back" }],
            },
          ],
        };
      }

      const messages: MenuMessage[] = recentOrders.map((o) => {
        const orderNo = (o as any).orderNo ?? (o as any).orderNumber ?? "Order";
        return {
          role: "menu",
          content: `Order #${orderNo}: Status is ${o.status}.`,
          actions: [{ label: "View Order", href: `/account/orders/${o.id}` }],
          card: {
            kind: "order",
            orderNo,
            status: o.status,
            href: `/account/orders/${o.id}`,
          },
        };
      });


      return { messages };
    }

    case "downloads": {
      const ents = await db
        .select()
        .from(entitlements)
        .where(eq(entitlements.userId, userId))
        .limit(3);

      if (ents.length === 0) {
        return {
          messages: [
            {
              role: "menu",
              content: "No active download entitlements found on your account.",
              actions: [{ label: "Main Menu", intent: "back" }],
            },
          ],
        };
      }

      return {
        messages: [
          {
            role: "menu",
            content: `You have ${ents.length} active purchase(s). View your files in the portal:`,
            actions: [{ label: "Go to Purchases", href: "/account/purchases" }, { label: "Main Menu", intent: "back" }],
          },
        ],
      };
    }

    case "renewal": {
      const subs = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(3);

      if (subs.length === 0) {
        return {
          messages: [
            {
              role: "menu",
              content: "You have no active recurring subscriptions.",
              actions: [{ label: "Main Menu", intent: "back" }],
            },
          ],
        };
      }

      return {
        messages: subs.map((s) => ({
          role: "menu",
          content: `Subscription status: ${s.status}. Current period ends: ${s.currentPeriodEnd.toISOString().slice(0, 10)}.`,
          actions: [{ label: "Manage Subscriptions", href: "/account/purchases" }],
        })),
      };
    }

    case "invoices": {
      const invs = await db
        .select()
        .from(invoices)
        .where(eq(invoices.userId, userId))
        .limit(3);

      if (invs.length === 0) {
        return {
          messages: [
            {
              role: "menu",
              content: "No tax invoices generated yet.",
              actions: [{ label: "Main Menu", intent: "back" }],
            },
          ],
        };
      }

      return {
        messages: [
          {
            role: "menu",
            content: `Found ${invs.length} tax invoice(s). Access your invoice history:`,
            actions: [{ label: "View Invoices", href: "/account/invoices" }, { label: "Main Menu", intent: "back" }],
          },
        ],
      };
    }

    case "contact":
    case "talk_to_human": {
      return {
        messages: [
          {
            role: "menu",
            content: "Would you like to connect with a team member? You can escalate this chat to a support ticket.",
            actions: [
              { label: "Create Support Query", href: "/account/queries/new" },
              { label: "Main Menu", intent: "back" },
            ],
          },
        ],
      };
    }

    case "back":
    default: {
      return {
        messages: [
          {
            role: "menu",
            content: "How can I assist you today? Please choose an option:",
            actions: ROOT_MENU_NODES.map((n) => ({ label: n.label, intent: n.intent })),
          },
        ],
      };
    }
  }
}

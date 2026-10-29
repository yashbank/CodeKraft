"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { AdminShell, type AdminRoute } from "./AdminShell";
import { KeyboardShortcutsSheet } from "./KeyboardShortcutsSheet";
import type { AdminNotification, AdminUserRef } from "./types";
import { searchAdmin } from "@/lib/admin/global-search";
import { mapNotificationItem } from "@/lib/admin/notifications-view";
import {
  markAllNotificationsRead,
  markNotificationsRead,
} from "@/modules/notifications/admin-mutations";
import type { PollNotificationsResult } from "@/modules/notifications/types";
import { orderAlertText, type NewOrderAlerts } from "@/modules/orders/alerts-text";
import { PRIYA } from "@/app/dev/screens/_fixtures/admin";

const ADMIN_ROUTE_MAP: Record<string, string> = {
  "/dashboard": "/admin/dashboard",
  "/approvals": "/admin/approvals",
  "/notifications": "/admin/notifications",
  "/products": "/admin/products",
  "/categories": "/admin/categories",
  "/coupons": "/admin/coupons",
  "/orders": "/admin/orders",
  "/quotes": "/admin/quotes",
  "/customers": "/admin/customers",
  "/entitlements": "/admin/entitlements",
  "/delivery-tasks": "/admin/delivery-tasks",
  "/leads": "/admin/leads",
  "/queries": "/admin/queries",
  "/chatbot": "/admin/chatbot",
  "/finance/ledger": "/admin/finance/ledger",
  "/finance/allocations": "/admin/finance/allocations",
  "/finance/partners": "/admin/finance/partners",
  "/finance/expenses": "/admin/finance/expenses",
  "/finance/adjustments": "/admin/finance/adjustments",
  "/finance/reports": "/admin/finance/reports",
  "/content/landing": "/admin/content/landing",
  "/content/services": "/admin/content/services",
  "/content/case-studies": "/admin/content/case-studies",
  "/content/testimonials": "/admin/content/testimonials",
  "/content/blog": "/admin/content/blog",
  "/content/faqs": "/admin/content/faqs",
  "/content/legal": "/admin/content/legal",
  "/settings": "/admin/settings",
  "/audit": "/admin/audit",
  "/admin-users": "/admin/admin-users",
  "/products/new": "/admin/products/new",
  "/orders/new": "/admin/orders/new",
};

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/approvals": "Approvals",
  "/notifications": "Notifications",
  "/products": "Products",
  "/categories": "Categories",
  "/coupons": "Coupons",
  "/orders": "Orders",
  "/quotes": "Quotes",
  "/customers": "Customers",
  "/entitlements": "Entitlements",
  "/delivery-tasks": "Delivery Tasks",
  "/leads": "Leads",
  "/leads/board": "Leads",
  "/queries": "Queries",
  "/chatbot": "Chatbot Monitor",
  "/finance/ledger": "Ledger",
  "/finance/allocations": "Allocations",
  "/finance/partners": "Partners & Payouts",
  "/finance/expenses": "Expenses",
  "/finance/adjustments": "Adjustments",
  "/finance/reports": "Reports & Statements",
  "/content/landing": "Landing Editor",
  "/content/services": "Services Editor",
  "/content/case-studies": "Case Studies Editor",
  "/content/testimonials": "Testimonials & Logos",
  "/content/blog": "Blog",
  "/content/faqs": "FAQs Editor",
  "/content/legal": "Legal Pages",
  "/settings": "Settings",
  "/audit": "Audit Log",
  "/admin-users": "Admin Users",
};

interface AdminShellWrapperProps {
  user?: AdminUserRef;
  pendingApprovals?: number;
  notifications?: AdminNotification[];
  unreadCount?: number;
  environment?: "development" | "staging" | "production";
  children: React.ReactNode;
}

export function AdminShellWrapper({
  user = PRIYA,
  pendingApprovals = 0,
  notifications = [],
  unreadCount,
  environment = "development",
  children,
}: AdminShellWrapperProps) {
  const pathname = usePathname();
  useLiveAdminNotifications(unreadCount ?? 0);
  useLiveOrderAlerts();

  // Strip /admin prefix if present, or keep path
  let active: AdminRoute = "/dashboard";
  if (pathname === "/admin" || pathname === "/" || pathname === "/dashboard") {
    active = "/dashboard";
  } else if (pathname.startsWith("/admin/")) {
    active = pathname.replace(/^\/admin/, "");
  } else {
    active = pathname;
  }

  const title = ROUTE_TITLES[active] || "Admin Console";

  return (
    <AdminShell
      active={active}
      user={user}
      environment={environment}
      pendingApprovals={pendingApprovals}
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkAllRead={() => void markAllNotificationsRead()}
      onMarkRead={(id) => markNotificationsRead({ notificationIds: [id] })}
      now={new Date().toISOString()}
      title={title}
      routes={ADMIN_ROUTE_MAP}
      onSearch={searchAdmin}
    >
      <KeyboardShortcutsSheet area="admin" />
      {children}
    </AdminShell>
  );
}

/** Poll interval for new admin notifications (docs/09 §7 caps polling at 30/min per session). */
export const ADMIN_NOTIFICATION_POLL_MS = 20_000;

/**
 * R8-06: the admin layout only loads unread notifications on a full server render, so a new
 * chatbot conversation / handoff / query never surfaced until a hard reload. Poll
 * `GET /api/notifications` while the tab is visible, prepend new items to the bell, and toast
 * each one with an "Open" action.
 */
function useLiveAdminNotifications(unreadCount: number): void {
  const router = useRouter();
  const sinceRef = React.useRef<string>(new Date().toISOString());
  const countRef = React.useRef(unreadCount);
  countRef.current = unreadCount;

  React.useEffect(() => {
    let stopped = false;
    async function poll() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(
          `/api/notifications?since=${encodeURIComponent(sinceRef.current)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { ok: boolean; data?: PollNotificationsResult };
        if (!body.ok || !body.data) return;
        sinceRef.current = body.data.serverTime;
        const fresh = body.data.items.map(mapNotificationItem);
        // Layout is the single source of bell list + badge: re-render it on new items or count drift.
        if (fresh.length > 0 || body.data.unreadCount !== countRef.current) router.refresh();
        for (const n of fresh.slice(0, 3)) {
          const href = n.href;
          toast(n.title, {
            description: n.body,
            ...(href ? { action: { label: "Open", onClick: () => router.push(href) } } : {}),
          });
        }
      } catch {
        // Offline / transient failure: the next tick retries.
      }
    }
    const id = window.setInterval(() => void poll(), ADMIN_NOTIFICATION_POLL_MS);
    const onVisible = () => void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
}

/** Poll interval for the "New order" toast; light endpoint, polling only (no websockets). */
export const ORDER_ALERT_POLL_MS = 45_000;

/** P14-12a: toast "New order #CK-…" with an Open action when an order arrives while the tab is open. */
function useLiveOrderAlerts(): void {
  const router = useRouter();
  const sinceRef = React.useRef<string>(new Date().toISOString());

  React.useEffect(() => {
    let stopped = false;
    async function poll() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(
          `/api/admin/orders/alerts?since=${encodeURIComponent(sinceRef.current)}`,
          { cache: "no-store" },
        );
        // No orders.read (staff without it) or signed out: stop polling for good.
        if (res.status === 401 || res.status === 403) {
          stopped = true;
          return;
        }
        if (!res.ok) return;
        const body = (await res.json()) as { ok: boolean; data?: NewOrderAlerts };
        if (!body.ok || !body.data) return;
        sinceRef.current = body.data.serverTime;
        if (body.data.count === 0) return;
        const { count, latest } = body.data;
        const first = latest[0];
        toast(orderAlertText(body.data), {
          action: {
            label: "Open",
            onClick: () =>
              router.push(count === 1 && first ? `/admin/orders/${first.id}` : "/admin/orders"),
          },
        });
        router.refresh();
      } catch {
        // Offline / transient failure: the next tick retries.
      }
    }
    const id = window.setInterval(() => void poll(), ORDER_ALERT_POLL_MS);
    const onVisible = () => void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
}

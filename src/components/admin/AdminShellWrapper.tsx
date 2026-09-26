"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import { AdminShell, type AdminRoute } from "./AdminShell";
import type { AdminNotification, AdminUserRef } from "./types";
import { NOTIFICATIONS as initialNotifications, PRIYA } from "@/app/dev/screens/_fixtures/admin";

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
  "/content/faqs": "FAQs Editor",
  "/content/legal": "Legal Pages",
  "/settings": "Settings",
  "/audit": "Audit Log",
  "/admin-users": "Admin Users",
};

interface AdminShellWrapperProps {
  user?: AdminUserRef;
  children: React.ReactNode;
}

export function AdminShellWrapper({
  user = PRIYA,
  children,
}: AdminShellWrapperProps) {
  const pathname = usePathname();

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
      environment="development"
      pendingApprovals={3}
      notifications={initialNotifications}
      now={new Date().toISOString()}
      title={title}
      routes={ADMIN_ROUTE_MAP}
    >
      {children}
    </AdminShell>
  );
}

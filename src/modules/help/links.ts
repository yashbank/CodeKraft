/**
 * Role-checked "Open screen" links for help answers. Free: no model call.
 * Convention: a link `path` is a same-site absolute path. Admin screens are canonicalised to
 * "/admin/<screen>" (guides may write the bare "/orders" form); the UI turns that into the right host.
 * Staff/admin links reuse canOpenAdminRoute (same guard as the admin layout); partners and customers
 * only get their own "/account" area.
 */
import { canOpenAdminRoute } from "@/lib/authz/admin-routes";
import type { Role } from "@/lib/authz/permissions";
import type { HelpRole } from "./knowledge";

export interface HelpLink {
  label: string;
  path: string;
}
export interface HelpRelated {
  id: string;
  title: string;
}

export const MAX_LINKS = 3;
const MAX_LABEL = 60;

/** First path segment of every admin screen (src/app/(admin)/admin/*). */
const ADMIN_SCREENS = new Set([
  "dashboard",
  "approvals",
  "audit",
  "categories",
  "chatbot",
  "content",
  "coupons",
  "customers",
  "delivery-tasks",
  "email-preview",
  "entitlements",
  "finance",
  "leads",
  "notifications",
  "orders",
  "products",
  "queries",
  "quotes",
  "settings",
  "admin-users",
]);

const ADMIN_ROLES: readonly HelpRole[] = ["staff", "admin", "super_admin"];
const SAFE = /^\/(?!\/)[\w\-./?=&#%]*$/;

function normaliseAdmin(path: string): string | null {
  const m = /^\/admin(\/.*)?$/.exec(path);
  if (m) return path;
  const seg = /^\/([\w-]+)/.exec(path)?.[1];
  return seg && ADMIN_SCREENS.has(seg) ? `/admin${path}` : null;
}

/** The link as the viewer may open it, or null. */
export function checkLink(link: unknown, role: HelpRole): HelpLink | null {
  if (!link || typeof link !== "object") return null;
  const { label, path } = link as { label?: unknown; path?: unknown };
  if (typeof label !== "string" || typeof path !== "string") return null;
  const text = label.replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_LABEL);
  if (!text || !SAFE.test(path)) return null;
  if (ADMIN_ROLES.includes(role)) {
    const admin = normaliseAdmin(path);
    if (!admin || !canOpenAdminRoute([role as Role], admin)) return null;
    return { label: text, path: admin };
  }
  if (role === "customer" || role === "partner")
    return /^\/account(\/|$|\?|#)/.test(path) ? { label: text, path } : null;
  return null;
}

/** Up to MAX_LINKS unique, openable links from a guide's `links` field (absent field = none). */
export function visibleLinks(raw: unknown, role: HelpRole): HelpLink[] {
  if (!Array.isArray(raw)) return [];
  const out: HelpLink[] = [];
  for (const l of raw) {
    const ok = checkLink(l, role);
    if (ok && !out.some((o) => o.path === ok.path)) out.push(ok);
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

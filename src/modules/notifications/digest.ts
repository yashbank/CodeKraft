/**
 * Admin overdue digest builder (PHASE-06 P6.4, R-701, D-706, D-607): turns one admin's
 * `OverdueDigestForAdmin` slice into the `lead.overdue_digest` notification payload, which the
 * email channel forwards as the `admin-overdue-digest` template data (docs/12 §7).
 */
import type { NotificationPayload } from "./types";

export interface DigestLead {
  leadId: string;
  name: string;
  nextFollowUpAt: string;
  daysOverdue: number;
}
export interface DigestRevokeTask {
  taskId: string;
  product: string;
  customerEmail: string;
  openSince: string;
}
export interface DigestSlice {
  adminId: string;
  email: string;
  leads: DigestLead[];
  revokeTasks: DigestRevokeTask[];
}

/** Lists are capped so the payload / email stay bounded; counts are always exact. */
export const DIGEST_MAX_ITEMS = 50;

export function isDigestEmpty(slice: Pick<DigestSlice, "leads" | "revokeTasks">): boolean {
  return slice.leads.length === 0 && slice.revokeTasks.length === 0;
}

export function buildOverdueDigestPayload(slice: DigestSlice, now: Date): NotificationPayload {
  const leads = [...slice.leads]
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, DIGEST_MAX_ITEMS);
  const revokeTasks = [...slice.revokeTasks]
    .sort((a, b) => a.openSince.localeCompare(b.openSince))
    .slice(0, DIGEST_MAX_ITEMS);
  return {
    overdueLeads: slice.leads.length,
    openRevokeTasks: slice.revokeTasks.length,
    leads,
    revokeTasks,
    truncated: slice.leads.length > leads.length || slice.revokeTasks.length > revokeTasks.length,
    generatedAt: now.toISOString(),
    leadsLink: "/leads?overdue=true",
    tasksLink: "/delivery/tasks?kind=revoke_external&status=open",
  };
}

/** `daysOverdue` for a follow-up date: whole days past `nextFollowUpAt` (≥ 0). */
export function daysOverdue(nextFollowUpAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - nextFollowUpAt.getTime()) / 86_400_000));
}

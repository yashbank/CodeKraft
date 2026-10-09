/**
 * View-model mappers for the admin Leads screens (SCR-ADM-13 list/board, SCR-ADM-?? detail) —
 * `modules/leads` service shapes -> `components/admin/types.ts` prop shapes. Kept out of the
 * page components and out of the screen components, per the `finance-view.ts` / `customers-view.ts`
 * convention.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `LeadRow.product` resolves through `catalog.listProductsAdmin` (id -> name) with a short-id
 *    fallback; an admin without `catalog.read` (only `leads.read`) still gets the page, just with
 *    short product ids (same fallback pattern `finance-view.ts` uses for partner names when
 *    `finance.ledger.read_all` is missing).
 *  - `LeadRow.services` is always `[]` at list level — `modules/leads`'s `listLeads` output
 *    (`LeadRow`) never carries `serviceInterest`; only `getLead`'s detail row does
 *    (`LeadDetailData.lead` below has it correctly, via `serviceInterest`, mapped to
 *    `LeadDetailData` — but the *table/board list* has no such field to show).
 *  - `LeadRow.wonValue` is always `undefined` — there is no order-amount join on `listLeads` or
 *    `getLead` (`LeadDetail.wonOrder` only carries `{orderId, orderNo}`, no amount).
 *  - `assignedTo`/`assignee` and activity `actor` names resolve through the admin directory
 *    (`listActiveAdminUsers`) with a short-id fallback, same pattern as `approvals-view.ts`.
 */
import type { AdminDirectoryEntry } from "@/modules/approvals/approver-set";
import type { LeadActivityRow, LeadDetail, LeadRow as ModuleLeadRow } from "@/modules/leads/types";
import type { AdminUserRef, LeadActivity, LeadDetailData, LeadRow } from "@/components/admin/types";

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "unknown";
}

export function buildAdminNameMap(admins: AdminDirectoryEntry[]): Map<string, AdminDirectoryEntry> {
  return new Map(admins.map((a) => [a.id, a]));
}

export function buildProductNameMap(
  products: Array<{ id: string; name: string }>,
): Map<string, string> {
  return new Map(products.map((p) => [p.id, p.name]));
}

function adminRef(
  assignedTo: { id: string; name: string | null } | null,
  admins: ReadonlyMap<string, AdminDirectoryEntry>,
): AdminUserRef | undefined {
  if (!assignedTo) return undefined;
  const found = admins.get(assignedTo.id);
  if (found) return { id: found.id, name: found.name, email: found.email, role: found.role };
  return { id: assignedTo.id, name: assignedTo.name ?? `Admin ${shortId(assignedTo.id)}` };
}

export function mapLeadRow(
  l: ModuleLeadRow,
  admins: ReadonlyMap<string, AdminDirectoryEntry>,
  productNames: ReadonlyMap<string, string>,
): LeadRow {
  return {
    id: l.leadId,
    name: l.name,
    company: l.company ?? undefined,
    email: l.email ?? "",
    phone: l.phone ?? undefined,
    source: l.source,
    product: l.productId
      ? (productNames.get(l.productId) ?? `Product ${shortId(l.productId)}`)
      : undefined,
    services: [],
    status: l.status,
    assignee: adminRef(l.assignedTo, admins),
    nextFollowUpAt: l.nextFollowUpAt ?? undefined,
    priority: l.priority,
    createdAt: l.createdAt,
    wonValue: undefined,
  };
}

function mapActivity(
  a: LeadActivityRow,
  admins: ReadonlyMap<string, AdminDirectoryEntry>,
): LeadActivity {
  const actorName = a.actor
    ? (admins.get(a.actor.id)?.name ?? a.actor.name ?? `Admin ${shortId(a.actor.id)}`)
    : "System";
  return {
    id: a.activityId,
    kind: a.kind,
    actor: actorName,
    at: a.createdAt,
    text: a.body ?? "",
  };
}

export function mapLeadDetail(
  d: LeadDetail,
  admins: AdminDirectoryEntry[],
  productNames: ReadonlyMap<string, string>,
  related: LeadDetailData["related"] = [],
): LeadDetailData {
  const adminMap = buildAdminNameMap(admins);
  const lead = mapLeadRow(d.lead, adminMap, productNames);
  return {
    lead,
    message: d.lead.message ?? "",
    budgetHint: d.lead.budgetHint ?? undefined,
    submittedAt: d.lead.createdAt,
    turnstileVerified: d.lead.turnstileVerified,
    ipCountry: "—",
    activities: d.activities.map((a) => mapActivity(a, adminMap)),
    transcript: undefined,
    followUpNote: undefined,
    linkedCustomerId: d.linkedUser?.id,
    related,
    admins: admins.map((a) => ({ id: a.id, name: a.name, email: a.email, role: a.role })),
  };
}

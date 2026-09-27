/**
 * View-model mapper: `modules/audit` log rows -> the `AuditLog` admin component's `AuditRow`
 * (`components/admin/types`). Kept out of the page component per the phase convention.
 *
 * Known gaps vs. a fully-populated screen -- see the phase report:
 *  - `summary` is derived from the `action` string alone (the module doesn't compute a
 *    human-readable summary), so it just humanises the dotted action name.
 *  - `subjectHref` only covers the subject types the admin app actually has detail pages for
 *    (order, customer/user, product); anything else renders as plain text, not a dead link.
 *  - `approvalId` is always omitted: `AuditLogRow` doesn't carry a link back to an approval
 *    request (that relationship isn't tracked on the audit row itself).
 *  - `actor.name` falls back to the role or "System" when `actorName` is null (e.g. the actor
 *    was later anonymised, BR-18) rather than fabricating a name.
 */
import type { AuditLogRow } from "@/modules/audit/types";
import type { AuditRow } from "@/components/admin/types";

const ADMIN_CLASS_ROLES = new Set(["super_admin", "admin", "staff"]);

function subjectHref(subjectType: string, subjectId: string): string | undefined {
  switch (subjectType) {
    case "order":
      return `/admin/orders/${subjectId}`;
    case "user":
    case "customer":
      return `/admin/customers/${subjectId}`;
    case "product":
      return `/admin/products/${subjectId}`;
    default:
      return undefined;
  }
}

function humaniseAction(action: string): string {
  const withoutApiPrefix = action.replace(/^API-[A-Z]+-\d+ /, "");
  return withoutApiPrefix.replace(/[._]/g, " ");
}

export function mapAuditRow(row: AuditLogRow): AuditRow {
  const kind: "admin" | "customer" | "system" =
    row.actorId === null ? "system" : row.actorRole && ADMIN_CLASS_ROLES.has(row.actorRole) ? "admin" : "customer";

  const name =
    row.actorName ?? (kind === "system" ? (row.actorRole ?? "System") : (row.actorRole ?? "Unknown"));

  return {
    id: row.id,
    at: row.createdAt,
    actor: {
      id: row.actorId ?? "system",
      name,
      kind,
      ...(row.actorRole ? { role: row.actorRole as "super_admin" | "admin" | "staff" } : {}),
    },
    action: row.action,
    subjectType: row.subject.type,
    subjectId: row.subject.id,
    ...(subjectHref(row.subject.type, row.subject.id)
      ? { subjectHref: subjectHref(row.subject.type, row.subject.id) }
      : {}),
    summary: humaniseAction(row.action),
    ip: row.ip ?? "—",
    requestId: row.requestId ?? "—",
    before: (row.before ?? undefined) as Record<string, unknown> | undefined,
    after: (row.after ?? undefined) as Record<string, unknown> | undefined,
    ...(row.userAgent ? { userAgent: row.userAgent } : {}),
  };
}

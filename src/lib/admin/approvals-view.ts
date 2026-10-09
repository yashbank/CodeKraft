/**
 * View-model mapper for the admin Approvals inbox (SCR-ADM-05) — `ApprovalView` (module shape) ->
 * `components/admin/types.ts`'s `ApprovalItem` (component prop shape). Kept out of the page and
 * out of the screen component, per the `finance-view.ts` / `customers-view.ts` convention.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `requestedBy` / `decision.by` resolve through the admin directory
 *    (`listActiveAdminUsers`/`listAdminDirectoryQuery`) with a short-id fallback — same pattern
 *    `finance-view.ts` uses for partner names; there is no batch admin-user display-name query.
 *  - `diff` is built generically from `ApprovalView.payload` (one row per top-level payload key,
 *    `payloadSummary` first) rather than a bespoke before/after table per approval type. Finance's
 *    `ledger.adjustment` and `payout.record` types already have a hand-built diff elsewhere
 *    (`finance-view.ts`'s `mapApprovalToAdjustmentRow` / `mapPayoutApprovalToRow`) for their own
 *    dedicated screens; this generic mapper serves the other seven types this inbox also shows.
 *  - `subjectHref` is only set for the types this admin app has a stable, id-addressable detail
 *    route for (`product.*` -> `/admin/products/:id`, `refund.issue` / `project_order.split` ->
 *    `/admin/orders/:id`); the rest render as plain text rather than a guessed link.
 */
import { inArray } from "drizzle-orm";
import { products } from "../../../drizzle/schema/catalog";
import { productOwnerships } from "../../../drizzle/schema/ownership";
import { users } from "../../../drizzle/schema/auth";
import type { DbOrTx } from "@/lib/db";
import type { ApprovalView } from "@/modules/approvals/types";
import type { AdminDirectoryEntry } from "@/modules/approvals/approver-set";
import type { AdminUserRef, ApprovalItem, DiffRow } from "@/components/admin/types";

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "unknown";
}

export function buildAdminNameMap(admins: AdminDirectoryEntry[]): Map<string, AdminDirectoryEntry> {
  return new Map(admins.map((a) => [a.id, a]));
}

function adminRef(userId: string, admins: ReadonlyMap<string, AdminDirectoryEntry>): AdminUserRef {
  const found = admins.get(userId);
  return found
    ? { id: found.id, name: found.name, email: found.email, role: found.role }
    : { id: userId, name: `Admin ${shortId(userId)}` };
}

function humanizeKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function buildDiff(a: ApprovalView): DiffRow[] {
  const rows: DiffRow[] = [{ label: "Summary", after: a.payloadSummary }];
  const payload = a.payload as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(payload)) {
    rows.push({ label: humanizeKey(key), after: formatValue(value) });
  }
  return rows;
}

/**
 * Human subject labels keyed by approval id; one batched query per subject type (never per row).
 * Rows with no match are absent so the mapper falls back to "<type> <shortId>".
 */
export async function resolveSubjectLabels(
  database: DbOrTx,
  approvals: readonly ApprovalView[],
): Promise<Map<string, string>> {
  const ids = (type: string) => [
    ...new Set(approvals.filter((a) => a.subject.type === type).map((a) => a.subject.id)),
  ];
  const ownershipIds = ids("product_ownership");
  const ownershipProduct = new Map<string, string>();
  if (ownershipIds.length > 0) {
    const rows = await database
      .select({ id: productOwnerships.id, productId: productOwnerships.productId })
      .from(productOwnerships)
      .where(inArray(productOwnerships.id, ownershipIds));
    for (const r of rows) ownershipProduct.set(r.id, r.productId);
  }
  // Ownership subject ids may be an ownership row id or the product id itself; accept both.
  const productIds = [
    ...new Set([...ids("product"), ...ownershipIds, ...ownershipProduct.values()]),
  ];
  const productName = new Map<string, string>();
  if (productIds.length > 0) {
    const rows = await database
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(inArray(products.id, productIds));
    for (const r of rows) productName.set(r.id, r.name);
  }
  const userIds = ids("user");
  const userEmail = new Map<string, string>();
  if (userIds.length > 0) {
    const rows = await database
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const r of rows) userEmail.set(r.id, r.email);
  }

  const labels = new Map<string, string>();
  for (const a of approvals) {
    const { type, id } = a.subject;
    let label: string | undefined;
    if (type === "product") {
      label = productName.get(id);
    } else if (type === "product_ownership") {
      const name = productName.get(ownershipProduct.get(id) ?? id);
      label = name ? `Ownership split: ${name}` : undefined;
    } else if (type === "user") {
      const p = a.payload as unknown as Record<string, unknown>;
      const email = userEmail.get(id) ?? (typeof p.email === "string" ? p.email : undefined);
      label = email ? `Admin ${p.kind === "invite" ? "invite" : "change"}: ${email}` : undefined;
    }
    if (label) labels.set(a.id, label);
  }
  return labels;
}

const SUBJECT_HREF_BASE: Partial<Record<ApprovalView["type"], string>> = {
  "product.publish": "/admin/products",
  "product.archive": "/admin/products",
  "product.delete": "/admin/products",
  "refund.issue": "/admin/orders",
  "project_order.split": "/admin/orders",
};

export function mapApprovalToItem(
  a: ApprovalView,
  admins: ReadonlyMap<string, AdminDirectoryEntry>,
  now: string,
  labels: ReadonlyMap<string, string> = new Map(),
): ApprovalItem {
  const base = SUBJECT_HREF_BASE[a.type];
  const latestDecision = a.decisions.at(-1);
  const createdAt = new Date(Date.parse(now) - a.ageHours * 3_600_000).toISOString();

  return {
    id: a.id,
    type: a.type,
    subject: labels.get(a.id) ?? `${a.subject.type} ${shortId(a.subject.id)}`,
    subjectId: a.subject.id,
    subjectHref: base ? `${base}/${a.subject.id}` : undefined,
    requestedBy: adminRef(a.requestedBy, admins),
    requestedAt: createdAt,
    comment: a.payloadSummary,
    status: a.status,
    approvedByIds: a.decisions.filter((d) => d.decision === "approve").map((d) => d.decidedBy),
    pendingApprovers: a.pendingApprovers.length,
    diff: buildDiff(a),
    note: a.error ?? undefined,
    decision: latestDecision
      ? {
          by: adminRef(latestDecision.decidedBy, admins).name,
          at: latestDecision.createdAt,
          decision: latestDecision.decision,
          comment: latestDecision.comment ?? undefined,
        }
      : undefined,
    appliedAt: a.appliedAt ?? undefined,
  };
}

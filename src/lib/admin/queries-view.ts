/**
 * View-model mappers for the admin Queries inbox (SCR-ADM-15) — `modules/queries` service shapes
 * -> `components/admin/types.ts` prop shapes. Kept out of the page and out of the screen
 * component, per the `finance-view.ts` / `customers-view.ts` convention.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `QueryRow.refundRequest` (the banner with order/method/amount/refundable) is always left
 *    `undefined`. `getQueryAdmin`'s `linkedOrder` has `{orderId, orderNo, status, total}` but no
 *    payment method or a "still refundable" flag, and `listQueriesAdmin`'s row only has a boolean
 *    `refundRequest`; there is no query/order join anywhere in this codebase that surfaces those
 *    two fields together. The thread still shows the linked order chip and a link to Approvals.
 *  - `QueryRow.related` only ever contains an `order` entry (from `orderNo`) — `productId` has no
 *    name lookup wired into the *list* query, so a product-only query shows no chip there (the
 *    thread header still resolves the product name via the `catalog` product map passed in).
 *  - `assignedTo` / message `author` names resolve through the admin directory
 *    (`listActiveAdminUsers`) with a short-id fallback, same pattern as `leads-view.ts`.
 *  - Message bodies are Tiptap JSON (`bodyJson`); `toPlainText` (`modules/content/render.ts`)
 *    extracts the same plain text used by chat search/teasers elsewhere in this codebase, so the
 *    thread reads correctly even though the admin composer here is still plain text (see
 *    `fromPlainText`, used when *sending*).
 */
import type { AdminDirectoryEntry } from "@/modules/approvals/approver-set";
import { toPlainText } from "@/modules/content/render";
import type {
  QueryMessageView,
  QueryRow as ModuleQueryRow,
  QueryThread as ModuleQueryThread,
} from "@/modules/queries/types";
import type {
  AdminUserRef,
  CustomerOption,
  QueryMessage,
  QueryRow,
  QueryThread,
} from "@/components/admin/types";

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "unknown";
}

export function buildAdminNameMap(admins: AdminDirectoryEntry[]): Map<string, AdminDirectoryEntry> {
  return new Map(admins.map((a) => [a.id, a]));
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

function actorName(
  author: { id: string; name: string | null } | null,
  admins: ReadonlyMap<string, AdminDirectoryEntry>,
): string {
  if (!author) return "System";
  return admins.get(author.id)?.name ?? author.name ?? `Admin ${shortId(author.id)}`;
}

export function mapQueryRow(
  q: ModuleQueryRow,
  admins: ReadonlyMap<string, AdminDirectoryEntry>,
): QueryRow {
  return {
    id: q.queryId,
    subject: q.subject,
    customer: q.customer.id
      ? { id: q.customer.id, name: q.customer.name ?? q.customer.email, email: q.customer.email }
      : undefined,
    visitorEmail: q.customer.id ? undefined : q.customer.email,
    source: q.source,
    status: q.status,
    snippet: "",
    updatedAt: q.updatedAt,
    assignee: adminRef(q.assignedTo, admins),
    unread: q.unreadForCaller,
    related: q.orderNo ? [{ kind: "order", label: q.orderNo }] : [],
    refundRequest: undefined,
  };
}

function mapMessage(
  m: QueryMessageView,
  admins: ReadonlyMap<string, AdminDirectoryEntry>,
): QueryMessage {
  return {
    id: m.messageId,
    authorKind: m.authorKind,
    author:
      m.authorKind === "customer" ? (m.author?.name ?? "Customer") : actorName(m.author, admins),
    at: m.createdAt,
    text: toPlainText(m.bodyJson as never),
    attachments: m.attachments.length > 0 ? m.attachments.map((a) => a.name) : undefined,
  };
}

const CANNED_REPLIES = [
  "Thanks for reaching out — we're looking into this and will follow up shortly.",
  "This has been resolved on our end. Let us know if anything still looks off.",
  "Could you share your order number so we can look into this?",
];

export function mapQueryThread(
  t: ModuleQueryThread,
  admins: ReadonlyMap<string, AdminDirectoryEntry>,
): QueryThread {
  const row = mapQueryRow(t.query, admins);
  const lastMessage = t.messages.at(-1);
  row.snippet = lastMessage ? toPlainText(lastMessage.bodyJson as never) : "";
  if (t.linkedOrder) {
    row.related = [{ kind: "order", label: t.linkedOrder.orderNo }];
  }
  return {
    query: row,
    messages: t.messages.map((m) => mapMessage(m, admins)),
    chatbotContext: t.conversationTranscript?.map((c) => `${c.role}: ${c.content}`),
    snippets: CANNED_REPLIES,
  };
}

export function mapCustomerOptions(
  customers: Array<{ id: string; name: string; email: string }>,
): CustomerOption[] {
  return customers.map((c) => ({ id: c.id, name: c.name, email: c.email }));
}

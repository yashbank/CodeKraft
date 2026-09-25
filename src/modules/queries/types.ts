/**
 * Support queries — docs/06 §2.9 API-CHAT-01..05 and API-CHAT-14 (`modules/queries`), BR-03,
 * BR-09 / MASTER_SPEC §7 "Refund request channel" (one open refund query per order), D-702
 * (escalation), D-1002 (email on admin reply), FR-LEAD-09 (auto-close after 7 d).
 */
import { z } from "zod";
import { isoDateTimeSchema as isoDateTime, uuidSchema as uuid } from "@/modules/_shared/zod";

export { uuidSchema as uuid, isoDateTimeSchema as isoDateTime } from "@/modules/_shared/zod";

export const QUERY_SOURCES = ["form", "chatbot", "order", "dashboard", "email", "manual"] as const;
export type QuerySource = (typeof QUERY_SOURCES)[number];
export const QUERY_STATUSES = ["open", "waiting_customer", "resolved", "closed"] as const;
export type QueryStatus = (typeof QUERY_STATUSES)[number];
export const MESSAGE_AUTHOR_KINDS = ["customer", "admin", "system"] as const;
export type MessageAuthorKind = (typeof MESSAGE_AUTHOR_KINDS)[number];

export const queryStatusSchema = z.enum(QUERY_STATUSES);

/** Tiptap JSON body (allow-list validation via `_shared/zod.ts` `richText` in P3). */
export const queryBodySchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

/** ≤ 3 media ids uploaded via intent purpose `query_attachment` (docs/06 §3.5). */
export const queryAttachmentsSchema = z.array(uuid).max(3);

/**
 * API-CHAT-01 `createQuery` — customer (`support.self`) with `source` dashboard/order, or a
 * visitor (`source='form'`, `guestEmail` + `turnstileToken`, rate class `public_form`).
 * `refundRequest` only with `source='order'` on a paid/fulfilled/partially_refunded order of the
 * caller; a second refund request returns the existing thread (`existing=true`, BR-09).
 */
export const createQuerySchema = z
  .object({
    subject: z.string().trim().min(3).max(160),
    bodyJson: queryBodySchema,
    source: z.enum(["form", "dashboard", "order"]),
    orderId: uuid.optional(),
    productId: uuid.optional(),
    refundRequest: z.boolean().optional(),
    attachments: queryAttachmentsSchema.optional(),
    guestEmail: z.email().max(254).optional(),
    turnstileToken: z.string().min(1).max(2048).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.source === "order" && v.orderId === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["orderId"],
        message: "orderId is required for source order",
      });
    }
    if (v.refundRequest === true && v.source !== "order") {
      ctx.addIssue({
        code: "custom",
        path: ["refundRequest"],
        message: "refundRequest requires source order",
      });
    }
    if (v.guestEmail !== undefined && v.turnstileToken === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["turnstileToken"],
        message: "turnstileToken is required for guest queries",
      });
    }
    if (v.guestEmail !== undefined && v.source !== "form") {
      ctx.addIssue({
        code: "custom",
        path: ["source"],
        message: "guest queries must use source form",
      });
    }
  });
export type CreateQueryInput = z.infer<typeof createQuerySchema>;

/** API-CHAT-02 `listMyQueries` — `support.self`. */
export const listMyQueriesSchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(25),
    sort: z.enum(["updatedAt:asc", "updatedAt:desc", "createdAt:asc", "createdAt:desc"]).optional(),
    filters: z
      .object({ status: z.array(queryStatusSchema).min(1).max(4).optional() })
      .strict()
      .optional(),
    q: z.string().trim().max(200).optional(),
  })
  .strict();
export type ListMyQueriesInput = z.infer<typeof listMyQueriesSchema>;

/** API-CHAT-02 `getMyQuery`. */
export const getMyQuerySchema = z.object({ queryId: uuid }).strict();
export type GetMyQueryInput = z.infer<typeof getMyQuerySchema>;

/**
 * API-CHAT-03 `replyToQuery` — customer on own thread (reopens `waiting_customer` → `open`; may
 * set `resolved`) or `queries.reply` (may set `waiting_customer` or `resolved`). `STATE_INVALID`
 * when `closed`.
 */
export const replyToQuerySchema = z
  .object({
    queryId: uuid,
    bodyJson: queryBodySchema,
    attachments: queryAttachmentsSchema.optional(),
    setStatus: z.enum(["waiting_customer", "resolved"]).optional(),
  })
  .strict();
export type ReplyToQueryInput = z.infer<typeof replyToQuerySchema>;

/** API-CHAT-04 `listQueriesAdmin` — `queries.read`. */
export const listQueriesAdminSchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(25),
    sort: z.enum(["updatedAt:asc", "updatedAt:desc", "createdAt:asc", "createdAt:desc"]).optional(),
    filters: z
      .object({
        status: z.array(queryStatusSchema).min(1).max(4).optional(),
        source: z.enum(QUERY_SOURCES).optional(),
        assignedTo: z.union([z.literal("me"), z.literal("unassigned"), uuid]).optional(),
        userId: uuid.optional(),
        orderId: uuid.optional(),
        productId: uuid.optional(),
        dateFrom: isoDateTime.optional(),
      })
      .strict()
      .optional(),
    q: z.string().trim().max(200).optional(),
  })
  .strict();
export type ListQueriesAdminInput = z.infer<typeof listQueriesAdminSchema>;

/** API-CHAT-04 `getQueryAdmin`. */
export const getQueryAdminSchema = z.object({ queryId: uuid }).strict();
export type GetQueryAdminInput = z.infer<typeof getQueryAdminSchema>;

/** API-CHAT-05 `assignQuery` — `queries.reply`. */
export const assignQuerySchema = z.object({ queryId: uuid, assignedTo: uuid.nullable() }).strict();
export type AssignQueryInput = z.infer<typeof assignQuerySchema>;

/** API-CHAT-05 `closeQuery` — `queries.close`; `E: query-closed`. */
export const closeQuerySchema = z
  .object({ queryId: uuid, resolutionNote: z.string().trim().max(2000).optional() })
  .strict();
export type CloseQueryInput = z.infer<typeof closeQuerySchema>;

/** API-CHAT-05 `reopenQuery` — `queries.close`; `STATE_INVALID` unless resolved/closed. */
export const reopenQuerySchema = z.object({ queryId: uuid }).strict();
export type ReopenQueryInput = z.infer<typeof reopenQuerySchema>;

/**
 * API-CHAT-14 `createQueryAdmin` — `queries.reply`; opened on a customer's behalf. `source='email'`
 * when the request arrived via the invoice contact details (D-406), `manual` otherwise. Exactly
 * one of `userId` / `guestEmail`. First message `author_kind='admin'`; `N: query.new` to the customer.
 */
export const createQueryAdminSchema = z
  .object({
    userId: uuid.optional(),
    guestEmail: z.email().max(254).optional(),
    subject: z.string().trim().min(3).max(160),
    bodyJson: queryBodySchema,
    source: z.enum(["email", "manual"]),
    orderId: uuid.optional(),
    productId: uuid.optional(),
    refundRequest: z.boolean().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const hasUser = v.userId !== undefined;
    const hasGuest = v.guestEmail !== undefined;
    if (hasUser === hasGuest) {
      ctx.addIssue({
        code: "custom",
        path: [hasUser ? "guestEmail" : "userId"],
        message: "Provide exactly one of userId or guestEmail",
      });
    }
    if (v.refundRequest === true && v.orderId === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["orderId"],
        message: "refundRequest requires orderId",
      });
    }
  });
export type CreateQueryAdminInput = z.infer<typeof createQueryAdminSchema>;

/** Internal (API-CHAT-09): escalation payload built by the chat module inside its transaction. */
export const createQueryFromEscalationSchema = z
  .object({
    conversationId: uuid,
    userId: uuid,
    subject: z.string().trim().min(3).max(160),
    /** Transcript summary + last 10 turns, `author_kind='system'`. */
    transcriptExcerpt: z.string().min(1).max(20000),
    customerSummary: z.string().trim().max(2000).optional(),
  })
  .strict();
export type CreateQueryFromEscalationInput = z.infer<typeof createQueryFromEscalationSchema>;

// ---------------------------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------------------------

export interface QueryCreateResult {
  queryId: string;
  /** `true` when an existing open refund thread was returned (BR-09). */
  existing?: boolean;
}

export interface QueryMessageView {
  messageId: string;
  authorKind: MessageAuthorKind;
  author: { id: string; name: string | null } | null;
  bodyJson: Record<string, unknown>;
  /** 5-minute signed URLs (docs/06 API-CHAT-02). */
  attachments: Array<{
    mediaId: string;
    name: string;
    sizeBytes: number;
    url: string;
    expiresAt: string;
  }>;
  createdAt: string;
}

export interface QueryRow {
  queryId: string;
  subject: string;
  source: QuerySource;
  status: QueryStatus;
  assignedTo: { id: string; name: string | null } | null;
  customer: { id: string | null; email: string; name: string | null };
  orderNo: string | null;
  productId: string | null;
  refundRequest: boolean;
  lastMessageAt: string;
  unreadForCaller: boolean;
  createdAt: string;
  updatedAt: string;
}

/** API-CHAT-02 `getMyQuery` / API-CHAT-04 `getQueryAdmin` (admin fields optional). */
export interface QueryThread {
  query: QueryRow;
  messages: QueryMessageView[];
  customerCard?: {
    userId: string;
    email: string;
    name: string | null;
    orders: number;
    entitlements: number;
  };
  linkedOrder?: {
    orderId: string;
    orderNo: string;
    status: string;
    total: { amountMinor: number; currency: string };
  } | null;
  conversationTranscript?: Array<{
    role: "user" | "assistant" | "system" | "menu";
    content: string;
    createdAt: string;
  }> | null;
}

export interface ReplyToQueryResult {
  message: QueryMessageView;
  query: QueryRow;
}

export interface QueriesAutoCloseDetail extends Record<string, unknown> {
  closed: number;
}

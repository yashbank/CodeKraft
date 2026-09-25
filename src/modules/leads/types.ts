/**
 * Leads — docs/06 §2.8 API-LEAD-01..07 (`modules/leads`), D-315, D-703 (pipeline), D-704
 * (chatbot capture), D-705 (assignment), D-706 (overdue), D-808 (no public contact details),
 * D-1204 (Turnstile on public forms), R-701 (daily overdue digest).
 */
import { z } from "zod";

export const uuid = z.uuid();
export const isoDateTime = z.iso.datetime({ offset: true });

export const LEAD_SOURCES = ["inquiry_form", "product_cta", "chatbot", "manual"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
/** Sources reachable without a session — Turnstile mandatory (D-1204). */
export const PUBLIC_LEAD_SOURCES = [
  "inquiry_form",
  "product_cta",
] as const satisfies readonly LeadSource[];

export const LEAD_STATUSES = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_PRIORITIES = ["low", "normal", "high"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];
export const LEAD_ACTIVITY_KINDS = [
  "note",
  "status_change",
  "assignment",
  "follow_up_set",
  "email",
  "call",
] as const;
export type LeadActivityKind = (typeof LEAD_ACTIVITY_KINDS)[number];

export const leadStatusSchema = z.enum(LEAD_STATUSES);
export const leadPrioritySchema = z.enum(LEAD_PRIORITIES);

const leadFields = {
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  phone: z.string().trim().min(6).max(32).optional(),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().min(10).max(4000),
  serviceInterest: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  budgetHint: z.string().trim().max(80).optional(),
  productId: uuid.optional(),
};

/**
 * API-LEAD-01 `createLead` — public inquiry form (`/contact`, landing "Start a project" sheet)
 * or product CTA; visitor or customer. Turnstile token required (D-1204; `CAPTCHA_FAILED`),
 * rate class `public_form`. `productId` only with `product_cta`.
 */
export const createLeadSchema = z
  .object({
    source: z.enum(PUBLIC_LEAD_SOURCES),
    ...leadFields,
    turnstileToken: z.string().min(1).max(2048),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.source === "product_cta" && v.productId === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["productId"],
        message: "productId is required for product_cta",
      });
    }
  });
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

/** API-LEAD-02 `createLeadManual` — `leads.write`; no captcha; `email` optional for phone-only leads. */
export const createLeadManualSchema = z
  .object({
    source: z.literal("manual"),
    ...leadFields,
    email: z.email().max(254).optional(),
    message: z.string().trim().max(4000).optional(),
    assignedTo: uuid.optional(),
    priority: leadPrioritySchema.optional(),
  })
  .strict();
export type CreateLeadManualInput = z.infer<typeof createLeadManualSchema>;

/**
 * Internal (API-CHAT-15 → `LeadsService.createFromChatbot`): the customer confirmed the
 * `lead_intent` card; `userId` from the session, `message` = `need`.
 */
export const createLeadFromChatbotSchema = z
  .object({
    source: z.literal("chatbot"),
    conversationId: uuid,
    userId: uuid,
    name: z.string().trim().min(1).max(120),
    email: z.email().max(254),
    message: z.string().trim().min(10).max(2000),
  })
  .strict();
export type CreateLeadFromChatbotInput = z.infer<typeof createLeadFromChatbotSchema>;

/** Every way a lead row is created — discriminated by `source`. */
export const leadCreateInputSchema = z.union([
  createLeadSchema,
  createLeadManualSchema,
  createLeadFromChatbotSchema,
]);
export type LeadCreateInput = z.infer<typeof leadCreateInputSchema>;

type SortValue<F extends string> = `${F}:asc` | `${F}:desc`;
const LEAD_SORT_FIELDS = ["createdAt", "nextFollowUpAt", "status"] as const;
const leadSortValues = LEAD_SORT_FIELDS.flatMap((f) => [`${f}:asc`, `${f}:desc`]) as [
  SortValue<(typeof LEAD_SORT_FIELDS)[number]>,
  ...SortValue<(typeof LEAD_SORT_FIELDS)[number]>[],
];

/**
 * API-LEAD-03 `listLeads` — `leads.read` (`leads.read_all` to see other admins' assigned leads;
 * `admin` scope = assigned to caller or unassigned pool, D-512). `overdue` = `next_follow_up_at < now`
 * and status not won/lost (D-706).
 */
export const listLeadsSchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(25),
    sort: z.enum(leadSortValues).optional(),
    filters: z
      .object({
        status: z.array(leadStatusSchema).min(1).max(6).optional(),
        source: z.enum(LEAD_SOURCES).optional(),
        assignedTo: z.union([z.literal("me"), z.literal("unassigned"), uuid]).optional(),
        productId: uuid.optional(),
        priority: leadPrioritySchema.optional(),
        overdue: z.boolean().optional(),
        dateFrom: isoDateTime.optional(),
        dateTo: isoDateTime.optional(),
      })
      .strict()
      .optional(),
    q: z.string().trim().max(200).optional(),
  })
  .strict();
export type ListLeadsInput = z.infer<typeof listLeadsSchema>;

/** API-LEAD-03 `getLead`. */
export const getLeadSchema = z.object({ leadId: uuid }).strict();
export type GetLeadInput = z.infer<typeof getLeadSchema>;

/** API-LEAD-04 `assignLead` — `leads.assign`; `null` returns the lead to the pool. `N: lead.assigned` (D-705). */
export const assignLeadSchema = z.object({ leadId: uuid, assignedTo: uuid.nullable() }).strict();
export type AssignLeadInput = z.infer<typeof assignLeadSchema>;

/** API-LEAD-04 `claimLead` — assigns to the caller; `CONFLICT` when already assigned to someone else. */
export const claimLeadSchema = z.object({ leadId: uuid }).strict();
export type ClaimLeadInput = z.infer<typeof claimLeadSchema>;

/** API-LEAD-05 `updateLeadStatus` — pipeline (D-703); `lostReason` required for `lost`; `won` may link a manual order. */
export const updateLeadStatusSchema = z
  .object({
    leadId: uuid,
    status: leadStatusSchema,
    lostReason: z.string().trim().min(1).max(500).optional(),
    wonOrderId: uuid.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.status === "lost" && v.lostReason === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["lostReason"],
        message: "lostReason is required when status is lost",
      });
    }
    if (v.wonOrderId !== undefined && v.status !== "won") {
      ctx.addIssue({
        code: "custom",
        path: ["wonOrderId"],
        message: "wonOrderId is only allowed with status won",
      });
    }
  });
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;

/** API-LEAD-06 `addLeadNote` / `logLeadActivity` — `leads.write`. */
export const addLeadNoteSchema = z
  .object({
    leadId: uuid,
    kind: z.enum(["note", "email", "call"]),
    body: z.string().trim().min(1).max(4000),
  })
  .strict();
export type AddLeadNoteInput = z.infer<typeof addLeadNoteSchema>;

/** API-LEAD-07 `setFollowUp` — `next_follow_up_at`, `priority`; overdue rows feed the daily digest (R-701). */
export const setFollowUpSchema = z
  .object({
    leadId: uuid,
    nextFollowUpAt: isoDateTime.nullable(),
    note: z.string().trim().max(2000).optional(),
    priority: leadPrioritySchema.optional(),
  })
  .strict();
export type SetFollowUpInput = z.infer<typeof setFollowUpSchema>;

// ---------------------------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------------------------

export interface LeadCreateResult {
  /** No PII echoed to public callers (API-LEAD-01). */
  leadId: string;
}

export interface LeadRow {
  leadId: string;
  source: LeadSource;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  assignedTo: { id: string; name: string | null } | null;
  productId: string | null;
  nextFollowUpAt: string | null;
  overdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivityRow {
  activityId: string;
  kind: LeadActivityKind;
  actor: { id: string; name: string | null } | null;
  body: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

/** API-LEAD-03 `getLead` output. */
export interface LeadDetail {
  lead: LeadRow & {
    message: string | null;
    serviceInterest: string[];
    budgetHint: string | null;
    lostReason: string | null;
    turnstileVerified: boolean;
  };
  activities: LeadActivityRow[];
  linkedProduct: { id: string; name: string; slug: string } | null;
  linkedUser: { id: string; email: string; name: string | null } | null;
  wonOrder: { orderId: string; orderNo: string } | null;
  conversation: { conversationId: string; escalatedQueryId: string | null } | null;
}

/** One admin's slice of `daily/admin.overdue_digest` (R-701, D-607): overdue leads + open revoke tasks. */
export interface OverdueDigestForAdmin {
  adminId: string;
  email: string;
  leads: Array<{ leadId: string; name: string; nextFollowUpAt: string; daysOverdue: number }>;
  revokeTasks: Array<{ taskId: string; product: string; customerEmail: string; openSince: string }>;
}

export interface OverdueDigestDetail extends Record<string, unknown> {
  admins: number;
  overdueLeads: number;
  openRevokeTasks: number;
  emailsQueued: number;
}

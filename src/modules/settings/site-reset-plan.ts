/**
 * Pure plan for "Reset site data" (P6-05): categories, their table sets and the FK-safe delete
 * order. No DB or server imports so the approvals payload schema and the UI can share it.
 * Mirrors scripts/wipe-demo-data.mjs: legal pages, landing chapters, prompts, RBAC, site_settings,
 * migrations and audit_logs are never touched; admin-class users (and their rows) always survive.
 */
export const RESET_CATEGORIES = [
  "leads",
  "quotes",
  "customers_orders",
  "products",
  "content",
  "finance",
] as const;
export type ResetCategory = (typeof RESET_CATEGORIES)[number];

export const RESET_CATEGORY_LABELS: Record<ResetCategory, string> = {
  leads: "Leads",
  quotes: "Quotes",
  customers_orders: "Customers and orders",
  products: "Products and services",
  content: "Content",
  finance: "Finance",
};

/** Rows elsewhere point at these, so wiping them alone would break foreign keys. */
export const RESET_REQUIRES: Record<ResetCategory, readonly ResetCategory[]> = {
  leads: [],
  quotes: ["customers_orders"],
  finance: [],
  content: [],
  customers_orders: ["leads", "quotes", "finance"],
  products: ["customers_orders", "leads", "quotes", "finance", "content"],
};

export function expandCategories(selected: readonly ResetCategory[]): ResetCategory[] {
  const out = new Set<ResetCategory>();
  const add = (c: ResetCategory) => {
    if (out.has(c)) return;
    out.add(c);
    RESET_REQUIRES[c].forEach(add);
  };
  selected.forEach(add);
  return RESET_CATEGORIES.filter((c) => out.has(c));
}

/**
 * Customers = users holding no admin-class role AND not referenced by a KEEP table with a
 * NO ACTION foreign key (partners, approvals they raised or decided, legal page versions).
 * Such a user is kept whole (account, sessions, roles) so the wipe cannot abort on that FK.
 */
export const KEPT_USER_REFS = [
  ["partners", "user_id"],
  ["approval_requests", "requested_by"],
  ["approval_decisions", "decided_by"],
  ["legal_page_versions", "published_by"],
] as const;
const CUSTOMER_USER_FILTER = `NOT IN (SELECT user_id FROM user_roles WHERE role_key IN ('super_admin','admin','staff')${KEPT_USER_REFS.map(([t, c]) => ` UNION SELECT "${c}" FROM "${t}"`).join("")})`;

const STAFF_IDS = `SELECT user_id FROM user_roles WHERE role_key IN ('super_admin','admin','staff')`;
/**
 * Approvals deleted by the wipe, per type: refund.issue / project_order.split / ledger.adjustment /
 * payout.record are about wiped orders, refunds, payments and finance rows, so they go. Anything else
 * goes only if a customer raised it. Never site.reset (authorises this run) and never KEEP-content
 * types (product.*, ownership.change: product_ownerships.approval_request_id is ON DELETE RESTRICT).
 */
const APPROVAL_WIPE_WHERE = `"type" IN ('refund.issue','project_order.split','ledger.adjustment','payout.record') OR ("type" NOT IN ('site.reset','ownership.change','product.publish','product.archive','product.delete') AND "requested_by" NOT IN (${STAFF_IDS}))`;

export interface ResetStep {
  table: string;
  category: ResetCategory;
  /** Only rows of customer users (never admins); the column that holds the user id. */
  customersOnly?: "user_id" | "id" | "uploaded_by";
  /** Raw WHERE for a filtered delete of a KEEP-class table (approvals). */
  where?: string;
  /** Runs first: breaks a circular FK (refunds.credit_note_id <-> credit_notes.refund_id). */
  before?: string;
}

const s = (category: ResetCategory, ...tables: string[]): ResetStep[] =>
  tables.map((table) => ({ table, category }));
const cu = (table: string, col: "user_id" | "id" | "uploaded_by"): ResetStep => ({
  table,
  category: "customers_orders",
  customersOnly: col,
});

/** Children before parents. */
export const RESET_STEPS: readonly ResetStep[] = [
  ...s("finance", "ledger_entries", "allocations", "payouts", "expenses"),
  {
    table: "credit_notes",
    category: "customers_orders",
    before: 'UPDATE "refunds" SET "credit_note_id" = NULL',
  },
  ...s(
    "customers_orders",
    "refunds",
    "invoices",
    "user_offering_purchases",
    "downloads",
    "service_progress",
    "delivery_tasks",
    "subscriptions",
    "entitlements",
    "payments",
    "order_items",
    "orders",
    "wishlists",
    "query_messages",
    "queries",
    "chat_messages",
    "conversations",
    "chat_usage_daily",
    "notifications",
    "email_outbox",
    "analytics_events",
    "webhook_events",
    "files_upload_intents",
    // Wiped with invoices/credit_notes so numbering restarts at 1 (rows are re-created on demand).
    "invoice_sequences",
    "credit_note_sequences",
  ),
  {
    table: "coupon_redemptions",
    category: "customers_orders",
    // coupons are KEPT; their usage counter is derived from the redemptions deleted here.
    before: 'UPDATE "coupons" SET "redemptions_count" = 0',
  },
  ...s("quotes", "custom_quotes"),
  ...s("leads", "lead_activities", "leads"),
  ...s(
    "content",
    "case_studies",
    "services",
    "testimonials",
    "client_logos",
    "faqs",
    "product_blogs",
  ),
  ...s(
    "products",
    "product_ownership_lines",
    "product_ownerships",
    "offering_payment_methods",
    "offering_prices",
    "offerings",
    "release_files",
    "product_media",
    "product_tags",
    "product_versions",
    "product_faqs",
    "product_testimonials",
    "featured_products",
    "slug_redirects",
    "products",
  ),
  cu("media", "uploaded_by"),
  {
    table: "approval_decisions",
    category: "customers_orders",
    where: `"request_id" IN (SELECT "id" FROM "approval_requests" WHERE ${APPROVAL_WIPE_WHERE})`,
  },
  { table: "approval_requests", category: "customers_orders", where: APPROVAL_WIPE_WHERE },
  cu("customer_profiles", "user_id"),
  cu("sessions", "user_id"),
  cu("two_factor", "user_id"),
  cu("user_tokens", "user_id"),
  cu("accounts", "user_id"),
  cu("dashboard_layouts", "user_id"),
  cu("user_roles", "user_id"),
  {
    ...cu("users", "id"),
    // Nullable NO ACTION FK from a KEEP table: cleared rather than blocking the delete.
    before: `UPDATE "coupons" SET "created_by" = NULL WHERE "created_by" ${CUSTOMER_USER_FILTER}`,
  },
];

export function stepsFor(selected: readonly ResetCategory[]): ResetStep[] {
  const cats = new Set(expandCategories(selected));
  return RESET_STEPS.filter((st) => cats.has(st.category));
}

export const quoteIdent = (n: string) => `"${n}"`;
const whereFor = (st: ResetStep) =>
  st.where
    ? ` WHERE ${st.where}`
    : st.customersOnly
      ? ` WHERE ${quoteIdent(st.customersOnly)} ${CUSTOMER_USER_FILTER}`
      : "";
export const deleteSql = (st: ResetStep) => `DELETE FROM ${quoteIdent(st.table)}${whereFor(st)}`;
export const countSql = (st: ResetStep) =>
  `SELECT count(*)::int AS c FROM ${quoteIdent(st.table)}${whereFor(st)}`;
export const selectSql = (st: ResetStep) => `SELECT * FROM ${quoteIdent(st.table)}${whereFor(st)}`;

/**
 * Every table the reset leaves alone. The integration test fails when a schema table is in
 * neither this set nor RESET_STEPS, so a new table must be classified here on purpose.
 */
export const RESET_KEEP_TABLES: readonly string[] = [
  // staff, RBAC, settings, audit
  "roles",
  "permissions",
  "role_permissions",
  "site_settings",
  "fx_rates",
  "audit_logs",
  "approval_requests",
  "approval_decisions",
  "verifications",
  "partners",
  // catalog, content, media (wiped only when the products/content categories are picked)
  "categories",
  "tags",
  "coupons",
  "landing_chapters",
  "legal_pages",
  "legal_page_versions",
  "prompt_versions",
  "knowledge_chunks",
  // operational noise with no customer data
  "job_runs",
  "rate_limit_buckets",
];

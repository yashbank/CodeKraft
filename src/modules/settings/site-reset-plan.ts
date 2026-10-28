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

/** Customers = users holding no admin-class role. */
const CUSTOMER_USER_FILTER = `NOT IN (SELECT user_id FROM user_roles WHERE role_key IN ('super_admin','admin','staff'))`;

export interface ResetStep {
  table: string;
  category: ResetCategory;
  /** Only rows of customer users (never admins); the column that holds the user id. */
  customersOnly?: "user_id" | "id" | "uploaded_by";
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
    "coupon_redemptions",
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
  ),
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
  cu("customer_profiles", "user_id"),
  cu("sessions", "user_id"),
  cu("two_factor", "user_id"),
  cu("accounts", "user_id"),
  cu("dashboard_layouts", "user_id"),
  cu("user_roles", "user_id"),
  cu("users", "id"),
];

export function stepsFor(selected: readonly ResetCategory[]): ResetStep[] {
  const cats = new Set(expandCategories(selected));
  return RESET_STEPS.filter((st) => cats.has(st.category));
}

export const quoteIdent = (n: string) => `"${n}"`;
const whereFor = (st: ResetStep) =>
  st.customersOnly ? ` WHERE ${quoteIdent(st.customersOnly)} ${CUSTOMER_USER_FILTER}` : "";
export const deleteSql = (st: ResetStep) => `DELETE FROM ${quoteIdent(st.table)}${whereFor(st)}`;
export const countSql = (st: ResetStep) =>
  `SELECT count(*)::int AS c FROM ${quoteIdent(st.table)}${whereFor(st)}`;
export const selectSql = (st: ResetStep) => `SELECT * FROM ${quoteIdent(st.table)}${whereFor(st)}`;

/**
 * Status enum → chip tone map — docs/08 §6.8 (single source; chips call `tone(enumName, value)`).
 * Enum values are the Postgres enums of docs/05-DATABASE-DESIGN.md. The mapped type
 * `StatusToneMap` makes every enum value mandatory, so adding a value to `STATUS_ENUMS`
 * without a tone entry fails `tsc`.
 *
 * No colour here: tones resolve to tokens in the Badge component (docs/08 §6.8 tone table).
 */

/** Chip tones — docs/08 §6.8. `ghost` = transparent + hairline, used for terminal/inert states. */
export const TONES = [
  "neutral",
  "info",
  "success",
  "warning",
  "danger",
  "accent",
  "ghost",
] as const;
export type Tone = (typeof TONES)[number];

export interface StatusPresentation {
  readonly tone: Tone;
  /** Sentence-case UI label (MASTER_SPEC §3 terminology). */
  readonly label: string;
  /** Optional lucide icon name rendered beside the label. */
  readonly icon?: string;
}

/** Every status-like enum from docs/05 that renders as a chip, keyed `<table>.<column>`. */
export const STATUS_ENUMS = {
  "users.status": ["active", "suspended", "deleted"],
  "products.status": [
    "draft",
    "pending_approval",
    "scheduled",
    "published",
    "unpublished",
    "archived",
  ],
  "product_blogs.status": ["draft", "published"],
  "offerings.status": ["active", "inactive"],
  "offerings.purchase_model": ["one_time", "subscription", "custom_quote"],
  "offerings.delivery_type": ["saas", "hosted", "download", "license", "service", "custom"],
  "offerings.billing_interval": ["monthly", "quarterly", "annual"],
  "product_ownerships.status": ["pending", "active", "superseded"],
  "coupons.kind": ["percent", "fixed"],
  "coupons.state": ["active", "scheduled", "expired", "exhausted", "inactive"],
  "custom_quotes.status": ["draft", "sent", "accepted", "paid", "expired", "cancelled"],
  "orders.status": [
    "pending_payment",
    "paid",
    "fulfilled",
    "failed",
    "cancelled",
    "refunded",
    "partially_refunded",
  ],
  "orders.type": ["product", "project"],
  "payments.status": ["initiated", "submitted", "confirmed", "failed", "refunded"],
  "payments.provider": ["manual_upi", "manual_bank", "razorpay", "stripe", "paypal"],
  "entitlements.status": ["pending", "active", "suspended", "expired", "revoked"],
  "entitlements.delivery_type": ["saas", "hosted", "download", "license", "service", "custom"],
  "entitlements.provisioning_state": ["n/a", "pending", "done"],
  "entitlements.update_policy": ["all_free", "during_access", "major_paid"],
  "subscriptions.status": ["trialing", "active", "past_due", "suspended", "cancelled"],
  "delivery_tasks.status": ["open", "done"],
  "delivery_tasks.kind": ["provision", "revoke_external"],
  "ledger_entries.entry_type": [
    "sale",
    "discount",
    "tax_collected",
    "gateway_fee",
    "bank_charge",
    "company_cut",
    "partner_allocation",
    "refund_sale",
    "refund_discount",
    "refund_tax",
    "refund_company_cut",
    "refund_partner_allocation",
    "payout",
    "expense",
    "adjustment",
  ],
  "approval_requests.status": ["pending", "approved", "rejected", "applied", "cancelled"],
  "approval_requests.type": [
    "product.publish",
    "ownership.change",
    "ledger.adjustment",
    "refund.issue",
    "payout.record",
    "product.archive",
    "product.delete",
    "admin.user_change",
    "project_order.split",
  ],
  "approval_decisions.decision": ["approve", "reject"],
  "leads.status": ["new", "contacted", "qualified", "proposal", "won", "lost"],
  "leads.priority": ["low", "normal", "high"],
  "leads.source": ["inquiry_form", "product_cta", "chatbot", "manual"],
  "lead_activities.kind": ["note", "status_change", "assignment", "follow_up_set", "email", "call"],
  "queries.status": ["open", "waiting_customer", "resolved", "closed"],
  "queries.source": ["form", "chatbot", "order", "dashboard", "email", "manual"],
  "query_messages.author_kind": ["customer", "admin", "system"],
  "email_outbox.status": ["queued", "sent", "failed"],
  "job_runs.status": ["ok", "error"],
  "media.visibility": ["public", "private"],
  "faqs.scope": ["site", "chatbot", "product"],
  "testimonials.context": ["site", "product"],
  "product.flags": ["is_featured", "is_unlisted", "is_coming_soon", "is_refundable", "tax_enabled"],
  "leads.follow_up": ["overdue"],
} as const satisfies Record<string, readonly string[]>;

export type StatusEnum = keyof typeof STATUS_ENUMS;
export type StatusValue<E extends StatusEnum> = (typeof STATUS_ENUMS)[E][number];

/** Exhaustive: every enum and every value must have an entry (checked by `tsc`). */
export type StatusToneMap = {
  readonly [E in StatusEnum]: { readonly [V in StatusValue<E>]: StatusPresentation };
};

const DELIVERY_TYPE = {
  saas: { tone: "info", label: "SaaS" },
  hosted: { tone: "info", label: "Hosted" },
  download: { tone: "accent", label: "Download" },
  license: { tone: "accent", label: "License" },
  service: { tone: "warning", label: "Service" },
  custom: { tone: "neutral", label: "Custom" },
} as const satisfies StatusToneMap["offerings.delivery_type"];

export const STATUS_TONES: StatusToneMap = {
  "users.status": {
    active: { tone: "success", label: "Active" },
    suspended: { tone: "warning", label: "Suspended" },
    deleted: { tone: "ghost", label: "Deleted" },
  },
  "products.status": {
    draft: { tone: "neutral", label: "Draft" },
    pending_approval: { tone: "warning", label: "Pending approval" },
    scheduled: { tone: "info", label: "Scheduled" },
    published: { tone: "success", label: "Published" },
    unpublished: { tone: "neutral", label: "Unpublished" },
    archived: { tone: "ghost", label: "Archived" },
  },
  "product_blogs.status": {
    draft: { tone: "neutral", label: "Draft" },
    published: { tone: "success", label: "Published" },
  },
  "offerings.status": {
    active: { tone: "success", label: "Active" },
    inactive: { tone: "ghost", label: "Inactive" },
  },
  "offerings.purchase_model": {
    one_time: { tone: "accent", label: "One-time" },
    subscription: { tone: "info", label: "Subscription" },
    custom_quote: { tone: "neutral", label: "Quote" },
  },
  "offerings.delivery_type": DELIVERY_TYPE,
  "offerings.billing_interval": {
    monthly: { tone: "info", label: "Monthly" },
    quarterly: { tone: "info", label: "Quarterly" },
    annual: { tone: "info", label: "Annual" },
  },
  "product_ownerships.status": {
    pending: { tone: "warning", label: "Pending" },
    active: { tone: "success", label: "Active" },
    superseded: { tone: "ghost", label: "Superseded" },
  },
  "coupons.kind": {
    percent: { tone: "accent", label: "%" },
    fixed: { tone: "accent", label: "Fixed" },
  },
  "coupons.state": {
    active: { tone: "success", label: "Active" },
    scheduled: { tone: "info", label: "Scheduled" },
    expired: { tone: "ghost", label: "Expired" },
    exhausted: { tone: "warning", label: "Exhausted" },
    inactive: { tone: "ghost", label: "Inactive" },
  },
  "custom_quotes.status": {
    draft: { tone: "neutral", label: "Draft" },
    sent: { tone: "info", label: "Sent" },
    accepted: { tone: "accent", label: "Accepted" },
    paid: { tone: "success", label: "Paid" },
    expired: { tone: "ghost", label: "Expired" },
    cancelled: { tone: "danger", label: "Cancelled" },
  },
  "orders.status": {
    pending_payment: { tone: "warning", label: "Pending payment" },
    paid: { tone: "success", label: "Paid" },
    fulfilled: { tone: "success", label: "Fulfilled", icon: "package-check" },
    failed: { tone: "danger", label: "Failed" },
    cancelled: { tone: "ghost", label: "Cancelled" },
    refunded: { tone: "danger", label: "Refunded" },
    partially_refunded: { tone: "warning", label: "Partially refunded" },
  },
  "orders.type": {
    product: { tone: "accent", label: "Product" },
    project: { tone: "info", label: "Project" },
  },
  "payments.status": {
    initiated: { tone: "neutral", label: "Awaiting reference" },
    submitted: { tone: "warning", label: "Reference submitted" },
    confirmed: { tone: "success", label: "Confirmed" },
    failed: { tone: "danger", label: "Failed" },
    refunded: { tone: "danger", label: "Refunded" },
  },
  "payments.provider": {
    manual_upi: { tone: "neutral", label: "UPI" },
    manual_bank: { tone: "neutral", label: "Bank transfer" },
    razorpay: { tone: "neutral", label: "Razorpay" },
    stripe: { tone: "neutral", label: "Stripe" },
    paypal: { tone: "neutral", label: "PayPal" },
  },
  "entitlements.status": {
    pending: { tone: "warning", label: "Pending" },
    active: { tone: "success", label: "Active" },
    suspended: { tone: "warning", label: "Suspended" },
    expired: { tone: "ghost", label: "Expired" },
    revoked: { tone: "danger", label: "Revoked" },
  },
  "entitlements.delivery_type": DELIVERY_TYPE,
  "entitlements.provisioning_state": {
    "n/a": { tone: "ghost", label: "—" },
    pending: { tone: "warning", label: "Provisioning" },
    done: { tone: "success", label: "Provisioned" },
  },
  "entitlements.update_policy": {
    all_free: { tone: "success", label: "All updates" },
    during_access: { tone: "info", label: "Updates during access" },
    major_paid: { tone: "neutral", label: "Major versions paid" },
  },
  "subscriptions.status": {
    trialing: { tone: "info", label: "Trial" },
    active: { tone: "success", label: "Active" },
    past_due: { tone: "warning", label: "Past due" },
    suspended: { tone: "danger", label: "Suspended" },
    cancelled: { tone: "ghost", label: "Cancelled" },
  },
  "delivery_tasks.status": {
    open: { tone: "warning", label: "Open" },
    done: { tone: "success", label: "Done" },
  },
  "delivery_tasks.kind": {
    provision: { tone: "info", label: "Provision" },
    revoke_external: { tone: "danger", label: "Revoke external" },
  },
  "ledger_entries.entry_type": {
    sale: { tone: "success", label: "Sale" },
    discount: { tone: "warning", label: "Discount" },
    tax_collected: { tone: "info", label: "Tax collected" },
    gateway_fee: { tone: "neutral", label: "Gateway fee" },
    bank_charge: { tone: "warning", label: "Bank charge" },
    company_cut: { tone: "accent", label: "Company cut" },
    partner_allocation: { tone: "accent", label: "Partner allocation" },
    refund_sale: { tone: "danger", label: "Refund: sale" },
    refund_discount: { tone: "danger", label: "Refund: discount" },
    refund_tax: { tone: "danger", label: "Refund: tax" },
    refund_company_cut: { tone: "danger", label: "Refund: company cut" },
    refund_partner_allocation: { tone: "danger", label: "Refund: partner allocation" },
    payout: { tone: "info", label: "Payout" },
    expense: { tone: "warning", label: "Expense" },
    adjustment: { tone: "danger", label: "Adjustment", icon: "shield-check" },
  },
  "approval_requests.status": {
    pending: { tone: "warning", label: "Awaiting approval" },
    approved: { tone: "info", label: "Approved" },
    rejected: { tone: "danger", label: "Rejected" },
    applied: { tone: "success", label: "Applied" },
    cancelled: { tone: "ghost", label: "Cancelled" },
  },
  "approval_requests.type": {
    "product.publish": { tone: "accent", label: "Publish" },
    "ownership.change": { tone: "accent", label: "Ownership change" },
    "project_order.split": { tone: "accent", label: "Project order split" },
    "ledger.adjustment": { tone: "warning", label: "Ledger adjustment" },
    "refund.issue": { tone: "danger", label: "Refund" },
    "payout.record": { tone: "info", label: "Payout" },
    "product.archive": { tone: "ghost", label: "Archive" },
    "product.delete": { tone: "danger", label: "Delete" },
    "admin.user_change": { tone: "warning", label: "Admin user change" },
  },
  "approval_decisions.decision": {
    approve: { tone: "success", label: "Approved" },
    reject: { tone: "danger", label: "Rejected" },
  },
  "leads.status": {
    new: { tone: "accent", label: "New" },
    contacted: { tone: "info", label: "Contacted" },
    qualified: { tone: "info", label: "Qualified" },
    proposal: { tone: "warning", label: "Proposal" },
    won: { tone: "success", label: "Won" },
    lost: { tone: "ghost", label: "Lost" },
  },
  "leads.priority": {
    low: { tone: "ghost", label: "Low" },
    normal: { tone: "neutral", label: "Normal" },
    high: { tone: "danger", label: "High" },
  },
  "leads.source": {
    inquiry_form: { tone: "neutral", label: "Form" },
    product_cta: { tone: "accent", label: "Product CTA" },
    chatbot: { tone: "info", label: "Chatbot" },
    manual: { tone: "neutral", label: "Manual" },
  },
  "lead_activities.kind": {
    note: { tone: "neutral", label: "Note", icon: "sticky-note" },
    status_change: { tone: "info", label: "Status change", icon: "arrow-right-left" },
    assignment: { tone: "accent", label: "Assignment", icon: "user-plus" },
    follow_up_set: { tone: "warning", label: "Follow-up set", icon: "alarm-clock" },
    email: { tone: "neutral", label: "Email", icon: "mail" },
    call: { tone: "neutral", label: "Call", icon: "phone" },
  },
  "queries.status": {
    open: { tone: "warning", label: "Open" },
    waiting_customer: { tone: "info", label: "Waiting on customer" },
    resolved: { tone: "success", label: "Resolved" },
    closed: { tone: "ghost", label: "Closed" },
  },
  "queries.source": {
    form: { tone: "neutral", label: "Form" },
    chatbot: { tone: "info", label: "Chatbot" },
    order: { tone: "accent", label: "Order" },
    dashboard: { tone: "neutral", label: "Dashboard" },
    email: { tone: "neutral", label: "Email" },
    manual: { tone: "neutral", label: "Manual" },
  },
  "query_messages.author_kind": {
    customer: { tone: "accent", label: "Customer" },
    admin: { tone: "info", label: "Admin" },
    system: { tone: "ghost", label: "System" },
  },
  "email_outbox.status": {
    queued: { tone: "warning", label: "Queued" },
    sent: { tone: "success", label: "Sent" },
    failed: { tone: "danger", label: "Failed" },
  },
  "job_runs.status": {
    ok: { tone: "success", label: "OK" },
    error: { tone: "danger", label: "Error" },
  },
  "media.visibility": {
    public: { tone: "neutral", label: "Public" },
    private: { tone: "accent", label: "Private" },
  },
  "faqs.scope": {
    site: { tone: "neutral", label: "Site" },
    chatbot: { tone: "info", label: "Chatbot only" },
    product: { tone: "accent", label: "Product" },
  },
  "testimonials.context": {
    site: { tone: "neutral", label: "Site" },
    product: { tone: "accent", label: "Product" },
  },
  "product.flags": {
    is_featured: { tone: "accent", label: "Featured" },
    is_unlisted: { tone: "ghost", label: "Unlisted" },
    is_coming_soon: { tone: "warning", label: "Coming soon" },
    is_refundable: { tone: "success", label: "Refundable" },
    tax_enabled: { tone: "neutral", label: "Tax" },
  },
  "leads.follow_up": {
    overdue: { tone: "danger", label: "Overdue", icon: "alarm-clock" },
  },
};

/** Full presentation (tone + label + optional icon) for a status value. */
export function statusPresentation<E extends StatusEnum>(
  enumName: E,
  value: StatusValue<E>,
): StatusPresentation {
  const byValue = STATUS_TONES[enumName] as Readonly<Record<string, StatusPresentation>>;
  const hit = byValue[value];
  if (!hit) throw new Error(`status-tone: unknown value "${value}" for ${enumName}`);
  return hit;
}

/** Tone for a status value — docs/08 §6.8 `tone(enumName, value)`. */
export function tone<E extends StatusEnum>(enumName: E, value: StatusValue<E>): Tone {
  return statusPresentation(enumName, value).tone;
}

/** UI label for a status value. */
export function statusLabel<E extends StatusEnum>(enumName: E, value: StatusValue<E>): string {
  return statusPresentation(enumName, value).label;
}

/** Type guard for untyped input (e.g. a DB row read as string). */
export function isStatusValue<E extends StatusEnum>(
  enumName: E,
  value: string,
): value is StatusValue<E> {
  return (STATUS_ENUMS[enumName] as readonly string[]).includes(value);
}

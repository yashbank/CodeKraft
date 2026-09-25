/**
 * Prop types shared by the admin screen components (docs/07 §8.4, ui/screens/admin/*).
 * Components are props-driven and never fetch; Phase 8 maps Server Action results onto these
 * shapes. Money is always `{ amountMinor, currency }` (lib/money); timestamps are ISO strings.
 */
import type { Currency } from "@/lib/money";
import type { StatusValue } from "@/lib/status-tone";

export interface MoneyLike {
  amountMinor: number;
  currency: Currency;
}

export type AdminRole = "super_admin" | "admin" | "staff";

export interface AdminUserRef {
  id: string;
  name: string;
  email?: string;
  role?: AdminRole;
}

export type NotificationType =
  "payments" | "leads" | "queries" | "approvals" | "delivery" | "chatbot" | "system";

export interface AdminNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  at: string;
  read: boolean;
  href?: string;
  /** Inline action; `readMostly` actions stay enabled below `lg` (docs/07 §3.4). */
  action?: { label: string; href: string; readMostly?: boolean };
}

export interface SearchItem {
  group: "Products" | "Orders" | "Customers" | "Leads" | "Go to";
  label: string;
  hint?: string;
  href: string;
}

/* ------------------------------------------------------------------ catalog */

export type ProductStatus = StatusValue<"products.status">;
export type ProductFlag = StatusValue<"product.flags">;

export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: ProductStatus;
  flags: ProductFlag[];
  offerings: number;
  fromPrice?: MoneyLike;
  version: string;
  updatedAt: string;
  updatedBy: string;
  awaitingApprovalId?: string;
  orderCount: number;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  children?: CategoryNode[];
}

export interface OfferingRow {
  id: string;
  name: string;
  purchaseModel: StatusValue<"offerings.purchase_model">;
  billingInterval?: StatusValue<"offerings.billing_interval">;
  deliveryType: StatusValue<"offerings.delivery_type">;
  basePrice: MoneyLike;
  compareAt?: MoneyLike;
  methods: Array<"upi" | "bank">;
  status: StatusValue<"offerings.status">;
  isDefault: boolean;
}

export interface SplitLine {
  partnerId: string;
  partnerName: string;
  /** Basis points (10 000 = 100 %). */
  bps: number;
}

export interface OwnershipVersion {
  version: number;
  companyCutBps: number;
  lines: SplitLine[];
  effectiveFrom: string;
  status: StatusValue<"product_ownerships.status">;
  approvalId?: string;
}

export interface MediaItem {
  id: string;
  kind: string;
  fileName: string;
  alt?: string;
  sizeKb: number;
}

export interface ProductVersionRow {
  version: string;
  releasedAt: string;
  files: number;
  changelog: string;
}

export interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
  title?: string;
  company?: string;
  context: StatusValue<"testimonials.context">;
  product?: string;
  published: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  scope: StatusValue<"faqs.scope">;
  product?: string;
  published: boolean;
}

export interface ProductEditorData {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  category: string;
  tags: string[];
  status: ProductStatus;
  flags: ProductFlag[];
  currentVersion: string;
  description: string;
  features: string[];
  benefits: string[];
  techStack: string[];
  liveDemoUrl?: string;
  media: MediaItem[];
  storageUsedMb: number;
  storageCapMb: number;
  offerings: OfferingRow[];
  ownership: OwnershipVersion[];
  partners: Array<{ id: string; name: string }>;
  seo: { title: string; description: string; canonical?: string };
  blog: {
    title: string;
    slug: string;
    excerpt: string;
    status: StatusValue<"product_blogs.status">;
  };
  versions: ProductVersionRow[];
  testimonials: TestimonialItem[];
  faqs: FaqItem[];
  approval?: { status: StatusValue<"approval_requests.status">; approver: string; at: string };
  savedAgoSeconds: number;
}

export interface CouponRow {
  id: string;
  code: string;
  kind: StatusValue<"coupons.kind">;
  /** Percent in bps for `percent`, or a money amount for `fixed`. */
  valueBps?: number;
  amount?: MoneyLike;
  startsAt: string;
  endsAt?: string;
  used: number;
  max?: number;
  products: string[];
  firstPurchaseOnly: boolean;
  state: StatusValue<"coupons.state">;
  createdBy: string;
}

/* ----------------------------------------------------------------- commerce */

export type ApprovalType = StatusValue<"approval_requests.type">;
export type ApprovalStatus = StatusValue<"approval_requests.status">;

export interface DiffRow {
  label: string;
  before?: string;
  after?: string;
}

export interface ApprovalItem {
  id: string;
  type: ApprovalType;
  subject: string;
  subjectHref?: string;
  requestedBy: AdminUserRef;
  requestedAt: string;
  comment: string;
  status: ApprovalStatus;
  diff: DiffRow[];
  note?: string;
  decision?: {
    by: string;
    at: string;
    decision: StatusValue<"approval_decisions.decision">;
    comment?: string;
  };
  appliedAt?: string;
}

export type OrderStatus = StatusValue<"orders.status">;
export type PaymentStatus = StatusValue<"payments.status">;

export interface OrderRow {
  id: string;
  number: string;
  placedAt: string;
  customer: { name: string; email: string; id: string };
  type: StatusValue<"orders.type">;
  items: string[];
  total: MoneyLike;
  payment: {
    provider: StatusValue<"payments.provider">;
    status: PaymentStatus;
    reference?: string;
  };
  status: OrderStatus;
  expiresAt?: string;
  invoiceNumber?: string;
  /** True when the order sits in the "Awaiting confirmation" queue. */
  awaitingConfirmation: boolean;
}

export interface ServiceStep {
  title: string;
  done: boolean;
  doneBy?: string;
  doneAt?: string;
  note?: string;
}

export interface OrderItemDetail {
  id: string;
  product: string;
  offering: string;
  qty: number;
  unit: MoneyLike;
  discount: MoneyLike;
  tax: MoneyLike;
  total: MoneyLike;
  ownershipVersion?: string;
  deliveryType: StatusValue<"entitlements.delivery_type">;
  entitlement?: {
    status: StatusValue<"entitlements.status">;
    accessEnds?: string;
    downloadsUsed?: number;
    downloadCap?: number;
    keyIssued?: boolean;
    provisioning?: StatusValue<"entitlements.provisioning_state">;
    steps?: ServiceStep[];
  };
  splitSnapshot?: { companyCutBps: number; lines: SplitLine[] };
}

export interface LedgerEntry {
  seq: number;
  at: string;
  type: StatusValue<"ledger_entries.entry_type">;
  party: string;
  partyType: "company" | "partner" | "tax_authority" | "gateway" | "bank" | "customer";
  order?: string;
  amount: MoneyLike;
  fxRate?: string;
  amountInr: number;
  memo: string;
  ref?: string;
  createdBy: string;
}

export interface TimelineEvent {
  at: string;
  actor: string;
  text: string;
  kind?: "system" | "admin" | "customer";
}

export interface OrderDetailData {
  order: OrderRow;
  splitApproval?: { status: ApprovalStatus; approver: string; approvalId: string };
  payment: {
    provider: StatusValue<"payments.provider">;
    status: PaymentStatus;
    due: MoneyLike;
    customerReference?: string;
    submittedAt?: string;
    instructionsSnapshot: string;
    received?: MoneyLike;
    shortfall?: MoneyLike;
    customerCredit?: MoneyLike;
    confirmedBy?: string;
    confirmedAt?: string;
    previousFailed: Array<{ at: string; reason: string }>;
  };
  items: OrderItemDetail[];
  ledger: LedgerEntry[];
  allocation?: {
    companyCut: MoneyLike;
    lines: Array<{ partner: string; amount: MoneyLike; bps: number }>;
  };
  timeline: TimelineEvent[];
  customer: {
    id: string;
    name: string;
    email: string;
    country: string;
    company?: string;
    gstin?: string;
    tags: string[];
    notes?: string;
  };
  billing: { name: string; address: string; country: string };
  coupon?: { code: string; discount: MoneyLike };
  quote?: { id: string; title: string };
  refunds: Array<{
    id: string;
    amount: MoneyLike;
    status: ApprovalStatus;
    creditNote?: string;
    at: string;
  }>;
  refundable: boolean;
  linkedQueries: Array<{ id: string; subject: string; status: StatusValue<"queries.status"> }>;
}

export interface CustomerOption {
  id: string;
  name: string;
  email: string;
}

export interface OfferingOption {
  id: string;
  label: string;
  price: MoneyLike;
  oneTime: boolean;
  owned?: boolean;
}

export interface QuoteRow {
  id: string;
  title: string;
  customer: CustomerOption;
  offering?: string;
  amount: MoneyLike;
  taxApplies: boolean;
  expiresAt: string;
  status: StatusValue<"custom_quotes.status">;
  sentAt?: string;
  orderNumber?: string;
  description?: string;
  internalNote?: string;
  timeline: TimelineEvent[];
  payLink: string;
}

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  company?: string;
  country: string;
  tags: string[];
  activeEntitlements: number;
  lifetimeSpendInr: number;
  openOrders: number;
  openQueries: number;
  status: StatusValue<"users.status">;
  joinedAt: string;
  lastSeenAt?: string;
  anonymisedAt?: string;
}

export interface EntitlementRow {
  id: string;
  customer: CustomerOption;
  product: string;
  offering: string;
  type: StatusValue<"entitlements.delivery_type">;
  status: StatusValue<"entitlements.status">;
  accessEnds?: string;
  subscription?: {
    interval: StatusValue<"offerings.billing_interval">;
    periodEnd: string;
    status: StatusValue<"subscriptions.status">;
  };
  downloadsUsed?: number;
  downloadCap?: number;
  keyIssued?: boolean;
  provisioning: StatusValue<"entitlements.provisioning_state">;
  orderNumber: string;
  orderId: string;
  grantedManually?: boolean;
}

export interface DeliveryTaskRow {
  id: string;
  createdAt: string;
  kind: StatusValue<"delivery_tasks.kind">;
  customer: CustomerOption;
  product: string;
  offering: string;
  entitlementStatus: StatusValue<"entitlements.status">;
  assignedTo?: string;
  note?: string;
  status: StatusValue<"delivery_tasks.status">;
  orderId: string;
  orderNumber: string;
  hints?: string;
}

export interface CustomerDetailData {
  customer: CustomerRow;
  phone?: string;
  stats: {
    lifetimeSpendInr: number;
    orders: number;
    activeEntitlements: number;
    openQueries: number;
  };
  orders: OrderRow[];
  entitlements: EntitlementRow[];
  queries: QueryRow[];
  activity: TimelineEvent[];
  chatUsage: { today: number; cap: number };
  notes: string;
  notesHistory: Array<{ at: string; by: string }>;
  billing: { name: string; address: string; country: string; gstin?: string; lastUsedAt: string };
  preferences: { currency: Currency; theme: string; emailPrefs: string };
  flags: { chargeback: boolean; suspensionReason?: string };
  offeringOptions: OfferingOption[];
}

/* ---------------------------------------------------------------------- crm */

export type LeadStatus = StatusValue<"leads.status">;

export interface LeadRow {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  source: StatusValue<"leads.source">;
  product?: string;
  services: string[];
  status: LeadStatus;
  assignee?: AdminUserRef;
  nextFollowUpAt?: string;
  priority: StatusValue<"leads.priority">;
  createdAt: string;
  wonValue?: MoneyLike;
}

export interface LeadActivity {
  id: string;
  kind: StatusValue<"lead_activities.kind">;
  actor: string;
  at: string;
  text: string;
}

export interface LeadDetailData {
  lead: LeadRow;
  message: string;
  budgetHint?: string;
  submittedAt: string;
  turnstileVerified: boolean;
  ipCountry: string;
  activities: LeadActivity[];
  transcript?: Array<{ role: "user" | "assistant"; text: string }>;
  followUpNote?: string;
  linkedCustomerId?: string;
  related: Array<{ id: string; name: string; status: LeadStatus; createdAt: string }>;
  admins: AdminUserRef[];
}

export interface QueryRow {
  id: string;
  subject: string;
  customer?: CustomerOption;
  visitorEmail?: string;
  source: StatusValue<"queries.source">;
  status: StatusValue<"queries.status">;
  snippet: string;
  updatedAt: string;
  assignee?: AdminUserRef;
  unread: boolean;
  related: Array<{
    kind: "order" | "product" | "entitlement" | "lead" | "conversation";
    label: string;
    href?: string;
  }>;
  refundRequest?: { order: string; method: string; amount: MoneyLike; refundable: boolean };
}

export interface QueryMessage {
  id: string;
  authorKind: StatusValue<"query_messages.author_kind">;
  author: string;
  at: string;
  text: string;
  internal?: boolean;
  attachments?: string[];
}

export interface QueryThread {
  query: QueryRow;
  messages: QueryMessage[];
  chatbotContext?: string[];
  snippets: string[];
}

export interface ConversationRow {
  id: string;
  startedAt: string;
  customer?: string;
  turns: number;
  tokens: number;
  outcomes: Array<"escalated" | "lead" | "fallback" | "cap">;
  model: string;
  promptVersion: string;
}

export interface TranscriptTurn {
  role: "user" | "assistant" | "menu" | "system";
  text: string;
  sources?: string[];
  tokens?: number;
  latencyMs?: number;
  stopReason?: string;
}

export interface PromptVersionRow {
  version: string;
  name: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  notes: string;
  body: string;
}

export interface ChatbotMonitorData {
  conversations: ConversationRow[];
  transcript: { id: string; turns: TranscriptTurn[] };
  usage: {
    today: number;
    cap: number;
    usersAtCap: number;
    perUserCap: number;
    monthMessages: number;
    estimatedCostInr: number;
    fallbackRate: number;
    escalationRate: number;
    daily: Array<{ label: string; value: number }>;
    topUsers: Array<{ email: string; messages: number; atCap: boolean }>;
    models: Array<{ label: string; value: number }>;
    providerDownSince?: string;
  };
  prompts: PromptVersionRow[];
  lastIndexRun: string;
  indexChunks: number;
}

/* ------------------------------------------------------------------ finance */

export interface AllocationRow {
  id: string;
  at: string;
  order: string;
  item: string;
  product: string;
  offering: string;
  gross: MoneyLike;
  discount: MoneyLike;
  tax: MoneyLike;
  gatewayFee: MoneyLike;
  bankCharge: MoneyLike;
  distributable: MoneyLike;
  companyCut: { bps: number; amount: MoneyLike };
  partners: Array<{ name: string; bps: number; amount: MoneyLike }>;
  ownershipVersion: string;
  isRefund?: boolean;
}

export interface PartnerBalance {
  id: string;
  name: string;
  role: string;
  active: boolean;
  balanceInr: number;
  perCurrency: MoneyLike[];
  earnedInr: number;
  paidOutInr: number;
  pendingPayoutApprovals: number;
  sparkline: number[];
  history: Array<{
    month: string;
    allocations: number;
    refunds: number;
    expenses: number;
    payouts: number;
    closing: number;
  }>;
}

export interface PayoutRow {
  id: string;
  paidOn: string;
  partner: string;
  amount: MoneyLike;
  reference: string;
  note?: string;
  recordedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  status: ApprovalStatus;
  ledgerSeq?: number;
  rejectionReason?: string;
}

export interface ExpenseRow {
  id: string;
  at: string;
  description: string;
  category: string;
  product?: string;
  amount: MoneyLike;
  amountInr: number;
  sharedBySplit: boolean;
  receipt?: string;
  recordedBy: string;
  ledgerSeq: number;
}

export interface AdjustmentLine {
  partyType: "company" | "partner" | "tax_authority" | "bank" | "gateway" | "customer";
  partner?: string;
  amount: MoneyLike;
  memo: string;
  order?: string;
}

export interface AdjustmentRow {
  id: string;
  createdAt: string;
  reason: string;
  lines: AdjustmentLine[];
  requestedBy: string;
  approver?: string;
  decidedAt?: string;
  status: ApprovalStatus;
  ledgerSeqs?: number[];
}

export type ReportKey =
  | "revenue_by_period"
  | "revenue_by_product"
  | "revenue_by_partner"
  | "tax_collected"
  | "refunds"
  | "outstanding_payouts"
  | "profit_by_product";

export interface ReportDefinition {
  key: ReportKey;
  title: string;
  description: string;
  formula: string;
  tiles: Array<{ label: string; valueInr: number; delta?: string }>;
  series: Array<{ label: string; value: number }>;
  columns: string[];
  rows: Array<Array<string | number>>;
  totals?: Array<string | number>;
}

export interface CustomerCreditRow {
  order: string;
  payment: string;
  credit: MoneyLike;
  state: "open" | "refunded" | "applied";
}

export interface StatementPreview {
  partner: string;
  period: string;
  opening: number;
  allocations: Array<{ order: string; amount: number }>;
  refunds: number;
  expenseShares: number;
  payouts: number;
  closing: number;
}

export interface StatementHistoryRow {
  id: string;
  partner: string;
  period: string;
  format: "PDF" | "CSV";
  generatedBy: string;
  generatedAt: string;
}

/* ------------------------------------------------------------------ content */

export interface LandingChapter {
  key: "who" | "build" | "sell" | "proof" | "talk";
  title: string;
  subtitle?: string;
  body: string;
  published: boolean;
  poster?: string;
  ctaPrimary?: { label: string; target: string };
  ctaSecondary?: { label: string; target: string };
}

export interface ServiceRow {
  id: string;
  title: string;
  slug: string;
  summary: string;
  icon: string;
  deliverables: string[];
  published: boolean;
}

export interface CaseStudyRow {
  id: string;
  title: string;
  slug: string;
  client: string;
  industry: string;
  tech: string[];
  status: "draft" | "published";
  publishedAt?: string;
  updatedAt: string;
}

export interface ClientLogo {
  id: string;
  name: string;
  url?: string;
  published: boolean;
  lowContrastOnDark?: boolean;
}

export interface LegalPage {
  key: "privacy" | "terms" | "refunds" | "license";
  title: string;
  version: number;
  publishedAt: string;
  hasDraft: boolean;
  body: string;
  effectiveDate: string;
  checklist: Array<{ label: string; done: boolean }>;
  history: Array<{ version: number; publishedAt: string; by: string; summary: string }>;
}

/* ------------------------------------------------------------------- system */

export interface FxRateRow {
  quote: Currency;
  rate: string;
  asOf: string;
  source: string;
  override?: string;
  stale?: boolean;
}

export interface FeatureFlagRow {
  key: string;
  description: string;
  enabled: boolean;
  envOverride?: boolean;
  dependency?: string;
  placeholder?: boolean;
}

export interface SettingsData {
  general: {
    siteName: string;
    domain: string;
    legalName: string;
    address: string;
    phones: string;
    email: string;
    replyTime: string;
    snippets: string[];
  };
  currencies: {
    base: Currency;
    locked: boolean;
    pendingOrders: number;
    enabled: Currency[];
    fx: FxRateRow[];
  };
  tax: { gstin?: string; rateBps: number; sellerState: string };
  payments: {
    upiEnabled: boolean;
    vpa: string;
    payeeName: string;
    bankEnabled: boolean;
    accountName: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    swift?: string;
    instructions: string;
    affectedOfferings: string[];
  };
  theme: { defaultTheme: string; lightEnabled: boolean };
  ai: {
    model: string;
    platformCap: number;
    perUserCap: number;
    timeoutS: number;
    maxTokens: number;
    menuOnly: boolean;
    usedToday: number;
  };
  notifications: {
    email: boolean;
    inApp: boolean;
    whatsapp: boolean;
    digestEnabled: boolean;
    digestTime: string;
    sender: string;
  };
  flags: FeatureFlagRow[];
  retention: { chatMonths: number; recordYears: number; nextPurgeAt: string; lastRunAt: string };
}

export interface AuditRow {
  id: string;
  at: string;
  actor: AdminUserRef & { kind: "admin" | "customer" | "system" };
  action: string;
  subjectType: string;
  subjectId: string;
  subjectHref?: string;
  summary: string;
  ip: string;
  requestId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  userAgent?: string;
  approvalId?: string;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  partner?: { displayName: string; activeShares: number };
  totp: boolean;
  lastSignInAt?: string;
  status: "active" | "invited" | "pending_change";
  pendingApprovalId?: string;
}

/* ---------------------------------------------------------------- dashboard */

export type WidgetKey =
  | "revenue_by_period"
  | "revenue_by_product"
  | "revenue_by_partner"
  | "my_share"
  | "outstanding_payouts"
  | "expenses_vs_profit"
  | "payments_awaiting"
  | "publish_approvals"
  | "split_approvals"
  | "service_checklists"
  | "revocation_tasks"
  | "new_leads"
  | "pipeline_funnel"
  | "overdue_follow_ups"
  | "conversion_rate"
  | "open_queries"
  | "visits_top_products"
  | "chatbot_usage"
  | "catalog_status"
  | "new_customers"
  | "system_health";

export interface QueueItem {
  label: string;
  meta?: string;
  href?: string;
  tone?: "warning" | "danger" | "info" | "success";
  progress?: number;
}

export interface DashboardData {
  range: "7d" | "30d" | "90d" | "fy";
  revenueByPeriod: Array<{ label: string; value: number }>;
  revenueByProduct: Array<{ label: string; value: number }>;
  revenueByPartner: Array<{ label: string; value: number }>;
  myShare: { valueInr: number; delta: string; sparkline: number[] };
  outstandingPayouts: { totalInr: number; items: QueueItem[] };
  expensesVsProfit: Array<{ label: string; expenses: number; profit: number }>;
  paymentsAwaiting: QueueItem[];
  publishApprovals: QueueItem[];
  splitApprovals: QueueItem[];
  serviceChecklists: QueueItem[];
  revocationTasks: QueueItem[];
  newLeads: { count: number; delta: string; items: QueueItem[] };
  funnel: Array<{ label: string; value: number }>;
  overdueFollowUps: QueueItem[];
  conversionRate: { value: number; delta: string };
  openQueries: QueueItem[];
  visits: { total: number; delta: string; top: Array<{ product: string; visits: number }> };
  chatbotUsage: { platform: number; platformCap: number; usersAtCap: number; perUserCap: number };
  catalogStatus: Array<{ status: ProductStatus; count: number }>;
  newCustomers: { count: number; delta: string; sparkline: number[] };
  systemHealth: Array<{ label: string; ok: boolean; detail: string }>;
}

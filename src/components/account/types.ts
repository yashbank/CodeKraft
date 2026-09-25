/**
 * View models for the customer account, checkout and auth screens (docs/07 §2.3, §8.2–§8.3,
 * ui/screens/user/SCR-AUTH-* and SCR-ACC-*). Components in `components/account` are props-driven
 * and render these shapes; Phase 7 maps rows from `modules/*` onto them. No fetching here.
 */
import type { Currency, Money } from "@/lib/money";
import type { StatusValue } from "@/lib/status-tone";

export type DeliveryType = StatusValue<"entitlements.delivery_type">;
export type EntitlementStatus = StatusValue<"entitlements.status">;
export type ProvisioningState = StatusValue<"entitlements.provisioning_state">;
export type UpdatePolicy = StatusValue<"entitlements.update_policy">;
export type SubscriptionStatus = StatusValue<"subscriptions.status">;
export type BillingInterval = StatusValue<"offerings.billing_interval">;
export type OrderStatus = StatusValue<"orders.status">;
export type PaymentStatus = StatusValue<"payments.status">;
export type PaymentProvider = "manual_upi" | "manual_bank";
export type QueryStatus = StatusValue<"queries.status">;
export type QuerySource = StatusValue<"queries.source">;
export type QuoteStatus = StatusValue<"custom_quotes.status">;

export interface BillingDetails {
  name: string;
  company?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2 (`IN`). */
  country: string;
  gstNumber?: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  /** Two-letter initials for the avatar fallback. */
  initials: string;
  displayCurrency: Currency;
  themePref: "dark-cinematic" | "light-editorial" | null;
  reduceMotion: boolean;
  billing: BillingDetails;
  phone?: string;
}

export interface ReleaseFile {
  id: string;
  name: string;
  version: string;
  sizeLabel: string;
  releasedAt: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string[];
}

export interface ServiceStep {
  id: string;
  title: string;
  description?: string;
  state: "open" | "in_progress" | "done";
  doneAt?: string;
  note?: string;
}

export interface SubscriptionInfo {
  interval: BillingInterval;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  nextDue: Money;
  cancelAtPeriodEnd: boolean;
  /** Renew is enabled from 14 days before period end through the grace period (D-521). */
  renewable: boolean;
}

export interface EntitlementSummary {
  id: string;
  productName: string;
  /** Present when the product is published (header links to the product page). */
  productHref?: string;
  offeringName: string;
  deliveryType: DeliveryType;
  status: EntitlementStatus;
  provisioningState: ProvisioningState;
  /** "Lifetime" · "Until 12 Mar 2027" · "Renews 3 Oct · monthly". */
  accessLabel: string;
  /** Type-specific second line ("3 of 5 downloads left", "Key available", …). */
  secondaryLine?: string;
  downloadsUsed?: number;
  downloadsCap?: number;
  keyIssued?: boolean;
  subscription?: SubscriptionInfo;
  purchasedAt: string;
  accessEndsAt?: string;
  orderNumber: string;
  invoiceNumber?: string;
  updatePolicy: UpdatePolicy;
  versionOwned?: string;
  licenseType?: string;
  stepsDone?: number;
  stepsTotal?: number;
}

export interface EntitlementDetail extends EntitlementSummary {
  files?: ReleaseFile[];
  changelog?: ChangelogEntry[];
  licenseKey?: { masked: string; full: string };
  hosted?: { loginUrl: string; username: string; credentialsSentAt: string; expectedBy?: string };
  steps?: ServiceStep[];
  attachments?: { name: string; sizeLabel: string }[];
  /** Post-purchase instructions, one paragraph per entry (offering `instructions_json`). */
  instructions: string[];
}

export interface InvoiceSummary {
  id: string;
  kind: "invoice" | "credit_note";
  number: string;
  /** For credit notes: the invoice they credit. */
  forInvoiceNumber?: string;
  date: string;
  orderNumber: string;
  description: string;
  amount: Money;
  displayAmount?: Money;
  tax: Money | null;
  status: "paid" | "refunded" | "partially_refunded";
}

export interface PaymentSummary {
  id: string;
  date: string;
  orderNumber: string;
  orderHref: string;
  provider: PaymentProvider;
  amountDue: Money;
  reference?: string;
  status: PaymentStatus;
  /** False once the order has expired/failed (retry not offered, BR-10). */
  orderOpen: boolean;
}

export interface OrderLine {
  name: string;
  unit: Money;
  quantity: number;
  discount?: Money;
  taxLabel: string;
  total: Money;
}

export interface PaymentInstructions {
  upi?: { vpa: string; payeeName: string };
  bank?: {
    accountName: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    swift?: string;
  };
}

export interface OrderView {
  id: string;
  number: string;
  placedAt: string;
  status: OrderStatus;
  expiresAt?: string;
  productName: string;
  offeringName: string;
  purchaseModelLine: string;
  deliveryType: DeliveryType;
  lines: OrderLine[];
  subtotal: Money;
  discount?: { code: string; amount: Money };
  tax: Money | null;
  total: Money;
  displayTotal?: Money;
  billing: BillingDetails;
  paymentMethod: PaymentProvider;
  enabledMethods: PaymentProvider[];
  instructionsFor: PaymentInstructions;
  payment?: {
    status: PaymentStatus;
    reference?: string;
    paidOn?: string;
    confirmedAt?: string;
    received?: Money;
    shortfall?: Money;
    failureReason?: string;
  };
  refund?: { amount: Money; creditNoteNumber: string; revokedAt?: string };
  refundable: boolean;
  entitlementId?: string;
  invoiceNumber?: string;
  postPurchaseInstructions?: string[];
  failedReason?: "expired" | "cancelled_by_customer" | "cancelled_by_admin";
}

export interface QueryMessage {
  id: string;
  author: "customer" | "admin" | "system";
  /** Admin first name; rendered as "CodeKraft · Priya". */
  authorName?: string;
  body: string;
  at: string;
  attachments?: { name: string; sizeLabel: string }[];
}

export interface QuerySummary {
  id: string;
  subject: string;
  preview: string;
  status: QueryStatus;
  source: QuerySource;
  relatedLabel?: string;
  relatedHref?: string;
  lastActivityAt: string;
  unread: boolean;
  messages: QueryMessage[];
}

export interface ChatTranscript {
  id: string;
  startedAt: string;
  preview: string;
  escalated: boolean;
}

export type ChatCard =
  | {
      kind: "order";
      orderNumber: string;
      status: OrderStatus;
      steps: { label: string; done: boolean }[];
      href: string;
    }
  | { kind: "downloads"; productName: string; files: { name: string; version: string }[] }
  | { kind: "lead_capture"; summary: string; queryHref?: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "menu";
  text?: string;
  /** Quick-reply chips rendered after a `menu` (or fallback) message. */
  chips?: string[];
  citations?: { label: string; href: string }[];
  card?: ChatCard;
  at: string;
  /** Kept partial message after a dropped stream ("Connection lost — Retry"). */
  interrupted?: boolean;
}

export type NotificationType = "orders" | "delivery" | "renewals" | "queries" | "product_updates";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  at: string;
  read: boolean;
  href: string;
  actionLabel?: string;
}

export interface WishlistItem {
  id: string;
  productName: string;
  category: string;
  productHref: string;
  fromPrice?: Money;
  comingSoon?: boolean;
  customQuote?: boolean;
  owned?: boolean;
  unavailable?: boolean;
  priceDropped?: boolean;
  newVersion?: boolean;
  addedAt: string;
}

export interface QuoteView {
  token: string;
  title: string;
  preparedFor: string;
  validUntil: string;
  status: QuoteStatus;
  description: string[];
  product?: { name: string; offeringName: string; deliveryType: DeliveryType };
  amount: Money;
  displayAmount?: Money;
  tax: Money | null;
  taxLabel: string;
  includes: string[];
  paymentMethods: PaymentProvider[];
  orderHref?: string;
  entitlementHref?: string;
}

export interface CheckoutOffering {
  productName: string;
  offeringName: string;
  purchaseModelLine: string;
  deliveryType: DeliveryType;
  unit: Money;
  taxLabel: string;
  tax: Money | null;
  enabledMethods: PaymentProvider[];
  displayCurrency: Currency;
  /** Whole-number display-currency rate hint for the "≈" estimate (preview only). */
  displayEstimate?: Money;
  renewal?: { periodLabel: string };
  productHref: string;
}

export interface SessionInfo {
  device: string;
  ip: string;
  lastActiveAt: string;
}

export interface AuthEvent {
  id: string;
  kind: "login" | "logout" | "password_reset" | "session_replaced";
  at: string;
  device: string;
}

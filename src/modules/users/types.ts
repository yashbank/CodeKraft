/**
 * Users domain types — docs/05 §1 (users, customer_profiles, partners), docs/06 §2.1 API-AUTH-02..08,
 * §2.7 API-ADM-06..09/11/12, §2.12 API-DASH-01..03, D-512 scopes, D-1108.
 */
import type { userStatus } from "../../../drizzle/schema/auth";
import type { BillingAddress, NotificationPrefs } from "../../../drizzle/schema/users-ext";
import type { Permission, Role } from "@/lib/authz/permissions";
import type { Currency } from "@/lib/money";
import type { ThemeName } from "@/lib/theme";
import { enumTuple } from "../catalog/types";

export type { Session, User } from "../../../drizzle/schema/auth";
export type { CustomerProfile, Partner } from "../../../drizzle/schema/users-ext";
export type { BillingAddress, NotificationPrefs };

export type UserStatus = (typeof userStatus.enumValues)[number];
export const USER_STATUSES = enumTuple<UserStatus>()(["active", "suspended", "deleted"] as const);

/** Roles an admin invitation may grant (API-ADM-11). */
export const ADMIN_INVITE_ROLES = [
  "admin",
  "super_admin",
  "staff",
] as const satisfies readonly Role[];
export type AdminInviteRole = (typeof ADMIN_INVITE_ROLES)[number];

export const AUTH_METHODS = ["password", "google", "phone"] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

/** Public projection of a user (never email-unverified PII beyond what the caller owns). */
export interface UserView {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  phoneNumber: string | null;
  status: UserStatus;
  displayCurrency: Currency;
  themePref: ThemeName | null;
  twoFactorEnabled: boolean;
  createdAt: string;
}

/** API-AUTH-02 `getMe`. */
export interface Me {
  user: UserView;
  roles: Role[];
  permissions: Permission[];
  displayCurrency: Currency;
  themePref: ThemeName | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  partner?: { id: string; displayName: string; active: boolean };
}

export interface CustomerProfileView {
  userId: string;
  company: string | null;
  billingName: string | null;
  billingAddress: BillingAddress | null;
  country: string | null;
  gstNumber: string | null;
  tags: string[];
  notificationPrefs: NotificationPrefs;
}

/** API-AUTH-04 output. */
export interface AccountSettings {
  displayCurrency: Currency;
  themePref: ThemeName | null;
}

export interface SessionView {
  id: string;
  current: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  host: string;
  createdAt: string;
  expiresAt: string;
}

/** API-ADM-06 row / detail. */
export interface CustomerRow {
  user: UserView;
  profile: CustomerProfileView | null;
  stats: { orders: number; spentInrMinor: number; entitlements: number };
  lastOrderAt: string | null;
}

export type CustomerTimelineKind =
  "order" | "payment" | "entitlement" | "query" | "note" | "login" | "status";

export interface CustomerTimelineItem {
  at: string;
  kind: CustomerTimelineKind;
  summary: string;
  ref?: { type: string; id: string };
}

export interface CustomerDetail extends CustomerRow {
  internalNotes: string | null;
  timeline: CustomerTimelineItem[];
}

/** API-ADM-12 row; bank details are never returned in clear (masked last-4). */
export interface PartnerView {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  active: boolean;
  hasPayoutDetails: boolean;
  payoutAccountLast4: string | null;
  activeShareCount: number;
  createdAt: string;
}

/** `approval_requests.payload` for `admin.user_change` (API-ADM-11). */
export type AdminUserChangePayload =
  | { op: "invite"; email: string; role: AdminInviteRole; partner?: { displayName: string } }
  | { op: "change_role"; userId: string; role: AdminInviteRole }
  | { op: "remove"; userId: string };

/* --- API-DASH-* -------------------------------------------------------------------------- */

export interface UpcomingRenewal {
  entitlementId: string;
  product: { slug: string; name: string };
  periodEnd: string;
  graceUntil: string | null;
}

/** API-DASH-01; `EntitlementView` is owned by domain C (`modules/entitlements`). */
export interface DashboardOverview<EntitlementView = unknown> {
  activeEntitlements: EntitlementView[];
  pendingOrders: number;
  upcomingRenewals: UpcomingRenewal[];
  openQueries: number;
  unreadNotifications: number;
  wishlistCount: number;
}

/** API-DASH-02 item. */
export interface PaymentHistoryItem {
  orderNo: string;
  paymentId: string;
  method: string;
  status: string;
  amountDue: { amountMinor: number; currency: Currency };
  amountReceived: { amountMinor: number; currency: Currency } | null;
  reference: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
}

/** API-DASH-03. */
export interface SecurityOverview {
  sessions: SessionView[];
  emailVerified: boolean;
  authMethods: AuthMethod[];
  lastLoginAt: string | null;
}

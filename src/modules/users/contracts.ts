/**
 * Users contracts — docs/06 API-AUTH-02..08 (profile, settings, sessions, TOTP, delete account),
 * API-ADM-06..09 (customers), API-ADM-11 (admin users, `admin.user_change` approval),
 * API-ADM-12 (partners), API-DASH-01..03 (customer dashboard reads), BR-18, D-1003, D-1108.
 * Password strength itself is `modules/auth/password-policy.ts` (service-level, needs the email).
 */
import { z } from "zod";
import type { RequestContext } from "@/lib/authz/context";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { PASSWORD_MAX } from "../auth/password-policy";
import { type ListResult, currencySchema, listParams, uuidSchema } from "@/modules/_shared/zod";
import { text } from "../catalog/contracts";
import {
  bankDetailsSchema,
  countryCodeSchema,
  gstinSchema,
  postalAddressSchema,
  themeNameSchema,
} from "../settings/contracts";
import {
  ADMIN_INVITE_ROLES,
  USER_STATUSES,
  type AccountSettings,
  type AdminUserChangePayload,
  type CustomerDetail,
  type CustomerProfileView,
  type CustomerRow,
  type DashboardOverview,
  type Me,
  type PartnerView,
  type PaymentHistoryItem,
  type SecurityOverview,
  type SessionView,
  type UserView,
} from "./types";

export const userStatusSchema = z.enum(USER_STATUSES);
export const adminInviteRoleSchema = z.enum(ADMIN_INVITE_ROLES);
export const passwordSchema = z.string().min(1).max(PASSWORD_MAX);
export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, "6 digits");

/* --- API-AUTH-03..08 ------------------------------------------------------------------------ */

/** API-AUTH-03 `updateProfile`. */
export const updateProfileSchema = z.strictObject({
  name: text(120),
  image: uuidSchema.optional(),
  billing: z
    .strictObject({
      billingName: text(120),
      company: text(120).optional(),
      address: postalAddressSchema.optional(),
      country: countryCodeSchema,
      gstNumber: gstinSchema.optional(),
    })
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** API-AUTH-04 `updateSettings` (`light-editorial` → `FORBIDDEN` while the flag is off, D-1602). */
export const updateAccountSettingsSchema = z
  .strictObject({
    displayCurrency: currencySchema.optional(),
    themePref: themeNameSchema.nullable().optional(),
  })
  .refine((s) => s.displayCurrency !== undefined || s.themePref !== undefined, "nothing to update");
export type UpdateAccountSettingsInput = z.infer<typeof updateAccountSettingsSchema>;

/** API-AUTH-05 `changeEmailRequest` (current password required). */
export const changeEmailRequestSchema = z.strictObject({
  newEmail: z.email().max(254),
  currentPassword: passwordSchema,
});
/** API-AUTH-05 `changePassword`. */
export const changePasswordSchema = z
  .strictObject({
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
    revokeOtherSessions: z.boolean().default(true),
  })
  .refine((p) => p.currentPassword !== p.newPassword, {
    message: "new password must differ",
    path: ["newPassword"],
  });

/** API-AUTH-06 `revokeSession`. */
export const revokeSessionSchema = z.strictObject({ sessionId: uuidSchema });

/** API-AUTH-07 TOTP wrappers (admin-class only, D-1202). */
export const enableTotpSchema = z.strictObject({ password: passwordSchema });
export const verifyTotpSchema = z.strictObject({ code: totpCodeSchema });
export const disableTotpSchema = z.strictObject({ password: passwordSchema });

/** API-AUTH-08 `deleteAccount` (password required for credential accounts — service check). */
export const deleteAccountSchema = z.strictObject({
  password: passwordSchema.optional(),
  confirmPhrase: z.literal("DELETE"),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/* --- API-ADM-06..09 customers ------------------------------------------------------------- */

/** API-ADM-06 `listCustomers`. */
export const listCustomersSchema = listParams(
  ["createdAt", "lastOrderAt"],
  z.strictObject({
    status: userStatusSchema.optional(),
    tag: text(40).optional(),
    country: countryCodeSchema.optional(),
    hasOrders: z.boolean().optional(),
  }),
);
export type ListCustomersInput = z.infer<typeof listCustomersSchema>;
/** API-ADM-06 `getCustomer`. */
export const getCustomerSchema = z.strictObject({ userId: uuidSchema });

/** API-ADM-07 `updateCustomerNotes` (D-1108). */
export const updateCustomerNotesSchema = z
  .strictObject({
    userId: uuidSchema,
    internalNotes: z.string().trim().max(5000).optional(),
    tags: z.array(text(40)).max(20).optional(),
  })
  .refine((n) => n.internalNotes !== undefined || n.tags !== undefined, "nothing to update");
export type UpdateCustomerNotesInput = z.infer<typeof updateCustomerNotesSchema>;

/** API-ADM-08 `suspendCustomer` / `reinstateCustomer`. */
export const customerStatusChangeSchema = z.strictObject({
  userId: uuidSchema,
  reason: text(500),
});

/** API-ADM-09 `sendResetLink` / `sendMagicLink`. */
export const sendAuthLinkSchema = z.strictObject({
  userId: uuidSchema,
  kind: z.enum(["reset", "magic"]),
});

/* --- API-ADM-11 admin users ------------------------------------------------------------------ */

/** API-ADM-11 `inviteAdmin`. */
export const inviteAdminSchema = z.strictObject({
  email: z.email().max(254),
  role: adminInviteRoleSchema,
  partner: z.strictObject({ displayName: text(120) }).optional(),
});
/** API-ADM-11 `changeAdminRole`. */
export const changeAdminRoleSchema = z.strictObject({
  userId: uuidSchema,
  role: adminInviteRoleSchema,
});
/** API-ADM-11 `removeAdmin`. */
export const removeAdminSchema = z.strictObject({ userId: uuidSchema });

/** `admin.user_change` payload validated before apply. */
export const adminUserChangePayloadSchema = z.discriminatedUnion("op", [
  z.strictObject({
    op: z.literal("invite"),
    email: z.email(),
    role: adminInviteRoleSchema,
    partner: z.strictObject({ displayName: text(120) }).optional(),
  }),
  z.strictObject({ op: z.literal("change_role"), userId: uuidSchema, role: adminInviteRoleSchema }),
  z.strictObject({ op: z.literal("remove"), userId: uuidSchema }),
]) satisfies z.ZodType<AdminUserChangePayload>;

export interface AdminUserChangeResult {
  approvalRequestId: string;
  /** Present when the resulting active admin-class set has < 2 members (MASTER_SPEC §7 "Approver set"). */
  warning?: "fewer_than_two_admins";
}

/* --- API-ADM-12 partners ------------------------------------------------------------------- */

export const listPartnersSchema = listParams(
  ["displayName", "createdAt"],
  z.strictObject({ active: z.boolean().optional() }),
);
/** API-ADM-12 `updatePartner` (bank details encrypted at rest via `lib/crypto`). */
export const updatePartnerSchema = z
  .strictObject({
    partnerId: uuidSchema,
    displayName: text(120).optional(),
    payoutBankDetails: bankDetailsSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (p) =>
      p.displayName !== undefined || p.payoutBankDetails !== undefined || p.active !== undefined,
    "nothing to update",
  );
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;

/* --- Service ---------------------------------------------------------------------------------- */

export interface UsersService {
  /** API-AUTH-02 */
  getMe(ctx: RequestContext, tx?: DbOrTx): Promise<Me>;
  /** API-AUTH-03 */
  updateProfile(
    ctx: RequestContext,
    input: UpdateProfileInput,
    tx?: DbOrTx,
  ): Promise<{ user: UserView; profile: CustomerProfileView }>;
  /** API-AUTH-04 — also returns the cookie values (`ck_currency`, `ck_theme`) the action refreshes. */
  updateSettings(
    ctx: RequestContext,
    input: UpdateAccountSettingsInput,
    tx?: DbOrTx,
  ): Promise<{ settings: AccountSettings }>;
  /** API-AUTH-05 (Better Auth `changeEmail` wrapper; `E: email-change-verify`). */
  changeEmailRequest(
    ctx: RequestContext,
    input: z.infer<typeof changeEmailRequestSchema>,
  ): Promise<{ ok: true }>;
  /** API-AUTH-05 (Better Auth `changePassword` wrapper; policy from `modules/auth/password-policy`). */
  changePassword(
    ctx: RequestContext,
    input: z.infer<typeof changePasswordSchema>,
  ): Promise<{ ok: true }>;
  /** API-AUTH-06 */
  listSessions(ctx: RequestContext, tx?: DbOrTx): Promise<{ sessions: SessionView[] }>;
  /** API-AUTH-06 */
  revokeSession(
    ctx: RequestContext,
    input: z.infer<typeof revokeSessionSchema>,
    tx?: DbOrTx,
  ): Promise<{ sessions: SessionView[] }>;
  /** API-AUTH-07 (admin-class only). */
  enableTotp(
    ctx: RequestContext,
    input: z.infer<typeof enableTotpSchema>,
  ): Promise<{ totpUri: string; backupCodes: string[] }>;
  /** API-AUTH-07 */
  verifyTotp(ctx: RequestContext, input: z.infer<typeof verifyTotpSchema>): Promise<{ ok: true }>;
  /** API-AUTH-07 */
  disableTotp(ctx: RequestContext, input: z.infer<typeof disableTotpSchema>): Promise<{ ok: true }>;
  /** API-AUTH-08 — one transaction: anonymise PII, clear profile, revoke sessions, cancel subscriptions (BR-18). */
  deleteAccount(
    ctx: RequestContext,
    input: DeleteAccountInput,
    tx?: DbOrTx,
  ): Promise<{ anonymizedAt: string }>;
  /** API-ADM-06 (query). */
  listCustomers(
    ctx: RequestContext,
    input: ListCustomersInput,
    tx?: DbOrTx,
  ): Promise<ListResult<CustomerRow>>;
  /** API-ADM-06 (query). */
  getCustomer(
    ctx: RequestContext,
    input: z.infer<typeof getCustomerSchema>,
    tx?: DbOrTx,
  ): Promise<CustomerDetail>;
  /** API-ADM-07 */
  updateCustomerNotes(
    ctx: RequestContext,
    input: UpdateCustomerNotesInput,
    tx?: DbOrTx,
  ): Promise<{ profile: CustomerProfileView }>;
  /** API-ADM-08 — revokes sessions; `E: account-suspended`. */
  suspendCustomer(
    ctx: RequestContext,
    input: z.infer<typeof customerStatusChangeSchema>,
    tx?: DbOrTx,
  ): Promise<{ user: UserView }>;
  /** API-ADM-08 */
  reinstateCustomer(
    ctx: RequestContext,
    input: z.infer<typeof customerStatusChangeSchema>,
    tx?: DbOrTx,
  ): Promise<{ user: UserView }>;
  /** API-ADM-09 (`kind: 'reset'`). */
  sendResetLink(
    ctx: RequestContext,
    input: z.infer<typeof sendAuthLinkSchema>,
    tx?: DbOrTx,
  ): Promise<{ sentTo: string }>;
  /** API-ADM-09 (`kind: 'magic'`). */
  sendMagicLink(
    ctx: RequestContext,
    input: z.infer<typeof sendAuthLinkSchema>,
    tx?: DbOrTx,
  ): Promise<{ sentTo: string }>;
  /** API-ADM-11 → `approvals.request('admin.user_change', …)`. */
  inviteAdmin(
    ctx: RequestContext,
    input: z.infer<typeof inviteAdminSchema>,
    tx?: DbOrTx,
  ): Promise<AdminUserChangeResult>;
  /** API-ADM-11 */
  changeAdminRole(
    ctx: RequestContext,
    input: z.infer<typeof changeAdminRoleSchema>,
    tx?: DbOrTx,
  ): Promise<AdminUserChangeResult>;
  /** API-ADM-11 (`STATE_INVALID` for the last super_admin or a partner with an active share). */
  removeAdmin(
    ctx: RequestContext,
    input: z.infer<typeof removeAdminSchema>,
    tx?: DbOrTx,
  ): Promise<AdminUserChangeResult>;
  /** API-ADM-11 apply handler for `admin.user_change`: `user_roles`, `partners`, invitation email. */
  applyAdminUserChange(payload: AdminUserChangePayload, tx: TxCtx): Promise<void>;
  /** API-ADM-12 (query). */
  listPartners(
    ctx: RequestContext,
    input: z.infer<typeof listPartnersSchema>,
    tx?: DbOrTx,
  ): Promise<ListResult<PartnerView>>;
  /** API-ADM-12 */
  updatePartner(
    ctx: RequestContext,
    input: UpdatePartnerInput,
    tx?: DbOrTx,
  ): Promise<{ partner: PartnerView }>;
  /** API-DASH-01 (customer query, D-1001). */
  getDashboardOverview(ctx: RequestContext, tx?: DbOrTx): Promise<DashboardOverview>;
  /** API-DASH-02 (customer query). */
  getPaymentHistory(ctx: RequestContext, tx?: DbOrTx): Promise<{ items: PaymentHistoryItem[] }>;
  /** API-DASH-03 (customer query). */
  getSecurityOverview(ctx: RequestContext, tx?: DbOrTx): Promise<SecurityOverview>;
}

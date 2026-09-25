/**
 * Entitlements — Zod inputs and output types for docs/06 §2.5 API-DEL-01/02/03/06/11/12/13/14
 * (`modules/entitlements`). Delivery tasks (DEL-07..10) live in `modules/delivery`, subscriptions
 * (DEL-04/05/14) in `modules/subscriptions`.
 *
 * Conventions (docs/06 §1.3): Zod-first, `.strict()` objects, trimmed strings, `uuid` ids,
 * ISO-8601 UTC timestamps. `EntitlementView` (API-DEL-01) is a Zod *output* schema so that P5
 * (delivery) and P7 (customer dashboard) consume one inferred type (PHASE-02 P2.7 risk note).
 */
import { z } from "zod";
import {
  isoDateTimeSchema as isoDateTime,
  listParams as sharedListParams,
  uuidSchema as uuid,
} from "@/modules/_shared/zod";
import type { DeliveryTypeValue, UpdatePolicyValue } from "../../../drizzle/schema/offerings";

// ---------------------------------------------------------------------------------------------
// Primitives — canonical set in `_shared/zod.ts` (P2.8), re-exported under the domain-C names
// ---------------------------------------------------------------------------------------------

export {
  uuidSchema as uuid,
  isoDateTimeSchema as isoDateTime,
  type ListResult,
} from "@/modules/_shared/zod";

/**
 * docs/06 §1.8 list params: cursor, limit 1–100 (default 25), `field:asc|desc`, typed filters, q.
 * Domain-C spelling of `_shared/zod.ts` `listParams` (takes a raw filter shape, wraps it in a
 * `strictObject`).
 */
export function listParams<const F extends readonly [string, ...string[]], S extends z.ZodRawShape>(
  sortFields: F,
  filters: S,
) {
  return sharedListParams(sortFields, z.strictObject(filters));
}

// ---------------------------------------------------------------------------------------------
// Enums (mirrors of the Postgres enums in drizzle/schema/{offerings,delivery}.ts — kept as plain
// tuples so client forms never import drizzle; the `satisfies` clauses keep them in sync)
// ---------------------------------------------------------------------------------------------

export const DELIVERY_TYPES = [
  "saas",
  "hosted",
  "download",
  "license",
  "service",
  "custom",
] as const satisfies readonly DeliveryTypeValue[];
export type DeliveryType = (typeof DELIVERY_TYPES)[number];
type _DeliveryTypesExhaustive =
  Exclude<DeliveryTypeValue, DeliveryType> extends never ? true : never;
const _deliveryTypesExhaustive: _DeliveryTypesExhaustive = true;
void _deliveryTypesExhaustive;

export const UPDATE_POLICIES = [
  "all_free",
  "during_access",
  "major_paid",
] as const satisfies readonly UpdatePolicyValue[];
export type UpdatePolicy = (typeof UPDATE_POLICIES)[number];

export const ENTITLEMENT_STATUSES = [
  "pending",
  "active",
  "suspended",
  "expired",
  "revoked",
] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export const PROVISIONING_STATES = ["n/a", "pending", "done"] as const;
export type ProvisioningState = (typeof PROVISIONING_STATES)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "cancelled",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const deliveryTypeSchema = z.enum(DELIVERY_TYPES);
export const entitlementStatusSchema = z.enum(ENTITLEMENT_STATUSES);
export const provisioningStateSchema = z.enum(PROVISIONING_STATES);
export const updatePolicySchema = z.enum(UPDATE_POLICIES);

// ---------------------------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------------------------

/** API-DEL-01 `listMyEntitlements` — `delivery.self`; scoped to the caller's own rows. */
export const listMyEntitlementsSchema = listParams(["createdAt", "status", "accessEndsAt"], {
  status: entitlementStatusSchema.optional(),
  deliveryType: deliveryTypeSchema.optional(),
});
export type ListMyEntitlementsInput = z.infer<typeof listMyEntitlementsSchema>;

/** API-DEL-01 `getMyEntitlement`. */
export const getMyEntitlementSchema = z.object({ entitlementId: uuid }).strict();
export type GetMyEntitlementInput = z.infer<typeof getMyEntitlementSchema>;

/** API-DEL-02 `issueDownloadLink` — cap check (BR-15), rate class `download`. */
export const issueDownloadLinkSchema = z.object({ entitlementId: uuid, mediaId: uuid }).strict();
export type IssueDownloadLinkInput = z.infer<typeof issueDownloadLinkSchema>;

/** API-DEL-03 `revealLicenseKey` — rate class `key_reveal`; audited `license.revealed`. */
export const revealLicenseKeySchema = z.object({ entitlementId: uuid }).strict();
export type RevealLicenseKeyInput = z.infer<typeof revealLicenseKeySchema>;

/** API-DEL-06 `listEntitlementsAdmin` — `delivery.tasks.write` (admin scope: own products). */
export const listEntitlementsAdminSchema = listParams(
  ["createdAt", "status", "accessEndsAt", "updatedAt"],
  {
    status: z.array(entitlementStatusSchema).min(1).max(5).optional(),
    deliveryType: deliveryTypeSchema.optional(),
    productId: uuid.optional(),
    userId: uuid.optional(),
    provisioningState: provisioningStateSchema.optional(),
  },
);
export type ListEntitlementsAdminInput = z.infer<typeof listEntitlementsAdminSchema>;

/** API-DEL-06 `getEntitlementAdmin`. */
export const getEntitlementAdminSchema = z.object({ entitlementId: uuid }).strict();
export type GetEntitlementAdminInput = z.infer<typeof getEntitlementAdminSchema>;

/**
 * API-DEL-11 `grantEntitlement` — `entitlements.admin`. Manual grant: no order, invoice, ledger
 * entry or allocation (D-1108, MASTER_SPEC §7 "Manual entitlement grants"); `reason` is mandatory
 * (1..500) and lands in the audit row; not dual-approved.
 */
export const grantEntitlementSchema = z
  .object({
    userId: uuid,
    offeringId: uuid,
    /** Months of access from now; `null`/absent = offering default (lifetime for one-time). */
    accessMonths: z.number().int().min(1).max(120).nullable().optional(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export type GrantEntitlementInput = z.infer<typeof grantEntitlementSchema>;

/** API-DEL-12 `revokeEntitlement` — `entitlements.admin`; handler `onRevoked` decides automatic vs task (D-607). */
export const revokeEntitlementSchema = z
  .object({ entitlementId: uuid, reason: z.string().trim().min(1).max(500) })
  .strict();
export type RevokeEntitlementInput = z.infer<typeof revokeEntitlementSchema>;

/** API-DEL-13 `resetDownloadCount` — `entitlements.admin` (D-606). */
export const resetDownloadCountSchema = z
  .object({ entitlementId: uuid, newCap: z.number().int().min(1).max(1000).optional() })
  .strict();
export type ResetDownloadCountInput = z.infer<typeof resetDownloadCountSchema>;

/**
 * API-DEL-14 `extendAccess` — `entitlements.admin`. Exactly one of `accessEndsAt` (one-time,
 * `null` = lifetime) or `periodEnd` (subscription `current_period_end`).
 */
export const extendAccessSchema = z
  .object({
    entitlementId: uuid,
    accessEndsAt: isoDateTime.nullable().optional(),
    periodEnd: isoDateTime.optional(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict()
  .superRefine((v, ctx) => {
    const hasAccess = v.accessEndsAt !== undefined;
    const hasPeriod = v.periodEnd !== undefined;
    if (hasAccess === hasPeriod) {
      ctx.addIssue({
        code: "custom",
        path: hasAccess ? ["periodEnd"] : ["accessEndsAt"],
        message: "Provide exactly one of accessEndsAt or periodEnd",
      });
    }
  });
export type ExtendAccessInput = z.infer<typeof extendAccessSchema>;

// ---------------------------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------------------------

/** One downloadable build shown on the dashboard (filtered by `update_policy` and access window). */
export const releaseFileViewSchema = z.object({
  mediaId: uuid,
  version: z.string(),
  name: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  releasedAt: isoDateTime,
  notes: z.string().nullable(),
});
export type ReleaseFileView = z.infer<typeof releaseFileViewSchema>;

export const serviceProgressViewSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  doneAt: isoDateTime.nullable(),
});
export type ServiceProgressView = z.infer<typeof serviceProgressViewSchema>;

export const provisioningNotesSchema = z
  .object({
    loginUrl: z.url().optional(),
    username: z.string().max(200).optional(),
    message: z.string().max(2000).optional(),
  })
  .strict();
export type ProvisioningNotes = z.infer<typeof provisioningNotesSchema>;

export const subscriptionViewSchema = z.object({
  subscriptionId: uuid,
  interval: z.enum(["monthly", "quarterly", "annual"]),
  status: z.enum(SUBSCRIPTION_STATUSES),
  periodStart: isoDateTime,
  periodEnd: isoDateTime,
  graceUntil: isoDateTime.nullable(),
  cancelAtPeriodEnd: z.boolean(),
  renewalOrderNo: z.string().nullable(),
  /** "Renew now" is offered from 14 d before `periodEnd` through grace (SCR-ACC-03). */
  canRenew: z.boolean(),
});
export type SubscriptionView = z.infer<typeof subscriptionViewSchema>;

/**
 * API-DEL-01 `EntitlementView` — the customer-facing shape. The per-type fields (`downloads`,
 * `licenseKeyMasked`, `provisioning`, `serviceProgress`, `custom`) come from the delivery handler's
 * `customerView` (see `modules/delivery/handler.ts`); the rest is filled by the service.
 */
export const entitlementViewSchema = z.object({
  entitlementId: uuid,
  product: z.object({ id: uuid, name: z.string(), slug: z.string(), published: z.boolean() }),
  offering: z.object({ id: uuid, name: z.string() }),
  deliveryType: deliveryTypeSchema,
  status: entitlementStatusSchema,
  access: z.object({ startsAt: isoDateTime, endsAt: isoDateTime.nullable() }),
  updatePolicy: updatePolicySchema,
  /** `orderNo` is null for manual grants (D-1108). */
  orderNo: z.string().nullable(),
  invoiceNo: z.string().nullable(),
  grantedAt: isoDateTime,
  /** Sanitised HTML rendered from `offerings.instructions_json` (A-601). */
  instructionsHtml: z.string().nullable(),
  versions: z.array(
    z.object({ version: z.string(), releasedAt: isoDateTime, changelog: z.string().nullable() }),
  ),
  downloads: z
    .object({
      used: z.number().int().nonnegative(),
      cap: z.number().int().nonnegative().nullable(),
      files: z.array(releaseFileViewSchema),
    })
    .optional(),
  /** `•••• •••• •••• 4F2A`; `null` when no key has been issued yet. */
  licenseKeyMasked: z.string().nullable().optional(),
  provisioning: z
    .object({ state: provisioningStateSchema, notes: provisioningNotesSchema.nullable() })
    .optional(),
  serviceProgress: z.array(serviceProgressViewSchema).optional(),
  custom: z
    .object({
      attachments: z.array(
        z.object({ mediaId: uuid, name: z.string(), sizeBytes: z.number().int().nonnegative() }),
      ),
      statusNote: z.string().nullable(),
    })
    .optional(),
  subscription: subscriptionViewSchema.optional(),
});
export type EntitlementView = z.infer<typeof entitlementViewSchema>;

/** API-DEL-02 output: 5-minute presigned GET, `response-content-disposition=attachment`. */
export interface DownloadLinkResult {
  url: string;
  expiresAt: string;
  downloadsRemaining: number;
}

/** API-DEL-03 output: decrypted server-side per call, never cached. */
export interface LicenseKeyReveal {
  licenseKey: string;
}

/** API-DEL-06 row: the entitlement plus the handler's `adminActions`. */
export interface EntitlementAdminRow {
  entitlementId: string;
  user: { id: string; email: string; name: string | null };
  product: { id: string; name: string };
  offering: { id: string; name: string };
  deliveryType: DeliveryType;
  status: EntitlementStatus;
  provisioningState: ProvisioningState;
  accessEndsAt: string | null;
  downloads: { used: number; cap: number | null } | null;
  licenseKeyIssued: boolean;
  orderNo: string | null;
  grantedManuallyBy: string | null;
  openTasks: number;
  adminActions: EntitlementAdminAction[];
  createdAt: string;
}

export const ENTITLEMENT_ADMIN_ACTION_KEYS = [
  "complete_provisioning",
  "set_license_key",
  "mark_service_step",
  "complete_task",
  "reset_download_count",
  "extend_access",
  "revoke",
  "cancel_subscription",
] as const;
export type EntitlementAdminActionKey = (typeof ENTITLEMENT_ADMIN_ACTION_KEYS)[number];

/** One button on the admin entitlement screen (SCR-ADM-12); `apiId` names the action it calls. */
export interface EntitlementAdminAction {
  key: EntitlementAdminActionKey;
  label: string;
  apiId: string;
  enabled: boolean;
  /** Why it is disabled (e.g. "no key issued"), shown as a tooltip. */
  disabledReason?: string;
}

export interface GrantEntitlementResult {
  entitlementId: string;
}

export interface RevokeEntitlementResult {
  entitlement: EntitlementAdminRow;
  /** Present when the handler opened a `delivery_tasks(revoke_external)` row (D-607). */
  taskId?: string;
}

/**
 * Ownership contracts — docs/06 API-CAT-16 (`proposeOwnership`), API-CAT-17
 * (`applyOwnershipChange`, internal apply handler run by `approvals.execute`), §5.4, BR-05.
 *
 * The 10000-bps sum is a business rule checked by the service (and the DB trigger), not here:
 * Zod validates each line's range and partner uniqueness only, so form errors stay per-field.
 */
import { z } from "zod";
import type { RequestContext } from "@/lib/authz/context";
import type { DbOrTx, TxCtx } from "@/lib/db";
import {
  type ListResult,
  bpsSchema,
  isoDateTimeSchema,
  listParams,
  uuidSchema,
} from "@/modules/_shared/zod";
import {
  OWNERSHIP_STATUSES,
  OWNERSHIP_TOTAL_BPS,
  type OwnershipChangePayload,
  type OwnershipSummary,
  type OwnershipVersionView,
} from "./types";

export const ownershipStatusSchema = z.enum(OWNERSHIP_STATUSES);

/** A partner's share: 1..10000 bps (100 % to one partner is allowed, BR-07). */
export const ownershipLineSchema = z.strictObject({
  partnerId: uuidSchema,
  shareBps: bpsSchema.min(1),
});

/** API-CAT-16 `proposeOwnership` — effective-dated version proposal (n+1, `pending`). */
export const proposeOwnershipSchema = z.strictObject({
  productId: uuidSchema,
  companyCutBps: bpsSchema,
  lines: z
    .array(ownershipLineSchema)
    .min(1)
    .max(20)
    .refine((lines) => new Set(lines.map((l) => l.partnerId)).size === lines.length, {
      message: "each partner may appear once",
    }),
  effectiveFrom: isoDateTimeSchema.optional(),
});
export type ProposeOwnershipInput = z.infer<typeof proposeOwnershipSchema>;
export interface ProposeOwnershipResult {
  ownershipId: string;
  approvalRequestId: string;
}

/** API-CAT-17 approval payload (`ownership.change`), validated before apply. */
export const ownershipChangePayloadSchema = z.strictObject({
  ownershipId: uuidSchema,
  productId: uuidSchema,
  effectiveFrom: isoDateTimeSchema.optional(),
}) satisfies z.ZodType<OwnershipChangePayload>;

/** Admin read of a product's ownership history (API-CAT-19 block; `own_products` scope). */
export const listOwnershipVersionsSchema = listParams(
  ["version"],
  z.strictObject({ productId: uuidSchema, status: ownershipStatusSchema.optional() }),
);

/** Pure helper contract: Σ lines === 10000 (service-level check mirroring the trigger). */
export function sumsToTotal(lines: readonly { shareBps: number }[]): boolean {
  return lines.reduce((acc, l) => acc + l.shareBps, 0) === OWNERSHIP_TOTAL_BPS;
}

export interface OwnershipService {
  /** API-CAT-16 — `VALIDATION` sum ≠ 10000 / inactive partner; `STATE_INVALID` if a `pending` version exists. */
  proposeOwnership(
    ctx: RequestContext,
    input: ProposeOwnershipInput,
    tx?: DbOrTx,
  ): Promise<ProposeOwnershipResult>;
  /**
   * API-CAT-17 — apply handler for `ownership.change` (registered via
   * `approvals.registerApplyHandler('ownership.change', …)`): previous `active` → `superseded`,
   * new → `active`, `effective_from = max(now, requested)`; existing `allocations` untouched (BR-05).
   */
  applyOwnershipChange(payload: OwnershipChangePayload, tx: TxCtx): Promise<void>;
  /** API-ADM-03 reject handler for `ownership.change`: the `pending` version is deleted. */
  onOwnershipChangeRejected(payload: OwnershipChangePayload, tx: TxCtx): Promise<void>;
  /** API-CAT-01 — initial v1 `pending` (100 % to the creating partner) when the creator is a partner. */
  createInitial(productId: string, creatorPartnerId: string | null, tx: TxCtx): Promise<void>;
  /** API-CAT-12 — flips a `pending` version to `active` when approved in the same request; `STATE_INVALID` without one. */
  activateForPublish(productId: string, tx: TxCtx): Promise<void>;
  /** Version active at a point in time — the §4.2 rule for allocations (`finance` reads it at payment time). */
  getActiveAt(productId: string, at: Date, tx?: DbOrTx): Promise<OwnershipVersionView | null>;
  /** Admin list of a product's ownership versions (API-CAT-19). */
  listVersions(
    ctx: RequestContext,
    input: z.infer<typeof listOwnershipVersionsSchema>,
    tx?: DbOrTx,
  ): Promise<ListResult<OwnershipVersionView>>;
  /** Summary for API-CAT-18 rows (active, else latest pending). */
  summaryFor(productIds: readonly string[], tx?: DbOrTx): Promise<Map<string, OwnershipSummary>>;
}

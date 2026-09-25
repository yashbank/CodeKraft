/**
 * Ownership domain types — docs/05 §4 (effective-dated, dual-approved partner splits),
 * docs/06 API-CAT-16/17, §5.4, BR-05/06/07, D-506, D-509. Never exposed publicly (BR-02).
 */
import type { ownershipStatus } from "../../../drizzle/schema/ownership";
import { enumTuple } from "../catalog/types";

export type { ProductOwnership, ProductOwnershipLine } from "../../../drizzle/schema/ownership";

export type OwnershipStatus = (typeof ownershipStatus.enumValues)[number];
export const OWNERSHIP_STATUSES = enumTuple<OwnershipStatus>()([
  "pending",
  "active",
  "superseded",
] as const);

/** Σ `shareBps` per version must equal this (trigger `ownership_lines_sum`, BR-06). */
export const OWNERSHIP_TOTAL_BPS = 10_000;

export interface OwnershipLineView {
  partnerId: string;
  displayName: string;
  shareBps: number;
}

/** One `product_ownerships` version with its lines (API-CAT-19 `ownership versions`). */
export interface OwnershipVersionView {
  id: string;
  productId: string;
  version: number;
  status: OwnershipStatus;
  companyCutBps: number;
  lines: OwnershipLineView[];
  /** ISO-8601; null while `pending`. */
  effectiveFrom: string | null;
  approvalRequestId: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
}

/** Compact summary for admin lists (API-CAT-18 `ownership summary`). */
export interface OwnershipSummary {
  version: number;
  status: OwnershipStatus;
  companyCutBps: number;
  partners: OwnershipLineView[];
}

/** `approval_requests.payload` for `ownership.change` (API-CAT-16 → API-CAT-17). */
export interface OwnershipChangePayload {
  ownershipId: string;
  productId: string;
  /** ISO-8601 requested effective date; apply uses `max(now, effectiveFrom)`. */
  effectiveFrom?: string;
}

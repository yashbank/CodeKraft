/**
 * Pure allocation computation (docs/06 §4.2, BR-06, BR-07, FI-01, FI-02).
 *
 * Implements largest-remainder split allocation:
 * distributable = gross − discount − tax − gatewayFee − bankShortfall
 * company = distributable × companyCutBps / 10000 (half-up)
 * partner shares = largest-remainder allocation of (distributable − company)
 */
import {
  type ComputeAllocation,
  type SpreadDeduction,
  computeAllocationReference,
  spreadDeductionReference,
} from "./types";

export const computeAllocation: ComputeAllocation = computeAllocationReference;
export const spreadDeduction: SpreadDeduction = spreadDeductionReference;

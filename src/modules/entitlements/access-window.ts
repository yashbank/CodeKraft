/**
 * Access window — D-605 (lifetime vs `accessMonths`), docs/06 §5.7 step 2, PHASE-05 P5.1.
 *
 * `access_starts_at` = the paid/granted instant; `access_ends_at` = `startsAt + accessMonths`
 * (calendar months, day clamped to month length — `lib/dates.addMonths`) or `null` for lifetime.
 * Subscription entitlements take the subscription's `current_period_end` instead. Pure.
 */
import { addMonths } from "@/lib/dates";
import type { DeliveryConfig } from "../../../drizzle/schema/offerings";

export interface AccessWindow {
  startsAt: Date;
  /** `null` = lifetime (D-605). */
  endsAt: Date | null;
}

export interface ComputeAccessWindowInput {
  startsAt: Date;
  /** Admin override (API-DEL-11 `accessMonths`); `undefined` = use the offering default. */
  accessMonths?: number | null;
  deliveryConfig: Pick<DeliveryConfig, "accessMonths">;
  /** Present for subscription offerings: the period end wins. */
  periodEnd?: Date | null;
}

export function computeAccessWindow(input: ComputeAccessWindowInput): AccessWindow {
  const startsAt = new Date(input.startsAt.getTime());
  if (input.periodEnd instanceof Date) {
    return { startsAt, endsAt: new Date(input.periodEnd.getTime()) };
  }
  const months =
    input.accessMonths === undefined ? input.deliveryConfig.accessMonths : input.accessMonths;
  if (months === null || months === undefined) return { startsAt, endsAt: null };
  if (!Number.isInteger(months) || months < 1) {
    throw new RangeError(`accessMonths must be a positive integer, got ${String(months)}`);
  }
  return { startsAt, endsAt: addMonths(startsAt, months) };
}

/** `true` while `startsAt <= now` and (`endsAt` is null or `now < endsAt`). */
export function isWithinAccessWindow(
  window: { accessStartsAt: Date; accessEndsAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (window.accessStartsAt.getTime() > now.getTime()) return false;
  return window.accessEndsAt === null || now.getTime() < window.accessEndsAt.getTime();
}

/** One-time access that has passed its end (candidate for `entitlements.expire`, D-605). */
export function hasAccessEnded(
  window: { accessEndsAt: Date | null },
  now: Date = new Date(),
): boolean {
  return window.accessEndsAt !== null && window.accessEndsAt.getTime() < now.getTime();
}

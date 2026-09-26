/**
 * Access window calculations for entitlements (D-605, MASTER_SPEC §7).
 * accessMonths:
 *   - null / undefined / 0: lifetime access (returns null)
 *   - > 0: computes startsAt + accessMonths, clamping month-end dates correctly.
 */
export function calculateAccessEndsAt(
  startsAt: Date,
  accessMonths?: number | null,
): Date | null {
  if (accessMonths === null || accessMonths === undefined || accessMonths <= 0) {
    return null;
  }

  const result = new Date(startsAt.getTime());
  const currentDay = result.getUTCDate();
  
  result.setUTCMonth(result.getUTCMonth() + accessMonths);
  
  // If date overflowed to next month (e.g. Jan 31 + 1 mo -> Mar 2 in leap year / Mar 3), clamp to last day of target month
  if (result.getUTCDate() !== currentDay) {
    result.setUTCDate(0); // Sets to last day of previous month
  }

  return result;
}

/**
 * Checks whether an entitlement is currently within its access window.
 */
export function isWithinAccessWindow(
  startsAt: Date,
  endsAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (now < startsAt) return false;
  if (endsAt === null) return true;
  return now <= endsAt;
}

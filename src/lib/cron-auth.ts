import { timingSafeEqual } from "node:crypto";

/**
 * Authorise a Vercel cron request (`Authorization: Bearer <CRON_SECRET>`).
 * Fails closed when CRON_SECRET is unset, except in test/development.
 */
export function isCronAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";
  if (authHeader === null) return false;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

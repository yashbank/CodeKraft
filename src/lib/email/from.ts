/** P14-04 — admin-editable "From" (Settings → Email): validation + `"Name <addr>"` formatting. */
import { z } from "zod";

export const emailFromNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[^"<>\r\n]+$/, 'must not contain " < > or line breaks');
export const emailFromAddressSchema = z.string().trim().pipe(z.email().max(254));

/** `"Name <addr>"`, or null when the address is unset/invalid (callers then fall back to EMAIL_FROM). */
export function formatFrom(
  name: string | null | undefined,
  address: string | null | undefined,
  siteName: string,
): string | null {
  const addr = emailFromAddressSchema.safeParse(address ?? "");
  if (!addr.success) return null;
  const display = (name ?? "").replace(/["<>\r\n]/g, "").trim() || siteName;
  return `${display} <${addr.data}>`;
}

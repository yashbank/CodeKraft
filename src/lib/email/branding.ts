/**
 * R8-11 — outgoing email follows the admin-editable site name (Settings → General).
 * Subjects are authored with the default product name; these helpers swap it for the configured
 * one at send time, and rename the display part of `EMAIL_FROM` (`"Name <addr>"`).
 */
import { DEFAULT_SITE_NAME } from "@/lib/brand-constants";

export function brandSubject(subject: string, siteName: string): string {
  if (!siteName || siteName === DEFAULT_SITE_NAME) return subject;
  return subject.split(DEFAULT_SITE_NAME).join(siteName);
}

/** `"CodeKraft <hi@x.dev>"` → `"<siteName> <hi@x.dev>"`; a bare address is returned unchanged. */
export function brandFromAddress(from: string, siteName: string): string {
  if (!siteName) return from;
  const m = /^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/.exec(from);
  if (!m) return from;
  const name = siteName.replace(/["<>\r\n]/g, "").trim();
  return name ? `${name} <${m[2]}>` : from;
}

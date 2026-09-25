/**
 * Display helpers for the account screens (docs/07 §4.13): dates as "24 Sep 2026", relative times
 * in lists, masked emails. `now` is always passed in so server and client render the same text.
 */
import { IST_TIME_ZONE } from "@/lib/dates";

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: IST_TIME_ZONE,
});
const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: IST_TIME_ZONE,
});

export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/** "2 h ago", "3 d ago", or the absolute date beyond a week. */
export function relativeTime(iso: string, now: string): string {
  const diff = new Date(now).getTime() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(iso);
}

/** "5 days 3 h" until `iso`, or `null` once passed. */
export function timeUntil(iso: string, now: string): string | null {
  const diff = new Date(iso).getTime() - new Date(now).getTime();
  if (diff <= 0) return null;
  const totalHours = Math.floor(diff / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days === 0) return `${Math.max(hours, 1)} h`;
  return `${days} day${days === 1 ? "" : "s"} ${hours} h`;
}

/** Day heading for grouped lists: "Today", "Yesterday", else the date. */
export function dayLabel(iso: string, now: string): string {
  const day = formatDate(iso);
  const today = formatDate(now);
  if (day === today) return "Today";
  const yesterday = formatDate(new Date(new Date(now).getTime() - 86_400_000).toISOString());
  if (day === yesterday) return "Yesterday";
  return day;
}

/** `pravin@iauro.com` → `p•••@iauro.com` (never show the full email to a visitor). */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain}`;
}

/** `+919876543242` → `+91 •••• ••42`. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const last = digits.slice(-2);
  const cc = phone.startsWith("+") ? `+${digits.slice(0, digits.length - 10)}` : "";
  return `${cc} •••• ••${last}`.trim();
}

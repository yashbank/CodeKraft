/**
 * Display helpers for admin screens (docs/07 §4.13): dates as "24 Sep 2026", relative in lists,
 * money via lib/money. All functions are pure and deterministic given `now`, so server and
 * client render the same string.
 */
import { format as formatMoney, type Currency } from "@/lib/money";
import type { MoneyLike } from "./types";

const TZ = "Asia/Kolkata";

export function money(m: MoneyLike): string {
  return formatMoney({ amountMinor: m.amountMinor, currency: m.currency });
}

export function inr(amountMinor: number): string {
  return formatMoney({ amountMinor, currency: "INR" });
}

/** Signed money with an explicit "+" for credits; `credit`/`debit` word for screen readers. */
export function signedMoney(m: MoneyLike): { text: string; label: string; negative: boolean } {
  const negative = m.amountMinor < 0;
  const abs = { amountMinor: Math.abs(m.amountMinor), currency: m.currency };
  return {
    text: `${negative ? "−" : "+"}${money(abs)}`,
    label: `${money(abs)} ${negative ? "debit" : "credit"}`,
    negative,
  };
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(new Date(iso));
}

/** "2 h ago" / "in 3 d" relative to `now` (ISO). Deterministic for SSR. */
export function timeAgo(iso: string, now: string): string {
  const diffMs = new Date(now).getTime() - new Date(iso).getTime();
  const future = diffMs < 0;
  const s = Math.abs(diffMs) / 1000;
  let text: string;
  if (s < 60) text = "just now";
  else if (s < 3600) text = `${Math.floor(s / 60)} min`;
  else if (s < 86400) text = `${Math.floor(s / 3600)} h`;
  else if (s < 86400 * 30) text = `${Math.floor(s / 86400)} d`;
  else text = `${Math.floor(s / (86400 * 30))} mo`;
  if (text === "just now") return text;
  return future ? `in ${text}` : `${text} ago`;
}

/** Whole days between `now` and `iso` (negative when `iso` is in the past). */
export function daysUntil(iso: string, now: string): number {
  return Math.round((new Date(iso).getTime() - new Date(now).getTime()) / 86400000);
}

export function hoursSince(iso: string, now: string): number {
  return (new Date(now).getTime() - new Date(iso).getTime()) / 3600000;
}

export function percentFromBps(bps: number): string {
  return `${(bps / 100).toFixed(2)} %`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(
    n,
  );
}

export function plainNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

export const CURRENCY_LABEL: Record<Currency, string> = {
  INR: "Indian rupee",
  USD: "US dollar",
  EUR: "Euro",
  GBP: "Pound sterling",
  CAD: "Canadian dollar",
};

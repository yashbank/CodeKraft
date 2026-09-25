import type { Money } from "@/lib/money";
import { format as formatMoney } from "@/lib/money";

import type { BillingInterval, DeliveryType, PurchaseModel, UpdatePolicy } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** docs/07 §4.13: dates as "24 Sep 2026" (UTC calendar date of the ISO string). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getUTCDate())} ${MONTHS[d.getUTCMonth()] ?? ""} ${String(d.getUTCFullYear())}`;
}

/** Locale-aware money via `lib/money.format` (never floats). */
export function price(m: Money): string {
  return formatMoney(m);
}

export const PURCHASE_MODEL_LABEL: Readonly<Record<PurchaseModel, string>> = {
  one_time: "One-time purchase",
  subscription: "Subscription",
  custom_quote: "Custom quote",
};

export const BILLING_INTERVAL_LABEL: Readonly<Record<BillingInterval, string>> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export const DELIVERY_LABEL: Readonly<Record<DeliveryType, string>> = {
  saas: "SaaS / hosted",
  hosted: "Hosted account",
  download: "Download",
  license: "License key",
  service: "Product + service",
  custom: "Custom",
};

/** "Delivered as: …" hint on the offering card (SCR-SITE-04 copy notes). */
export const DELIVERY_HINT: Readonly<Record<DeliveryType, string>> = {
  saas: "Hosted account",
  hosted: "Hosted account",
  download: "Download",
  license: "License key",
  service: "Product + onboarding service",
  custom: "Custom",
};

/** D-604 update policy line. */
export const UPDATE_POLICY_LABEL: Readonly<Record<UpdatePolicy, string>> = {
  all_free: "All future updates included",
  during_access: "Updates during your access period",
  major_paid: "Major versions sold separately",
};

/** Short chip label for a purchase model + interval ("Monthly", "One-time", "Quote"). */
export function modelChip(model: PurchaseModel, interval?: BillingInterval): string {
  if (model === "subscription") return interval ? BILLING_INTERVAL_LABEL[interval] : "Subscription";
  if (model === "custom_quote") return "Quote";
  return "One-time";
}

/** Heading text → anchor id ("Data we collect" → "data-we-collect"). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

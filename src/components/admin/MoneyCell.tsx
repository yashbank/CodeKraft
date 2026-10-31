"use client";

import { cn } from "@/components/ui/_utils";
import { viewLocked } from "@/lib/admin/currency-view";
import { format as formatMoney } from "@/lib/money";
import { useAdminCurrency } from "./AdminCurrency";
import type { MoneyLike } from "./types";

/**
 * Money in tables — docs/08 §6.7: mono, tabular numerals, right-aligned, negatives in danger.
 * Shown in the viewing admin's currency; when that differs from the stored one the stored original
 * is the small second line (and tooltip). `inrEquivalent` is the row's locked INR amount (ledger /
 * expense rows) so history converts at its posting rate, not today's.
 */
export function MoneyCell({
  value,
  signed = false,
  inrEquivalent,
  className,
}: {
  value: MoneyLike;
  signed?: boolean;
  /** Locked INR paise for this row; converting through it keeps historical rows on their locked rate. */
  inrEquivalent?: number;
  className?: string;
}) {
  const cfg = useAdminCurrency();
  const negative = value.amountMinor < 0;
  const v = viewLocked(
    { amountMinor: Math.abs(value.amountMinor), currency: value.currency },
    inrEquivalent === undefined ? undefined : Math.abs(inrEquivalent),
    cfg,
  );
  const body = formatMoney({ amountMinor: v.amountMinor, currency: v.currency });
  const approx = v.approx ? "≈ " : "";
  const original = v.original
    ? formatMoney({
        amountMinor: negative ? -v.original.amountMinor : v.original.amountMinor,
        currency: v.original.currency,
      })
    : undefined;
  const secondary = original ? (
    <span className="block text-caption text-fg-muted">{original}</span>
  ) : null;
  if (signed) {
    return (
      <span
        className={cn("block text-right font-mono tnum", negative && "text-danger", className)}
        aria-label={`${approx}${body} ${negative ? "debit" : "credit"}`}
        title={original}
      >
        {negative ? "−" : "+"}
        {approx}
        {body}
        {secondary}
      </span>
    );
  }
  return (
    <span className={cn("block text-right font-mono tnum", className)} title={original}>
      {approx}
      {negative ? formatMoney({ amountMinor: -v.amountMinor, currency: v.currency }) : body}
      {secondary}
    </span>
  );
}

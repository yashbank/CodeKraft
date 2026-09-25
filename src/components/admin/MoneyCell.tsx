import { cn } from "@/components/ui/_utils";
import { money, signedMoney } from "./format";
import type { MoneyLike } from "./types";

/** Money in tables — docs/08 §6.7: mono, tabular numerals, right-aligned, negatives in danger. */
export function MoneyCell({
  value,
  signed = false,
  inrEquivalent,
  className,
}: {
  value: MoneyLike;
  signed?: boolean;
  /** INR paise equivalent shown as a second line when the currency is not INR. */
  inrEquivalent?: number;
  className?: string;
}) {
  if (signed) {
    const s = signedMoney(value);
    return (
      <span
        className={cn("block text-right font-mono tnum", s.negative && "text-danger", className)}
        aria-label={s.label}
      >
        {s.text}
      </span>
    );
  }
  return (
    <span className={cn("block text-right font-mono tnum", className)}>
      {money(value)}
      {value.currency !== "INR" && inrEquivalent !== undefined ? (
        <span className="block text-caption text-fg-muted">
          ≈ {money({ amountMinor: inrEquivalent, currency: "INR" })}
        </span>
      ) : null}
    </span>
  );
}

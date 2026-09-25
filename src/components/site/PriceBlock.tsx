import { cn } from "@/components/ui/_utils";
import type { Money } from "@/lib/money";

import { price } from "./_format";

/**
 * Price display (docs/08 §6.3 footer, §6.12): "From ₹X" with optional strike-through compare-at,
 * or "Custom quote" / "Coming soon". Always symbol + two decimals via `lib/money.format`.
 */
export function PriceBlock({
  amount,
  compareAt,
  prefix,
  suffix,
  fallback = "Custom quote",
  size = "md",
  className,
}: {
  amount?: Money;
  compareAt?: Money;
  /** "From" on cards. */
  prefix?: string;
  /** "/ month" on subscriptions. */
  suffix?: string;
  /** Shown when there is no amount. */
  fallback?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const valueClass = {
    sm: "text-body font-semibold",
    md: "text-price",
    lg: "text-h2 font-display",
  }[size];
  if (!amount) {
    return <span className={cn("text-body font-semibold text-fg", className)}>{fallback}</span>;
  }
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5 text-fg", className)}>
      {prefix ? <span className="text-body-sm text-fg-muted">{prefix}</span> : null}
      <span className={cn(valueClass, "tnum")}>{price(amount)}</span>
      {suffix ? <span className="text-body-sm text-fg-muted">{suffix}</span> : null}
      {compareAt && compareAt.amountMinor > amount.amountMinor ? (
        <s className="text-body-sm text-fg-subtle tnum">
          <span className="sr-only">Was </span>
          {price(compareAt)}
        </s>
      ) : null}
    </span>
  );
}

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES, type Currency } from "@/lib/money";

/** Display-currency selector (docs/07 §4.3): flag-less ISO codes INR · USD · EUR · GBP · CAD. */
export function CurrencySelect({
  value,
  options = CURRENCIES,
  onChange,
  size = "sm",
  id,
  className,
}: {
  value: Currency;
  /** Only these are offered (admin-enabled currencies); defaults to all supported. */
  options?: readonly Currency[];
  onChange?: (next: Currency) => void;
  size?: "sm" | "default";
  id?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange?.(v as Currency)}>
      <SelectTrigger id={id} size={size} aria-label="Display currency" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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
  onChange,
  size = "sm",
  id,
  className,
}: {
  value: Currency;
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
        {CURRENCIES.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

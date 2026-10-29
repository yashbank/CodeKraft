"use client";

import { useRouter } from "next/navigation";

import { CurrencySelect } from "@/components/account/CurrencySelect";
import { CURRENCY_COOKIE } from "@/lib/display-currency";
import type { Currency } from "@/lib/money";

/** Header currency selector: persists `ck_currency` and re-renders server prices. Hidden with <2 options. */
export function CurrencySwitcher({
  currency,
  options,
  className,
}: {
  currency: Currency;
  options: readonly Currency[];
  className?: string;
}) {
  const router = useRouter();
  if (options.length < 2) return null;
  return (
    <CurrencySelect
      value={currency}
      options={options}
      className={className}
      onChange={(next) => {
        document.cookie = `${CURRENCY_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    />
  );
}

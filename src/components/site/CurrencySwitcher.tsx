"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CurrencySelect } from "@/components/account/CurrencySelect";
import { CURRENCY_COOKIE, resolveDisplayCurrency } from "@/lib/display-currency";
import type { Currency } from "@/lib/money";
import { updateMyAccountSettings } from "@/modules/users/site-mutations";

/**
 * Header currency selector. Static layouts cannot read cookies, so the current value is read from
 * `document.cookie` after mount (`currency` is the site default). Persists `ck_currency` (and the
 * user's saved preference when signed in), then re-renders server prices. Hidden with <2 options.
 */
export function CurrencySwitcher({
  currency: base,
  options,
  signedIn = false,
  className,
}: {
  currency: Currency;
  options: readonly Currency[];
  signedIn?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<Currency>(base);
  useEffect(() => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${CURRENCY_COOKIE}=([^;]*)`));
    setCurrent(resolveDisplayCurrency(m?.[1], options, base));
  }, [options, base]);
  if (options.length < 2) return null;
  return (
    <CurrencySelect
      value={current}
      options={options}
      className={className}
      onChange={(next) => {
        setCurrent(next);
        document.cookie = `${CURRENCY_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        if (signedIn)
          void updateMyAccountSettings({ displayCurrency: next }).catch(() => undefined);
        router.refresh();
      }}
    />
  );
}

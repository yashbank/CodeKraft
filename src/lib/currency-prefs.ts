/** Client-safe display-currency helpers (no server imports: client components import this, not display-currency.ts). */
import { isCurrency, type Currency } from "./money";

export const CURRENCY_COOKIE = "ck_currency";

/** Cookie value if it is an enabled currency, else the site base currency (disabled/garbage -> default). */
export function resolveDisplayCurrency(
  cookie: string | null | undefined,
  enabled: readonly Currency[],
  base: Currency,
): Currency {
  return isCurrency(cookie) && enabled.includes(cookie) ? cookie : base;
}

/** Symbol for a currency ("₹", "$", ...), used for price-filter labels. */
export function currencySymbol(currency: Currency): string {
  return (
    new Intl.NumberFormat("en", { style: "currency", currency })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency
  );
}

/** Visitor display currency: `ck_currency` cookie, limited to the admin-enabled currencies. */
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

export interface DisplayCurrencyContext {
  currency: Currency;
  enabled: Currency[];
}

/** Server-only: selected display currency + the list the selector may offer. */
export async function getDisplayCurrency(): Promise<DisplayCurrencyContext> {
  const [{ cookies }, { settingsService }] = await Promise.all([
    import("next/headers"),
    import("@/modules/settings/service"),
  ]);
  const settings = await settingsService.load();
  const enabled = settings.enabledCurrencies.includes(settings.baseCurrency)
    ? settings.enabledCurrencies
    : [settings.baseCurrency, ...settings.enabledCurrencies];
  const cookie = (await cookies()).get(CURRENCY_COOKIE)?.value;
  return { currency: resolveDisplayCurrency(cookie, enabled, settings.baseCurrency), enabled };
}

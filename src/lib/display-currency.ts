/** Visitor display currency: `ck_currency` cookie, limited to the admin-enabled currencies. */
import { CURRENCY_COOKIE, resolveDisplayCurrency } from "./currency-prefs";
import { isCurrency, type Currency } from "./money";

export { CURRENCY_COOKIE, resolveDisplayCurrency, currencySymbol } from "./currency-prefs";

export interface DisplayCurrencyContext {
  currency: Currency;
  enabled: Currency[];
}

async function readEnabled(): Promise<{ base: Currency; enabled: Currency[] }> {
  const { settingsService } = await import("@/modules/settings/service");
  const s = await settingsService.load();
  const enabled = s.enabledCurrencies.includes(s.baseCurrency)
    ? s.enabledCurrencies
    : [s.baseCurrency, ...s.enabledCurrencies];
  return { base: s.baseCurrency, enabled };
}

/** Cached (no cookies/headers read): safe for static layouts. */
export async function getEnabledCurrencies(): Promise<{ base: Currency; enabled: Currency[] }> {
  try {
    const { unstable_cache } = await import("next/cache");
    return await unstable_cache(readEnabled, ["site:enabled-currencies"], {
      tags: ["settings"],
      revalidate: 300,
    })();
  } catch {
    return readEnabled();
  }
}

/** Server-only, price pages only (reads cookies): user pref -> `ck_currency` -> base, enabled-only. */
export async function getDisplayCurrency(): Promise<DisplayCurrencyContext> {
  const [{ cookies }, { base, enabled }] = await Promise.all([
    import("next/headers"),
    getEnabledCurrencies(),
  ]);
  let userPref: string | undefined;
  try {
    const { getSession } = await import("@/modules/auth/service");
    userPref = (await getSession())?.user?.displayCurrency as string | undefined;
  } catch {
    // anonymous / auth unavailable
  }
  const cookie = (await cookies()).get(CURRENCY_COOKIE)?.value;
  const pick = (v: string | undefined) => (isCurrency(v) && enabled.includes(v) ? v : null);
  return { currency: pick(userPref) ?? resolveDisplayCurrency(cookie, enabled, base), enabled };
}

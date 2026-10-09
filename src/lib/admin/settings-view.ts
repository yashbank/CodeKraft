/**
 * View-model mapper for the admin Settings screen (SCR-ADM-29) — `modules/settings`' `SiteSettings`
 * -> `components/admin/types.ts` `SettingsData` shape. Kept out of the page and out of the screen
 * component, per the `queries-view.ts` / `customers-view.ts` convention.
 *
 * `SiteSettings` (the real, persisted shape) and `SettingsData` (the UI shape, originally built
 * against `_fixtures/admin.ts`) line up for roughly half the screen and diverge for the rest.
 * Every field below is either a direct real mapping or an explicitly honest fallback — nothing
 * here is fabricated to "look" like fixture data. Known gaps, by section:
 *
 *  - `general`: `SiteSettings` has no `siteName`/`domain`/`legalName`/`address`/`phones`/`email`/
 *    `replyTime`/`snippets` fields at all — the closest real data is the nullable `sellerDetails`
 *    object (`name`/`address{line1,line2,city,state,postalCode,country}`/`contactPhones[]`/
 *    `email`), which has a different shape than the flat UI fields (e.g. one address string vs a
 *    structured address). `siteName` is the one honest exception — it's the product's own name,
 *    a fixed fact, not per-tenant settings data. `domain` reads the real `NEXT_PUBLIC_SITE_URL`
 *    env var. Everything else falls back to `""` / `[]` when `sellerDetails` is unset, rather than
 *    fabricating a legal name or address.
 *  - `currencies.locked`/`pendingOrders`: computing these for real means a `paid`-orders-count
 *    query (the same check `settingsService.updateSettings` itself does against `orders` before
 *    allowing a base-currency change) — left as `false`/`0` here (display hint only; the server
 *    still enforces the real lock on write regardless of what this badge shows).
 *  - `currencies.fx`: no FX-rate table/cache is exposed through `modules/settings` — `[]` (an
 *    honest empty "FX rates" table, not fabricated rates).
 *  - `tax.sellerState`: not a dedicated field — read from `sellerDetails.address.state` when set.
 *  - `payments.payeeName`/`swift`/`instructions`/`affectedOfferings`: no matching columns on
 *    `bankDetailsSchema` (`accountName`/`accountNumber`/`ifsc`/`bankName`/`branch` only) or
 *    elsewhere — `""`/`[]`.
 *  - `theme.lightEnabled`: real — mirrors `settings.flags.theme_light_editorial`.
 *  - `ai.maxTokens`/`usedToday`: no persisted "max output tokens" setting exists; today's usage
 *    count lives in the chatbot module's own usage tracking (a different module), not here —
 *    `0` for both rather than a cross-module fetch for two display-only numbers.
 *  - `notifications`: `SiteSettings` has no notification-preference fields at all. `whatsapp`
 *    mirrors the real `flags.whatsapp_channel` (the one field that *does* exist); `email`/`inApp`
 *    reflect the fixed business rule already stated in the screen's own copy ("customers get
 *    email + in-app; admins are in-app only", D-707) rather than a configurable toggle;
 *    `sender` reads the real `EMAIL_FROM` env var; `digestEnabled`/`digestTime` have no backing
 *    source — `false`/`""`.
 *  - `retention.nextPurgeAt`/`lastRunAt`: no job-run log exists for the retention purge — left as
 *    `undefined`; the screen component shows "—" instead of calling `formatDateTime` on them
 *    (avoids crashing on an empty/invalid date string).
 */
import { getEnv } from "@/lib/env";
import { getFlagFromEnv, type FlagKey } from "@/lib/feature-flags";
import type { SiteSettings } from "@/modules/settings/types";
import type { FeatureFlagRow, SettingsData } from "@/components/admin/types";

/** Static descriptive metadata for the Feature flags table — not settings *data*, just the
 * fixed copy (description/dependency) every flag needs regardless of its current value. */
const FLAG_METADATA: Record<FlagKey, { description: string; dependency?: string }> = {
  phone_otp: { description: "Phone OTP sign-in/verification." },
  whatsapp_channel: { description: "WhatsApp notification channel for customers." },
  theme_light_editorial: { description: "Enables the Light editorial theme for visitors." },
  provider_razorpay: {
    description: "Razorpay as a payment method.",
    dependency: "Needs Razorpay API keys configured.",
  },
  provider_stripe: {
    description: "Stripe as a payment method.",
    dependency: "Needs Stripe API keys configured.",
  },
  provider_paypal: {
    description: "PayPal as a payment method.",
    dependency: "Needs PayPal API keys configured.",
  },
  automated_provisioning: { description: "Automated (vs. manual) entitlement provisioning." },
  three_hero: { description: "3D hero scene on the site home page (kill switch)." },
  bundles: { description: "Product bundles (V1.1)." },
  vendor_marketplace: { description: "Multi-vendor marketplace (V2)." },
};

function mapFlags(flags: SiteSettings["flags"]): FeatureFlagRow[] {
  return (Object.keys(FLAG_METADATA) as FlagKey[]).map((key) => ({
    key,
    description: FLAG_METADATA[key].description,
    enabled: flags[key],
    envOverride: getFlagFromEnv(key) !== undefined,
    dependency: FLAG_METADATA[key].dependency,
  }));
}

export function mapSiteSettingsToSettingsData(settings: SiteSettings): SettingsData {
  const env = getEnv();
  const seller = settings.sellerDetails;
  const bank = settings.bankDetails;

  return {
    general: {
      // The product's own name — a fixed fact, not per-tenant settings data.
      siteName: "CodeKraft",
      domain: env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, ""),
      legalName: seller?.name ?? "",
      address: seller
        ? [
            seller.address.line1,
            seller.address.line2,
            seller.address.city,
            seller.address.state,
            seller.address.postalCode,
            seller.address.country,
          ]
            .filter(Boolean)
            .join(", ")
        : "",
      phones: seller?.contactPhones.join(", ") ?? "",
      email: seller?.email ?? "",
      replyTime: "",
      snippets: [],
    },
    currencies: {
      base: settings.baseCurrency,
      locked: false,
      pendingOrders: 0,
      enabled: settings.enabledCurrencies,
      fx: [],
    },
    tax: {
      gstin: settings.gstin ?? undefined,
      rateBps: settings.taxRateBps,
      sellerState: seller?.address.state ?? "",
    },
    payments: {
      upiEnabled: settings.enabledPaymentMethods.includes("manual_upi"),
      vpa: settings.upiVpa ?? "",
      payeeName: "",
      bankEnabled: settings.enabledPaymentMethods.includes("manual_bank"),
      accountName: bank?.accountName ?? "",
      accountNumber: bank?.accountNumber ?? "",
      ifsc: bank?.ifsc ?? "",
      bankName: bank?.bankName ?? "",
      swift: undefined,
      instructions: "",
      affectedOfferings: [],
    },
    theme: {
      defaultTheme: settings.defaultTheme,
      lightEnabled: settings.flags.theme_light_editorial,
    },
    ai: {
      model: settings.aiModel,
      platformCap: settings.aiDailyPlatformCap,
      perUserCap: settings.aiDailyUserCap,
      timeoutS: Math.round(settings.chatTimeoutMs / 1000),
      maxTokens: 0,
      menuOnly: false,
      usedToday: 0,
    },
    notifications: {
      email: true,
      inApp: true,
      whatsapp: settings.flags.whatsapp_channel,
      digestEnabled: false,
      digestTime: "",
      sender: env.EMAIL_FROM,
    },
    flags: mapFlags(settings.flags),
    retention: {
      chatMonths: settings.retention.chatMonths,
      recordYears: settings.retention.recordsYears,
      nextPurgeAt: "",
      lastRunAt: "",
    },
  };
}

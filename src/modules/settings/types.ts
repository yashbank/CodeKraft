/**
 * Settings domain types — docs/05 §10 `site_settings` (key/value), docs/06 API-ADM-10,
 * API-AUTH-09/10, docs/13 §6 (feature flags), docs/04 §7.9.
 *
 * `SiteSettings` is the typed, camelCase view of the key/value rows; `SITE_SETTING_KEYS` maps each
 * field to its `site_settings.key`. The Zod schema lives in ./contracts.ts (`siteSettingsSchema`).
 */
import type { Currency } from "@/lib/money";
import type { FlagKey } from "@/lib/feature-flags";
import type { PaletteId } from "@/lib/palettes";
import type { ThemeName } from "@/lib/theme";
import type { PaymentMethodValue } from "../offerings/types";

export type { JsonValue, SiteSetting } from "../../../drizzle/schema/settings";

export interface PostalAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  /** ISO-3166-1 alpha-2 */
  country: string;
}

/** Invoice header details (BR-16, docs/05 T-invoices seller snapshot). */
export interface SellerDetails {
  name: string;
  address: PostalAddress;
  contactPhones: string[];
  email: string;
}

/** Manual bank transfer instructions (`PaymentInstructions.bank`, docs/06 §4.2). */
export interface BankDetails {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  branch?: string;
  /** Optional, for international wires. */
  swift?: string;
}

export interface RetentionSettings {
  /** Chat transcripts purge horizon (D-1503). */
  chatMonths: number;
  /** Orders/invoices/ledger/audit retention (BR-18). */
  recordsYears: number;
}

/**
 * Razorpay gateway config (docs/06 §4.3, V1.1, D-501). `keySecret`/`webhookSecret` are encrypted
 * at rest with `SETTINGS_ENCRYPTION_KEY` (a separate master key from `APP_ENCRYPTION_KEY`, see
 * `service.ts`) and masked to last-4 for any reader without `settings.write`. `keyId` is NOT
 * secret — Razorpay Checkout.js needs it client-side — so it is stored and returned plain.
 */
export interface RazorpaySettings {
  mode: "test" | "live";
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
}

/** Typed `site_settings` map (API-ADM-10 patch shape). */
export interface SiteSettings {
  siteName: string;
  baseCurrency: Currency;
  enabledCurrencies: Currency[];
  taxRateBps: number;
  gstin: string | null;
  sellerDetails: SellerDetails | null;
  upiVpa: string | null;
  /** Name shown to the payer in their UPI app (`pn=`); falls back to `siteName`. */
  upiPayeeName: string | null;
  /**
   * Admin-uploaded UPI QR code image as a `data:image/(png|jpeg|webp);base64,…` URL (R8-01).
   * Stored inline (not R2) so it works without bucket CORS and renders at checkout as-is.
   */
  upiQrImage: string | null;
  bankDetails: BankDetails | null;
  razorpaySettings: RazorpaySettings | null;
  enabledPaymentMethods: PaymentMethodValue[];
  defaultTheme: ThemeName;
  /** Show visitors the theme toggle. */
  themeToggle: boolean;
  palette: PaletteId;
  aiModel: string;
  aiDailyPlatformCap: number;
  aiDailyUserCap: number;
  chatTimeoutMs: number;
  retention: RetentionSettings;
  flags: Record<FlagKey, boolean>;
}

export type SiteSettingField = keyof SiteSettings;

/** `SiteSettings` field → `site_settings.key` (one row per key). */
export const SITE_SETTING_KEYS: Readonly<Record<SiteSettingField, string>> = Object.freeze({
  siteName: "site_name",
  baseCurrency: "base_currency",
  enabledCurrencies: "enabled_currencies",
  taxRateBps: "tax_rate_bps",
  gstin: "gstin",
  sellerDetails: "seller_details",
  upiVpa: "upi_vpa",
  upiPayeeName: "upi_payee_name",
  upiQrImage: "upi_qr_image",
  bankDetails: "bank_details",
  razorpaySettings: "razorpay_settings",
  enabledPaymentMethods: "enabled_payment_methods",
  defaultTheme: "default_theme",
  themeToggle: "theme_toggle",
  palette: "theme_palette",
  aiModel: "ai_model",
  aiDailyPlatformCap: "ai_daily_platform_cap",
  aiDailyUserCap: "ai_daily_user_cap",
  chatTimeoutMs: "chat_timeout_ms",
  retention: "retention",
  flags: "feature_flags",
});

/** Written by the seed and read by `scripts/seed.ts` to detect an already seeded database. */
export const SEEDED_AT_KEY = "seeded_at";

/** API-AUTH-09 `getPublicSettings` — the visitor-safe subset (cached `T: settings`). */
export interface PublicSettings {
  baseCurrency: Currency;
  enabledCurrencies: Currency[];
  defaultTheme: ThemeName;
  flags: { phoneOtp: boolean; themeLightEditorial: boolean; threeHero: boolean; bundles: boolean };
  turnstileSiteKey: string | null;
}

/** Cookie names for API-AUTH-04/10 (`ck_currency`, `ck_theme`; 1 year, not HttpOnly). */
export const CURRENCY_COOKIE = "ck_currency";
export const VISITOR_COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;

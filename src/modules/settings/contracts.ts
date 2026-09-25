/**
 * Settings contracts — docs/06 API-ADM-10 (`getSettings` / `updateSettings`), API-AUTH-09
 * (`getPublicSettings`), API-AUTH-10 (`setVisitorPreferences`), MASTER_SPEC §7 "Base currency
 * lock", "Visitor currency selector", "Theme toggle at launch", D-1602.
 */
import { z } from "zod";
import type { Context, RequestContext } from "@/lib/authz/context";
import type { DbOrTx } from "@/lib/db";
import { FLAG_KEYS } from "@/lib/feature-flags";
import { THEMES } from "@/lib/theme";
import { bpsSchema, currencySchema } from "@/modules/_shared/zod";
import { text } from "../catalog/contracts";
import { paymentMethodSchema } from "../offerings/contracts";
import type { PublicSettings, SiteSettings } from "./types";

export const themeNameSchema = z.enum(THEMES);
export const flagKeySchema = z.enum(FLAG_KEYS);

/** Indian GSTIN, 15 upper-case alphanumerics (docs/06 API-AUTH-03 / API-ADM-10). */
export const GSTIN_PATTERN = /^[0-9A-Z]{15}$/;
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(GSTIN_PATTERN, "GSTIN must be 15 alphanumerics");
/** UPI VPA `handle@psp`. */
export const UPI_VPA_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
export const upiVpaSchema = z.string().trim().regex(UPI_VPA_PATTERN, "invalid UPI id");
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ifscSchema = z.string().trim().toUpperCase().regex(IFSC_PATTERN, "invalid IFSC");
export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "ISO-3166-1 alpha-2");
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{6,20}$/, "invalid phone");

export const postalAddressSchema = z.strictObject({
  line1: text(120),
  line2: text(120).optional(),
  city: text(80),
  state: text(80).optional(),
  postalCode: text(16),
  country: countryCodeSchema,
});

export const sellerDetailsSchema = z.strictObject({
  name: text(120),
  address: postalAddressSchema,
  contactPhones: z.array(phoneSchema).max(5),
  email: z.email().max(254),
});

export const bankDetailsSchema = z.strictObject({
  accountName: text(120),
  accountNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{6,20}$/, "6–20 digits"),
  ifsc: ifscSchema,
  bankName: text(120),
  branch: text(120).optional(),
});

export const retentionSchema = z.strictObject({
  chatMonths: z.number().int().min(1).max(120),
  recordsYears: z.number().int().min(7).max(30),
});

/** Full typed map, used by the loader to validate the assembled rows. */
export const siteSettingsSchema = z.strictObject({
  baseCurrency: currencySchema,
  enabledCurrencies: z.array(currencySchema).min(1).max(5),
  taxRateBps: bpsSchema,
  gstin: gstinSchema.nullable(),
  sellerDetails: sellerDetailsSchema.nullable(),
  upiVpa: upiVpaSchema.nullable(),
  bankDetails: bankDetailsSchema.nullable(),
  enabledPaymentMethods: z.array(paymentMethodSchema).max(5),
  defaultTheme: themeNameSchema,
  aiModel: text(120),
  aiDailyPlatformCap: z.number().int().min(0).max(1_000_000),
  aiDailyUserCap: z.number().int().min(0).max(10_000),
  chatTimeoutMs: z.number().int().min(1_000).max(120_000),
  retention: retentionSchema,
  flags: z.record(flagKeySchema, z.boolean()),
}) satisfies z.ZodType<SiteSettings>;

/** Release-1 defaults (docs/13 §6, MASTER_SPEC §7). */
export const SITE_SETTINGS_DEFAULTS: SiteSettings = Object.freeze({
  baseCurrency: "INR",
  enabledCurrencies: ["INR", "USD", "EUR", "GBP", "CAD"],
  taxRateBps: 0,
  gstin: null,
  sellerDetails: null,
  upiVpa: null,
  bankDetails: null,
  enabledPaymentMethods: ["manual_upi", "manual_bank"],
  defaultTheme: "dark-cinematic",
  aiModel: "claude-opus-5",
  aiDailyPlatformCap: 2000,
  aiDailyUserCap: 30,
  chatTimeoutMs: 30_000,
  retention: { chatMonths: 12, recordsYears: 7 },
  flags: {
    phone_otp: false,
    whatsapp_channel: false,
    theme_light_editorial: false,
    provider_razorpay: false,
    provider_stripe: false,
    provider_paypal: false,
    automated_provisioning: false,
    three_hero: true,
    bundles: false,
    vendor_marketplace: false,
  },
}) as SiteSettings;

/**
 * API-ADM-10 `updateSettings` — partial patch; `flags` may itself be partial. `baseCurrency` is
 * rejected with `STATE_INVALID` once a `paid` order exists; `upiVpa` is required to enable
 * `manual_upi` (service-level).
 */
export const updateSettingsSchema = z.strictObject({
  patch: siteSettingsSchema
    .partial()
    .extend({ flags: z.partialRecord(flagKeySchema, z.boolean()).optional() })
    .refine((p) => Object.keys(p).length > 0, "patch must change at least one field")
    .refine(
      (p) =>
        p.enabledCurrencies === undefined ||
        p.baseCurrency === undefined ||
        p.enabledCurrencies.includes(p.baseCurrency),
      { message: "enabledCurrencies must include baseCurrency", path: ["enabledCurrencies"] },
    ),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/** API-AUTH-10 `setVisitorPreferences` (cookies only; `light-editorial` needs the flag). */
export const setVisitorPreferencesSchema = z
  .strictObject({
    displayCurrency: currencySchema.optional(),
    theme: themeNameSchema.optional(),
  })
  .refine((p) => p.displayCurrency !== undefined || p.theme !== undefined, "nothing to set");
export type SetVisitorPreferencesInput = z.infer<typeof setVisitorPreferencesSchema>;

export const SETTINGS_CACHE_TAGS = {
  updateSettings: ["settings", "content"],
} as const satisfies Record<string, readonly string[]>;

export interface SettingsService {
  /** API-ADM-10 (`settings.read`) — full typed map; secrets (bank account number) masked for non-`settings.write`. */
  getSettings(ctx: RequestContext, tx?: DbOrTx): Promise<{ settings: SiteSettings }>;
  /** API-ADM-10 (`settings.write`) — one `site_settings` row per changed key, audited with before/after. */
  updateSettings(
    ctx: RequestContext,
    input: UpdateSettingsInput,
    tx?: DbOrTx,
  ): Promise<{ settings: SiteSettings }>;
  /** API-AUTH-09 (visitor query, cached `T: settings`). */
  getPublicSettings(ctx: Context, tx?: DbOrTx): Promise<PublicSettings>;
  /** API-AUTH-10 — validates against the flag and returns the cookie values the action sets. */
  setVisitorPreferences(
    ctx: Context,
    input: SetVisitorPreferencesInput,
    tx?: DbOrTx,
  ): Promise<{ ok: true; cookies: { ck_currency?: string; ck_theme?: string } }>;
  /** Internal, uncached read of the settings map (checkout, invoices, fx). */
  load(tx?: DbOrTx): Promise<SiteSettings>;
  /** Internal `FlagLoader` implementation for `lib/feature-flags.setFlagLoader` (P3). */
  loadFlag(key: (typeof FLAG_KEYS)[number], tx?: DbOrTx): Promise<boolean | undefined>;
}

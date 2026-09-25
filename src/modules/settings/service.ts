/**
 * Settings service implementation (docs/06 API-ADM-10, API-AUTH-09/10, PHASE-03 P3.3).
 */
import { count, eq, sql } from "drizzle-orm";
import type { Context, RequestContext } from "@/lib/authz/context";
import { assertPermission } from "@/lib/authz/assert";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { decrypt, encrypt, isEncryptedToken } from "@/lib/crypto";
import {
  FLAG_KEYS,
  type FlagKey,
  clearFlagCache,
  getFlagFromEnv,
  setFlagLoader,
} from "@/lib/feature-flags";
import { orders } from "../../../drizzle/schema/commerce";
import { siteSettings } from "../../../drizzle/schema/settings";
import { auditService } from "../audit";
import {
  SITE_SETTINGS_DEFAULTS,
  type SetVisitorPreferencesInput,
  type SettingsService,
  type UpdateSettingsInput,
  setVisitorPreferencesSchema,
  siteSettingsSchema,
  updateSettingsSchema,
} from "./contracts";
import {
  type BankDetails,
  type PublicSettings,
  SITE_SETTING_KEYS,
  type SiteSettingField,
  type SiteSettings,
} from "./types";

import { createNotImplemented } from "@/modules/_shared/not-implemented";

export function createNotImplementedSettingsService(): SettingsService {
  return createNotImplemented<SettingsService>("settings", "P3", {
    getSettings: "async",
    updateSettings: "async",
    getPublicSettings: "async",
    setVisitorPreferences: "async",
    load: "async",
    loadFlag: "async",
  });
}

async function safeRevalidate(tag: string): Promise<void> {
  try {
    const { revalidateTag } = await import("next/cache");
    revalidateTag(tag);
  } catch {
    // In test environment or non-Next runtime, next/cache may throw or be absent
  }
}

function maskBankDetails(bank: BankDetails): BankDetails {
  const num = bank.accountNumber;
  const maskedNumber = num.length > 4 ? "*".repeat(num.length - 4) + num.slice(-4) : "****";
  return {
    ...bank,
    accountNumber: maskedNumber,
  };
}

export class DefaultSettingsService implements SettingsService {
  constructor(private readonly getCustomDb?: () => DbOrTx) {}

  private async getDatabase(tx?: TxCtx): Promise<DbOrTx> {
    if (tx) return tx;
    if (this.getCustomDb) return this.getCustomDb();
    const { db } = await import("@/lib/db");
    return db;
  }

  /**
   * Internal, uncached read of the settings map (checkout, invoices, fx).
   */
  async load(tx?: DbOrTx): Promise<SiteSettings> {
    const db = (tx as TxCtx) || (await this.getDatabase());
    const rows = await db.select().from(siteSettings);
    const rowMap = new Map<string, unknown>();
    for (const r of rows) {
      rowMap.set(r.key, r.value);
    }

    const assembled: Partial<SiteSettings> = { ...SITE_SETTINGS_DEFAULTS };

    for (const field of Object.keys(SITE_SETTING_KEYS) as SiteSettingField[]) {
      const dbKey = SITE_SETTING_KEYS[field];
      if (rowMap.has(dbKey)) {
        const val = rowMap.get(dbKey);
        if (field === "bankDetails") {
          if (val === null || val === undefined) {
            assembled.bankDetails = null;
          } else if (typeof val === "string" && isEncryptedToken(val)) {
            try {
              assembled.bankDetails = JSON.parse(decrypt(val)) as BankDetails;
            } catch {
              assembled.bankDetails = null;
            }
          } else if (typeof val === "object") {
            assembled.bankDetails = val as BankDetails;
          } else {
            assembled.bankDetails = null;
          }
        } else if (field === "flags") {
          assembled.flags = {
            ...SITE_SETTINGS_DEFAULTS.flags,
            ...(val && typeof val === "object" ? (val as Record<FlagKey, boolean>) : {}),
          };
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (assembled as any)[field] = val;
        }
      }
    }

    return siteSettingsSchema.parse(assembled);
  }

  /**
   * Internal `FlagLoader` implementation for `lib/feature-flags.setFlagLoader`.
   */
  async loadFlag(key: (typeof FLAG_KEYS)[number], tx?: DbOrTx): Promise<boolean | undefined> {
    const db = (tx as TxCtx) || (await this.getDatabase());
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, SITE_SETTING_KEYS.flags))
      .limit(1);

    if (
      row &&
      row.value &&
      typeof row.value === "object" &&
      key in (row.value as Record<string, unknown>)
    ) {
      return Boolean((row.value as Record<string, unknown>)[key]);
    }
    return undefined;
  }

  /**
   * API-ADM-10 (`settings.read`) — full typed map; secrets (bank account number) masked for non-`settings.write`.
   */
  async getSettings(ctx: RequestContext, tx?: DbOrTx): Promise<{ settings: SiteSettings }> {
    assertPermission(ctx, "settings.read");
    const settings = await this.load(tx);

    if (!ctx.permissions.has("settings.write") && settings.bankDetails) {
      return {
        settings: {
          ...settings,
          bankDetails: maskBankDetails(settings.bankDetails),
        },
      };
    }

    return { settings };
  }

  /**
   * API-ADM-10 (`settings.write`) — one `site_settings` row per changed key, audited with before/after.
   */
  async updateSettings(
    ctx: RequestContext,
    input: UpdateSettingsInput,
    tx?: DbOrTx,
  ): Promise<{ settings: SiteSettings }> {
    assertPermission(ctx, "settings.write");
    const validated = updateSettingsSchema.parse(input);

    const executeInTx = async (activeTx: TxCtx): Promise<{ settings: SiteSettings }> => {
      const before = await this.load(activeTx);

      // 1. Check base currency lock: cannot change once any paid order exists
      if (
        validated.patch.baseCurrency !== undefined &&
        validated.patch.baseCurrency !== before.baseCurrency
      ) {
        const [paidCount] = await activeTx
          .select({ count: count() })
          .from(orders)
          .where(eq(orders.status, "paid"));

        if (Number(paidCount?.count ?? 0) > 0) {
          throw new AppError(
            ErrorCode.STATE_INVALID,
            "Base currency cannot be changed once paid orders exist",
          );
        }
      }

      // Target merged payment methods & flags
      const targetMethods = validated.patch.enabledPaymentMethods ?? before.enabledPaymentMethods;
      const targetUpiVpa =
        validated.patch.upiVpa !== undefined ? validated.patch.upiVpa : before.upiVpa;
      const targetFlags: Record<FlagKey, boolean> = {
        ...before.flags,
        ...(validated.patch.flags ?? {}),
      };

      // 2. Check upiVpa required if manual_upi enabled or upiVpa being cleared
      const manualUpiInPatch = validated.patch.enabledPaymentMethods?.includes("manual_upi");
      const upiVpaCleared =
        validated.patch.upiVpa !== undefined &&
        (!validated.patch.upiVpa || validated.patch.upiVpa.trim().length === 0);

      if (
        (manualUpiInPatch || (upiVpaCleared && targetMethods.includes("manual_upi"))) &&
        (!targetUpiVpa || targetUpiVpa.trim().length === 0)
      ) {
        throw new AppError(
          ErrorCode.VALIDATION,
          "UPI VPA is required to enable manual UPI payment method",
          { fieldErrors: { upiVpa: ["UPI VPA is required to enable manual UPI"] } },
        );
      }

      // 3. Check flag-gated gateway payment methods
      const checkGateway = (method: "razorpay" | "stripe" | "paypal", flagKey: FlagKey) => {
        if (
          validated.patch.enabledPaymentMethods &&
          validated.patch.enabledPaymentMethods.includes(method)
        ) {
          const effectiveFlag = getFlagFromEnv(flagKey) ?? targetFlags[flagKey];
          if (!effectiveFlag) {
            throw new AppError(
              ErrorCode.VALIDATION,
              `Payment provider '${method}' is disabled by feature flag`,
              {
                fieldErrors: {
                  enabledPaymentMethods: [
                    `${method} requires ${flagKey} feature flag to be enabled`,
                  ],
                },
              },
            );
          }
        }
      };
      checkGateway("razorpay", "provider_razorpay");
      checkGateway("stripe", "provider_stripe");
      checkGateway("paypal", "provider_paypal");

      // Assemble after state & validate against schema
      const nextSettings: SiteSettings = {
        ...before,
        ...validated.patch,
        flags: targetFlags,
      };
      siteSettingsSchema.parse(nextSettings);

      // Write changed keys to site_settings
      const now = new Date();
      for (const key of Object.keys(validated.patch) as (keyof typeof validated.patch)[]) {
        if (key === "flags") {
          await activeTx
            .insert(siteSettings)
            .values({
              key: SITE_SETTING_KEYS.flags,
              value: sql`${JSON.stringify(targetFlags)}::jsonb`,
              updatedBy: ctx.userId,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: siteSettings.key,
              set: {
                value: sql`${JSON.stringify(targetFlags)}::jsonb`,
                updatedBy: ctx.userId,
                updatedAt: now,
              },
            });
        } else {
          const dbKey = SITE_SETTING_KEYS[key as SiteSettingField];
          const rawVal = validated.patch[key];
          let valToStore: unknown = rawVal;
          if (key === "bankDetails" && rawVal !== null && rawVal !== undefined) {
            valToStore = encrypt(JSON.stringify(rawVal));
          }

          await activeTx
            .insert(siteSettings)
            .values({
              key: dbKey,
              value: sql`${JSON.stringify(valToStore)}::jsonb`,
              updatedBy: ctx.userId,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: siteSettings.key,
              set: {
                value: sql`${JSON.stringify(valToStore)}::jsonb`,
                updatedBy: ctx.userId,
                updatedAt: now,
              },
            });
        }
      }

      // Audit log inside tx
      await auditService.log(
        ctx,
        "API-ADM-10 settings.update",
        { type: "settings", id: "site" },
        before,
        nextSettings,
        activeTx,
      );

      clearFlagCache();
      await safeRevalidate("settings");
      await safeRevalidate("content");

      return { settings: nextSettings };
    };

    if (tx) {
      return executeInTx(tx as TxCtx);
    }
    const { withTx } = await import("@/lib/db");
    return withTx(executeInTx);
  }

  /**
   * API-AUTH-09 (visitor query, cached `T: settings`).
   */
  async getPublicSettings(_ctx: Context, tx?: DbOrTx): Promise<PublicSettings> {
    const settings = await this.load(tx);

    const phoneOtp = getFlagFromEnv("phone_otp") ?? settings.flags.phone_otp;
    const themeLightEditorial =
      getFlagFromEnv("theme_light_editorial") ?? settings.flags.theme_light_editorial;
    const threeHero = getFlagFromEnv("three_hero") ?? settings.flags.three_hero;
    const bundles = getFlagFromEnv("bundles") ?? settings.flags.bundles;

    return {
      baseCurrency: settings.baseCurrency,
      enabledCurrencies: settings.enabledCurrencies,
      defaultTheme: settings.defaultTheme,
      flags: {
        phoneOtp,
        themeLightEditorial,
        threeHero,
        bundles,
      },
      turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null,
    };
  }

  /**
   * API-AUTH-10 — validates against the flag and returns the cookie values the action sets.
   */
  async setVisitorPreferences(
    _ctx: Context,
    input: SetVisitorPreferencesInput,
    tx?: DbOrTx,
  ): Promise<{ ok: true; cookies: { ck_currency?: string; ck_theme?: string } }> {
    const parsed = setVisitorPreferencesSchema.parse(input);

    if (parsed.theme === "light-editorial") {
      const flag =
        getFlagFromEnv("theme_light_editorial") ??
        (await this.loadFlag("theme_light_editorial", tx)) ??
        false;
      if (!flag) {
        throw new AppError(ErrorCode.FORBIDDEN, "Theme light-editorial is disabled");
      }
    }

    const cookies: { ck_currency?: string; ck_theme?: string } = {};
    if (parsed.displayCurrency) cookies.ck_currency = parsed.displayCurrency;
    if (parsed.theme) cookies.ck_theme = parsed.theme;

    return { ok: true, cookies };
  }
}

export const settingsService = new DefaultSettingsService();

// Wire the feature flag loader to load from DB
setFlagLoader((key) => settingsService.loadFlag(key));

/**
 * `settings` service (PHASE-03 P3.3; docs/06 API-ADM-10, API-AUTH-09, API-AUTH-10; MASTER_SPEC §7
 * "Base currency lock", "Visitor currency selector", "Theme toggle at launch"; D-502, D-1602).
 *
 * One `site_settings` row per key (`SITE_SETTING_KEYS`); the typed map is assembled on read with
 * release defaults for missing keys. `bank_details` is stored AES-GCM encrypted (`{ enc }`) via
 * `lib/crypto`. `updateSettings` audits the redacted diff in the same transaction.
 */
import { eq, inArray, sql } from "drizzle-orm";
import { assertPermission, can } from "@/lib/authz/assert";
import type { Context, RequestContext } from "@/lib/authz/context";
import { decrypt, encrypt } from "@/lib/crypto";
import { type DbOrTx, type TxCtx, getDb } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { FLAG_KEYS, type FlagKey, getFlagFromEnv } from "@/lib/feature-flags";
import { orders } from "../../../drizzle/schema/commerce";
import { type JsonValue, siteSettings } from "../../../drizzle/schema/settings";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { PaymentMethodValue } from "../offerings/types";
import type { AuditService } from "../audit/contracts";
import { diff } from "../audit/diff";
import { auditService } from "../audit/service";
import { runInTx } from "../audit/tx";
import {
  SITE_SETTINGS_DEFAULTS,
  type SetVisitorPreferencesInput,
  type SettingsService,
  type UpdateSettingsInput,
  siteSettingsSchema,
} from "./contracts";
import {
  CURRENCY_COOKIE,
  type PublicSettings,
  SITE_SETTING_KEYS,
  type SiteSettingField,
  type SiteSettings,
} from "./types";
import { THEME_COOKIE } from "@/lib/theme";

export interface SettingsDeps {
  db: () => DbOrTx;
  audit: AuditService;
  /** Any order that has ever been paid locks `baseCurrency` (MASTER_SPEC §7). */
  hasPaidOrder?: (tx: DbOrTx) => Promise<boolean>;
  encrypt?: (plain: string) => string;
  decrypt?: (token: string) => string;
  turnstileSiteKey?: () => string | null;
  now?: () => Date;
}

/** Order states that count as "paid" for the base-currency lock. */
export const PAID_ORDER_STATUSES = ["paid", "fulfilled", "refunded", "partially_refunded"] as const;

/** Gateway methods gated by their provider flag (docs/06 API-CAT-05, D-501). */
export const GATEWAY_METHOD_FLAGS: Readonly<Partial<Record<PaymentMethodValue, FlagKey>>> =
  Object.freeze({
    razorpay: "provider_razorpay",
    stripe: "provider_stripe",
    paypal: "provider_paypal",
  });

const FIELDS = Object.keys(SITE_SETTING_KEYS) as SiteSettingField[];
const KEY_TO_FIELD = new Map<string, SiteSettingField>(
  FIELDS.map((f) => [SITE_SETTING_KEYS[f], f] as const),
);

interface EncryptedEnvelope {
  enc: string;
}

function isEnvelope(value: unknown): value is EncryptedEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { enc?: unknown }).enc === "string"
  );
}

/** Env override wins over the DB value (docs/13 §6 precedence). */
export function effectiveFlag(settings: SiteSettings, key: FlagKey): boolean {
  return getFlagFromEnv(key) ?? settings.flags[key];
}

export function maskAccountNumber(accountNumber: string): string {
  const last4 = accountNumber.slice(-4);
  return `${"*".repeat(Math.max(0, accountNumber.length - 4))}${last4}`;
}

export function createSettingsService(deps: SettingsDeps): SettingsService {
  const enc = deps.encrypt ?? ((plain: string) => encrypt(plain));
  const dec = deps.decrypt ?? ((token: string) => decrypt(token));
  const hasPaidOrder =
    deps.hasPaidOrder ??
    (async (db: DbOrTx) => {
      const [row] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(inArray(orders.status, [...PAID_ORDER_STATUSES]))
        .limit(1);
      return row !== undefined;
    });
  const turnstile =
    deps.turnstileSiteKey ??
    (() => {
      const key = getEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      return key === undefined || key === "" ? null : key;
    });

  function parseField<F extends SiteSettingField>(field: F, raw: unknown): SiteSettings[F] {
    const schema = siteSettingsSchema.shape[field];
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data as SiteSettings[F];
    return SITE_SETTINGS_DEFAULTS[field];
  }

  async function load(tx?: DbOrTx): Promise<SiteSettings> {
    const db = tx ?? deps.db();
    const rows = await db
      .select({ key: siteSettings.key, value: siteSettings.value })
      .from(siteSettings)
      .where(inArray(siteSettings.key, Object.values(SITE_SETTING_KEYS)));
    const out: SiteSettings = structuredClone(SITE_SETTINGS_DEFAULTS);
    for (const row of rows) {
      const field = KEY_TO_FIELD.get(row.key);
      if (field === undefined) continue;
      let value: unknown = row.value;
      if (field === "bankDetails" && isEnvelope(value)) {
        try {
          value = JSON.parse(dec(value.enc)) as unknown;
        } catch {
          value = null;
        }
      }
      if (field === "flags") {
        const merged: Record<string, boolean> = { ...SITE_SETTINGS_DEFAULTS.flags };
        if (typeof value === "object" && value !== null) {
          for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if ((FLAG_KEYS as readonly string[]).includes(k) && typeof v === "boolean") merged[k] = v;
          }
        }
        value = merged;
      }
      (out as Record<SiteSettingField, unknown>)[field] = parseField(field, value);
    }
    return out;
  }

  async function loadFlag(key: FlagKey, tx?: DbOrTx): Promise<boolean | undefined> {
    const db = tx ?? deps.db();
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, SITE_SETTING_KEYS.flags))
      .limit(1);
    if (row === undefined || typeof row.value !== "object" || row.value === null) return undefined;
    const v = (row.value as Record<string, unknown>)[key];
    return typeof v === "boolean" ? v : undefined;
  }

  async function getSettings(
    ctx: RequestContext,
    tx?: DbOrTx,
  ): Promise<{ settings: SiteSettings }> {
    assertPermission(ctx, "settings.read");
    const settings = await load(tx);
    if (!can(ctx, "settings.write") && settings.bankDetails !== null) {
      settings.bankDetails = {
        ...settings.bankDetails,
        accountNumber: maskAccountNumber(settings.bankDetails.accountNumber),
      };
    }
    return { settings };
  }

  function validateMerged(patch: UpdateSettingsInput["patch"], merged: SiteSettings): void {
    const fieldErrors: Record<string, string[]> = {};
    if (!merged.enabledCurrencies.includes(merged.baseCurrency)) {
      fieldErrors["enabledCurrencies"] = ["enabledCurrencies must include baseCurrency"];
    }
    if (merged.enabledPaymentMethods.includes("manual_upi") && merged.upiVpa === null) {
      fieldErrors["upiVpa"] = ["upiVpa is required to enable manual_upi"];
    }
    if (merged.enabledPaymentMethods.includes("manual_bank") && merged.bankDetails === null) {
      fieldErrors["bankDetails"] = ["bankDetails are required to enable manual_bank"];
    }
    for (const method of merged.enabledPaymentMethods) {
      const flag = GATEWAY_METHOD_FLAGS[method];
      if (flag !== undefined && !effectiveFlag(merged, flag)) {
        (fieldErrors["enabledPaymentMethods"] ??= []).push(
          `${method} requires feature flag ${flag}`,
        );
      }
    }
    if (patch.defaultTheme === "light-editorial" && !effectiveFlag(merged, "theme_light_editorial")) {
      fieldErrors["defaultTheme"] = ["light-editorial requires flag theme_light_editorial"];
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError(ErrorCode.VALIDATION, undefined, { fieldErrors });
    }
  }

  function storedValue(field: SiteSettingField, value: unknown): JsonValue {
    if (field === "bankDetails" && value !== null) {
      return { enc: enc(JSON.stringify(value)) };
    }
    return value as JsonValue;
  }

  async function upsert(tx: TxCtx, field: SiteSettingField, value: unknown, userId: string) {
    const json = JSON.stringify(storedValue(field, value));
    await tx
      .insert(siteSettings)
      .values({
        key: SITE_SETTING_KEYS[field],
        value: sql`${json}::jsonb`,
        updatedBy: userId,
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: sql`${json}::jsonb`, updatedBy: userId, updatedAt: sql`now()` },
      });
  }

  async function updateSettings(
    ctx: RequestContext,
    input: UpdateSettingsInput,
    tx?: DbOrTx,
  ): Promise<{ settings: SiteSettings }> {
    assertPermission(ctx, "settings.write");
    return runInTx(tx ?? deps.db(), async (t) => {
      const before = await load(t);
      const patch = input.patch;
      const merged: SiteSettings = {
        ...before,
        ...(patch as Partial<SiteSettings>),
        flags: { ...before.flags, ...(patch.flags ?? {}) },
      };
      if (patch.baseCurrency !== undefined && patch.baseCurrency !== before.baseCurrency) {
        if (await hasPaidOrder(t)) {
          throw new AppError(
            ErrorCode.STATE_INVALID,
            "Base currency cannot change once a paid order exists.",
          );
        }
      }
      validateMerged(patch, merged);
      const changed = FIELDS.filter((f) => JSON.stringify(before[f]) !== JSON.stringify(merged[f]));
      for (const field of changed) await upsert(t, field, merged[field], ctx.userId);
      const d = diff(
        Object.fromEntries(changed.map((f) => [f, before[f]])),
        Object.fromEntries(changed.map((f) => [f, merged[f]])),
      );
      await deps.audit.log(
        ctx,
        "API-ADM-10 settings.update",
        { type: "site_settings", id: changed.length === 1 ? SITE_SETTING_KEYS[changed[0] as SiteSettingField] : "site_settings" },
        d.before,
        d.after,
        t,
      );
      return { settings: merged };
    });
  }

  async function getPublicSettings(_ctx: Context, tx?: DbOrTx): Promise<PublicSettings> {
    const s = await load(tx);
    return {
      baseCurrency: s.baseCurrency,
      enabledCurrencies: s.enabledCurrencies,
      defaultTheme: effectiveFlag(s, "theme_light_editorial") ? s.defaultTheme : "dark-cinematic",
      flags: {
        phoneOtp: effectiveFlag(s, "phone_otp"),
        themeLightEditorial: effectiveFlag(s, "theme_light_editorial"),
        threeHero: effectiveFlag(s, "three_hero"),
        bundles: effectiveFlag(s, "bundles"),
      },
      turnstileSiteKey: turnstile(),
    };
  }

  async function setVisitorPreferences(
    _ctx: Context,
    input: SetVisitorPreferencesInput,
    tx?: DbOrTx,
  ): Promise<{ ok: true; cookies: { ck_currency?: string; ck_theme?: string } }> {
    const s = await load(tx);
    const cookies: { ck_currency?: string; ck_theme?: string } = {};
    const fieldErrors: Record<string, string[]> = {};
    if (input.displayCurrency !== undefined) {
      if (!s.enabledCurrencies.includes(input.displayCurrency)) {
        fieldErrors["displayCurrency"] = ["currency is not enabled"];
      } else cookies[CURRENCY_COOKIE] = input.displayCurrency;
    }
    if (input.theme !== undefined) {
      if (input.theme === "light-editorial" && !effectiveFlag(s, "theme_light_editorial")) {
        fieldErrors["theme"] = ["light-editorial is not available"];
      } else cookies[THEME_COOKIE] = input.theme;
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError(ErrorCode.VALIDATION, undefined, { fieldErrors });
    }
    return { ok: true, cookies };
  }

  return { getSettings, updateSettings, getPublicSettings, setVisitorPreferences, load, loadFlag };
}

export const settingsService: SettingsService = createSettingsService({
  db: () => getDb(),
  audit: auditService,
});

/** P2.8 skeleton kept for modules that still fall back to a NotImplemented settings port. */
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

/**
 * Dependency plumbing shared by the commerce modules (orders, coupons, payments, invoices, quotes).
 *
 * Services are built with `create<X>Service(deps)` and exported as `<x>Service` singletons. The
 * commerce singletons reference each other (orders → payments → orders …) and the modules of other
 * phases (finance, entitlements, notifications, approvals, settings, fx, audit, media). Two helpers
 * keep that graph safe:
 *
 *  - `lazyService(() => x)` — a proxy that resolves the target on every property access, so
 *    circular singleton imports never observe an `undefined` binding at module-evaluation time.
 *  - `resolveSingleton(mod, "financeService", fallback)` — picks another module's singleton when it
 *    has landed and falls back to that module's `createNotImplemented…` skeleton otherwise, so this
 *    wave typechecks while sibling agents implement their modules concurrently.
 */
import { and, eq, sql } from "drizzle-orm";
import { type TxCtx } from "@/lib/db";
import { getRate as staticGetRate } from "@/lib/fx";
import type { AnalyticsService } from "@/modules/analytics/contracts";
import type { FxService } from "@/modules/fx/contracts";
import { SITE_SETTINGS_DEFAULTS, siteSettingsSchema } from "@/modules/settings/contracts";
import type { SettingsService } from "@/modules/settings/contracts";
import { SITE_SETTING_KEYS, type SiteSettings } from "@/modules/settings/types";
import { analyticsEvents } from "../../../drizzle/schema/ops";
import { productOwnershipLines, productOwnerships } from "../../../drizzle/schema/ownership";
import { siteSettings } from "../../../drizzle/schema/settings";

export function lazyService<T extends object>(get: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const real = get();
      const value = Reflect.get(real, prop, real) as unknown;
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
    },
    has(_target, prop) {
      return prop in get();
    },
  });
}

/** `mod[name]` when the sibling module exports its singleton, else `fallback()`. */
export function resolveSingleton<T>(mod: object, name: string, fallback: () => T): T {
  const candidate = (mod as Record<string, unknown>)[name];
  if (candidate !== undefined && candidate !== null) return candidate as T;
  return fallback();
}

/** Same, but only when the sibling module exposes the member at all (used for optional deps). */
export function optionalSingleton<T>(mod: object, name: string): T | undefined {
  const candidate = (mod as Record<string, unknown>)[name];
  return candidate === undefined || candidate === null ? undefined : (candidate as T);
}

// ---------------------------------------------------------------------------------------------
// Fallback readers used until the P3 modules land (settings.load, fx.getRate, analytics)
// ---------------------------------------------------------------------------------------------

/** Minimal `site_settings` reader: defaults overlaid with whatever rows exist, validated. */
export async function loadSiteSettingsFallback(tx: TxCtx): Promise<SiteSettings> {
  const rows = await tx.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
  const byKey = new Map(rows.map((r) => [r.key, r.value] as const));
  const merged: Record<string, unknown> = { ...SITE_SETTINGS_DEFAULTS };
  for (const [field, key] of Object.entries(SITE_SETTING_KEYS)) {
    if (byKey.has(key)) merged[field] = byKey.get(key);
  }
  if (typeof merged["flags"] === "object" && merged["flags"] !== null) {
    merged["flags"] = { ...SITE_SETTINGS_DEFAULTS.flags, ...(merged["flags"] as object) };
  }
  const parsed = siteSettingsSchema.safeParse(merged);
  return parsed.success ? (parsed.data as SiteSettings) : SITE_SETTINGS_DEFAULTS;
}

export const settingsFallback: Pick<SettingsService, "load"> = {
  load: (tx) => {
    if (tx === undefined) throw new Error("settings fallback needs a transaction handle");
    return loadSiteSettingsFallback(tx as TxCtx);
  },
};

/** `FxService.getRate` backed by the static table of `src/lib/fx.ts` (P3.12 replaces it). */
export const fxFallback: Pick<FxService, "getRate"> = {
  getRate: (input) =>
    staticGetRate(input.base, input.quote, input.asOf === undefined ? undefined : new Date(input.asOf)),
};

/** Direct `analytics_events` insert (docs/06 `A:` column) until the analytics service lands. */
export const analyticsFallback: Pick<AnalyticsService, "recordServerEvent"> = {
  async recordServerEvent(event, tx) {
    await tx.insert(analyticsEvents).values({
      name: event.name,
      userId: event.userId ?? null,
      anonId: event.anonId ?? null,
      productId: event.productId ?? null,
      orderId: event.orderId ?? null,
      props: event.props ?? null,
    });
  },
};

// ---------------------------------------------------------------------------------------------
// Shared reads
// ---------------------------------------------------------------------------------------------

/** The product's `active` ownership version id (P3.8 `ownership.getActiveOwnership` read-only twin). */
export async function activeOwnershipId(productId: string, tx: TxCtx): Promise<string | null> {
  const [row] = await tx
    .select({ id: productOwnerships.id })
    .from(productOwnerships)
    .where(and(eq(productOwnerships.productId, productId), eq(productOwnerships.status, "active")))
    .limit(1);
  return row?.id ?? null;
}

/** Product ids on which `partnerId` holds a line of the active ownership (D-512 admin scope). */
export function partnerProductsSubquery(partnerId: string) {
  return sql`(select po.product_id from ${productOwnerships} po
    join ${productOwnershipLines} pl on pl.ownership_id = po.id
    where po.status = 'active' and pl.partner_id = ${partnerId})`;
}

/**
 * Feature flags — docs/13 §6, docs/04 §7.9, MASTER_SPEC §4.11.
 *
 * Precedence: env `FEATURE_<KEY>` (`true`/`false`/`1`/`0`) > DB loader (`site_settings`, injected
 * by P3 via `setFlagLoader`) > release default. DB lookups are memoised for 60 s per key.
 */

export const FLAG_KEYS = [
  "phone_otp",
  "whatsapp_channel",
  "theme_light_editorial",
  "provider_razorpay",
  "provider_stripe",
  "provider_paypal",
  "automated_provisioning",
  "three_hero",
  "bundles",
  "vendor_marketplace",
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

/** Release 1 defaults (docs/13 §6): everything off except the `three_hero` kill switch. */
export const FLAG_DEFAULTS: Readonly<Record<FlagKey, boolean>> = Object.freeze({
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
});

export const FLAG_CACHE_TTL_MS = 60_000;

export type FlagLoader = (key: FlagKey) => Promise<boolean | undefined>;

export function isFlagKey(value: unknown): value is FlagKey {
  return typeof value === "string" && (FLAG_KEYS as readonly string[]).includes(value);
}

export function assertFlagKey(value: unknown): FlagKey {
  if (!isFlagKey(value)) throw new RangeError(`unknown feature flag: ${String(value)}`);
  return value;
}

export function flagEnvName(key: FlagKey): `FEATURE_${Uppercase<FlagKey>}` {
  return `FEATURE_${key.toUpperCase() as Uppercase<FlagKey>}`;
}

/** `"true"`/`"1"` → true, `"false"`/`"0"` → false, anything else (incl. unset) → undefined. */
export function parseFlagValue(raw: string | undefined): boolean | undefined {
  const v = raw?.trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return undefined;
}

/** Env override only (synchronous; used by layouts that cannot await, e.g. theme resolution). */
export function getFlagFromEnv(key: FlagKey): boolean | undefined {
  return parseFlagValue(process.env[flagEnvName(assertFlagKey(key))]);
}

interface CacheEntry {
  value: boolean | undefined;
  expiresAt: number;
}

let loader: FlagLoader | undefined;
let onLoaderError: (key: FlagKey, err: unknown) => void = () => undefined;
const cache = new Map<FlagKey, CacheEntry>();

/** P3 wires `site_settings`; pass `undefined` to detach. */
export function setFlagLoader(next: FlagLoader | undefined): void {
  loader = next;
  cache.clear();
}

/** Hook for the logger (kept injectable so this module has no logger dependency). */
export function setFlagLoaderErrorHandler(handler: (key: FlagKey, err: unknown) => void): void {
  onLoaderError = handler;
}

export function clearFlagCache(): void {
  cache.clear();
}

async function loadFromDb(key: FlagKey): Promise<boolean | undefined> {
  if (loader === undefined) return undefined;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit !== undefined && hit.expiresAt > now) return hit.value;
  try {
    const value = await loader(key);
    cache.set(key, { value, expiresAt: now + FLAG_CACHE_TTL_MS });
    return value;
  } catch (err) {
    onLoaderError(key, err);
    return undefined; // not cached: retry on the next call
  }
}

export async function getFlag(key: FlagKey): Promise<boolean> {
  assertFlagKey(key);
  const fromEnv = getFlagFromEnv(key);
  if (fromEnv !== undefined) return fromEnv;
  const fromDb = await loadFromDb(key);
  if (fromDb !== undefined) return fromDb;
  return FLAG_DEFAULTS[key];
}

export async function getAllFlags(): Promise<Record<FlagKey, boolean>> {
  const entries = await Promise.all(
    FLAG_KEYS.map(async (key) => [key, await getFlag(key)] as const),
  );
  return Object.fromEntries(entries) as Record<FlagKey, boolean>;
}

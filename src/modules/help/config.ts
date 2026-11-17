/**
 * Help assistant switches, read from three `site_settings` rows (no migration). Cached with the
 * `settings` tag so `revalidateSettingsCaches()` (run after COMMIT of a settings save) refreshes
 * it; ISR-safe. Any read error or malformed value falls back to the defaults
 * (enabled=true, hindi=false, ai=true) so a database hiccup never hides or breaks the help pop-up.
 */
import { eq, inArray } from "drizzle-orm";

import { rateLimitBuckets } from "../../../drizzle/schema/ops";
import { siteSettings } from "../../../drizzle/schema/settings";

export interface HelpConfig {
  enabled: boolean;
  hindi: boolean;
  ai: boolean;
}

export const HELP_CONFIG_DEFAULTS: Readonly<HelpConfig> = Object.freeze({
  enabled: true,
  hindi: false,
  ai: true,
});

export const HELP_SETTING_KEYS = {
  enabled: "help_enabled",
  hindi: "help_hindi_enabled",
  ai: "help_ai_enabled",
} as const;

/** Pure parser: only a real boolean overrides the default. */
export function parseHelpConfig(rows: ReadonlyArray<{ key: string; value: unknown }>): HelpConfig {
  const out: HelpConfig = { ...HELP_CONFIG_DEFAULTS };
  for (const field of Object.keys(HELP_SETTING_KEYS) as (keyof HelpConfig)[]) {
    const row = rows.find((r) => r.key === HELP_SETTING_KEYS[field]);
    if (row && typeof row.value === "boolean") out[field] = row.value;
  }
  return out;
}

async function readHelpConfig(): Promise<HelpConfig> {
  try {
    const { getDb } = await import("@/lib/db");
    const rows = await getDb()
      .select({ key: siteSettings.key, value: siteSettings.value })
      .from(siteSettings)
      .where(inArray(siteSettings.key, Object.values(HELP_SETTING_KEYS)));
    return parseHelpConfig(rows);
  } catch {
    return { ...HELP_CONFIG_DEFAULTS };
  }
}

/** Uncached read (jobs, tests that must see a just-committed change). */
export const getHelpConfigFresh = readHelpConfig;

export async function getHelpConfig(): Promise<HelpConfig> {
  try {
    const { unstable_cache } = await import("next/cache");
    return await unstable_cache(readHelpConfig, ["help-config"], {
      tags: ["settings"],
      revalidate: 60,
    })();
  } catch {
    return readHelpConfig();
  }
}

/** Monthly help token budget shown in Settings (env override; the answer backend enforces its own). */
export function helpMonthlyTokenBudget(): number {
  const n = Number(process.env.HELP_MONTHLY_TOKEN_BUDGET);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 500_000;
}

/** This month's help tokens used: `rate_limit_buckets` key `help:budget:YYYY-MM`; 0 when absent. */
export async function getHelpTokenUsage(now: Date = new Date()): Promise<{
  used: number;
  budget: number;
}> {
  const budget = helpMonthlyTokenBudget();
  try {
    const { getDb } = await import("@/lib/db");
    const month = now.toISOString().slice(0, 7);
    const rows = await getDb()
      .select({ count: rateLimitBuckets.count })
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.key, `help:budget:${month}`));
    return { used: Math.max(0, rows[0]?.count ?? 0), budget };
  } catch {
    return { used: 0, budget };
  }
}

/**
 * R8-11 — server-side read of the admin-editable site name (`site_settings.site_name`).
 *
 * Cached under the `settings` tag, which `settingsService.updateSettings` revalidates on every
 * save (and the admin wrapper also revalidates the whole layout tree), so a rename shows up on the
 * next request without a deploy. Falls back to the product default when the database is
 * unreachable (static build, unit tests) instead of failing the page.
 */
import { DEFAULT_SITE_NAME } from "./brand-constants";

export { DEFAULT_SITE_NAME };

/** Trimmed, non-empty site name or the default. Pure — unit-tested. */
export function normaliseSiteName(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_SITE_NAME;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_SITE_NAME;
}

async function readSiteName(): Promise<string> {
  try {
    const { settingsService } = await import("@/modules/settings/service");
    const settings = await settingsService.load();
    return normaliseSiteName(settings.siteName);
  } catch {
    return DEFAULT_SITE_NAME;
  }
}

export async function getSiteName(): Promise<string> {
  try {
    const { unstable_cache } = await import("next/cache");
    return await unstable_cache(readSiteName, ["site-brand:site-name"], {
      tags: ["settings"],
      revalidate: 300,
    })();
  } catch {
    // Outside a Next request (scripts, tests) `unstable_cache` is unavailable.
    return readSiteName();
  }
}

/**
 * Server-side site phase reader. One tiny `site_settings` row, cached with the `settings` tag so
 * `revalidateSettingsCaches()` (run after COMMIT of a settings save) refreshes it. A read error
 * means `live`: a database hiccup must never take the storefront down or hide it.
 */
import { eq } from "drizzle-orm";

import { parseSitePhase, type SitePhase } from "@/lib/site-phase";
import { siteSettings } from "../../drizzle/schema/settings";

async function readSitePhase(): Promise<SitePhase> {
  try {
    const { getDb } = await import("@/lib/db");
    const [row] = await getDb()
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, "site_phase"))
      .limit(1);
    return parseSitePhase(row?.value);
  } catch {
    return "live";
  }
}

export async function getSitePhase(): Promise<SitePhase> {
  try {
    const { unstable_cache } = await import("next/cache");
    return await unstable_cache(readSitePhase, ["site-phase"], {
      tags: ["settings"],
      revalidate: 60,
    })();
  } catch {
    return readSitePhase();
  }
}

/** Uncached read for jobs (email outbox) that must see a just-committed change. */
export const getSitePhaseFresh = readSitePhase;

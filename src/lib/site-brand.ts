/**
 * R8-11 — server-side read of the admin-editable site name (`site_settings.site_name`).
 *
 * Cached under the `settings` tag, which `settingsService.updateSettings` revalidates on every
 * save (and the admin wrapper also revalidates the whole layout tree), so a rename shows up on the
 * next request without a deploy. Falls back to the product default when the database is
 * unreachable (static build, unit tests) instead of failing the page.
 */
import { DEFAULT_SITE_NAME } from "./brand-constants";
import { DEFAULT_PALETTE, type PaletteId } from "./palettes";
import { DEFAULT_UI_STYLE, type UiStyle } from "./ui-style";
import { DEFAULT_THEME, type ThemeName } from "./theme";
import { DEFAULT_STUDIO_EXTRAS, type StudioExtras } from "./theme-studio";

export { DEFAULT_SITE_NAME };

/** Trimmed, non-empty site name or the default. Pure — unit-tested. */
export function normaliseSiteName(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_SITE_NAME;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_SITE_NAME;
}

export interface SiteContact {
  legalName: string | null;
  address: string | null;
  email: string | null;
  phones: string | null;
}

/** Pure: public contact block from the saved seller details; every field null when unset. */
export function contactFromSeller(
  s: {
    name: string;
    email: string;
    contactPhones: string[];
    address: { line1: string; line2?: string; city: string; state?: string; postalCode: string };
  } | null,
): SiteContact {
  if (!s) return { legalName: null, address: null, email: null, phones: null };
  const a = s.address;
  return {
    legalName: s.name || null,
    address: [a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean).join(", ") || null,
    email: s.email || null,
    phones: s.contactPhones.join(", ") || null,
  };
}

async function readSiteContact(): Promise<SiteContact> {
  try {
    const { settingsService } = await import("@/modules/settings/service");
    return contactFromSeller((await settingsService.load()).sellerDetails);
  } catch {
    return contactFromSeller(null);
  }
}

export async function getSiteContact(): Promise<SiteContact> {
  try {
    const { unstable_cache } = await import("next/cache");
    return await unstable_cache(readSiteContact, ["site-brand:contact"], {
      tags: ["settings"],
      revalidate: 300,
    })();
  } catch {
    return readSiteContact();
  }
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

export interface ThemeConfig {
  defaultTheme: ThemeName;
  themeToggle: boolean;
  palette: PaletteId;
  ui: UiStyle;
  studio: StudioExtras;
}
const THEME_FALLBACK: ThemeConfig = {
  defaultTheme: DEFAULT_THEME,
  themeToggle: true,
  palette: DEFAULT_PALETTE,
  ui: DEFAULT_UI_STYLE,
  studio: DEFAULT_STUDIO_EXTRAS,
};

async function readThemeConfig(): Promise<ThemeConfig> {
  try {
    const { settingsService } = await import("@/modules/settings/service");
    const s = await settingsService.load();
    return {
      defaultTheme: s.defaultTheme,
      themeToggle: s.themeToggle,
      palette: s.palette,
      ui: {
        font: s.uiFont,
        radius: s.uiRadius,
        border: s.uiBorder,
        pattern: s.uiPattern,
        layout: s.uiLayout,
        density: s.uiDensity,
      },
      studio: s.themeStudio,
    };
  } catch {
    return THEME_FALLBACK;
  }
}

/** Admin-chosen default theme, visitor-toggle switch and accent palette (same cache as the site name). */
export async function getThemeConfig(): Promise<ThemeConfig> {
  try {
    const { unstable_cache } = await import("next/cache");
    return await unstable_cache(readThemeConfig, ["site-brand:theme"], {
      tags: ["settings"],
      revalidate: 300,
    })();
  } catch {
    return readThemeConfig();
  }
}

async function readSiteLogo(): Promise<string | null> {
  try {
    const { settingsService } = await import("@/modules/settings/service");
    return (await settingsService.load()).siteLogo;
  } catch {
    return null;
  }
}

/** Admin-uploaded site logo URL, or null (callers then show a text wordmark of the site name). */
export async function getSiteLogo(): Promise<string | null> {
  try {
    const { unstable_cache } = await import("next/cache");
    return await unstable_cache(readSiteLogo, ["site-brand:site-logo"], {
      tags: ["settings"],
      revalidate: 300,
    })();
  } catch {
    return readSiteLogo();
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

/** Share-card images (openGraph/twitter): the uploaded site logo, or none. Merge into page metadata. */
export async function getSiteShareImages(): Promise<string[] | undefined> {
  const logo = await getSiteLogo();
  return logo ? [logo] : undefined;
}

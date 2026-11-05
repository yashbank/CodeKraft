/**
 * D17-06 - email theme: the super admin's palette, radius, font and logo as email-safe values
 * (hex only, web-safe fonts, PNG/JPEG logo). Works for outbox and direct sends alike: one settings
 * read on the global pool (never a caller's transaction), cached briefly so a batch does not query
 * per row, and any failure yields the safe defaults - a theme problem must never lose an email.
 */
import { DEFAULT_SITE_NAME } from "@/lib/brand-constants";
import { DEFAULT_PALETTE, PALETTES } from "@/lib/palettes";

export interface EmailTheme {
  siteName: string;
  /** Absolute-or-site-relative PNG/JPEG URL; null renders a text wordmark. */
  logoUrl: string | null;
  accent: string;
  accentFg: string;
  accentDark: string;
  accentDarkFg: string;
  /** Button/card corner radius in px. */
  radius: number;
  fontStack: string;
}

const SANS = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const SERIF_FONTS = new Set([
  "fraunces",
  "instrument",
  "playfair",
  "dmSerif",
  "newsreader",
  "sourceSerif",
]);
const RADIUS: Record<string, number> = {
  sharp: 2,
  crisp: 4,
  soft: 8,
  smooth: 10,
  round: 14,
  pill: 24,
};

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
/** Black or white, whichever reads better on `hex` (WCAG contrast). */
export function readableOn(hex: string): "#000000" | "#FFFFFF" {
  const n = parseInt(hex.slice(1), 16);
  const L =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? "#FFFFFF" : "#000000";
}

const HEX = /^#[0-9a-f]{6}$/i;
const pal = (id: string) =>
  PALETTES.find((p) => p.id === id) ?? PALETTES.find((p) => p.id === DEFAULT_PALETTE);

export function buildEmailTheme(s?: {
  siteName?: unknown;
  siteLogo?: unknown;
  palette?: unknown;
  uiRadius?: unknown;
  uiFont?: unknown;
}): EmailTheme {
  const p = pal(String(s?.palette ?? DEFAULT_PALETTE));
  const accent = p && HEX.test(p.light) ? p.light : "#3F35D6";
  const accentDark = p && HEX.test(p.dark) ? p.dark : "#9D8FFF";
  const name = typeof s?.siteName === "string" ? s.siteName.trim() : "";
  const logo = typeof s?.siteLogo === "string" ? s.siteLogo.trim() : "";
  return {
    siteName: name || DEFAULT_SITE_NAME,
    // SVG is blocked by Gmail and Outlook, so it falls back to the text wordmark.
    logoUrl: logo && !/\.svg([?#]|$)/i.test(logo) ? logo : null,
    accent,
    accentFg: readableOn(accent),
    accentDark,
    accentDarkFg: readableOn(accentDark),
    radius: RADIUS[String(s?.uiRadius)] ?? 8,
    fontStack: SERIF_FONTS.has(String(s?.uiFont)) ? SERIF : SANS,
  };
}

export const DEFAULT_EMAIL_THEME: EmailTheme = buildEmailTheme();

const OK_MS = 60_000;
const FAIL_MS = 10_000;
let cache: { at: number; ttl: number; value: Promise<EmailTheme> } | null = null;

export function resetEmailThemeCache() {
  cache = null;
}

async function read(): Promise<{ theme: EmailTheme; ok: boolean }> {
  try {
    const { settingsService } = await import("@/modules/settings/service");
    const s = await settingsService.load();
    return { theme: buildEmailTheme(s), ok: true };
  } catch {
    return { theme: DEFAULT_EMAIL_THEME, ok: false };
  }
}

export function loadEmailTheme(): Promise<EmailTheme> {
  const now = Date.now();
  if (cache && now - cache.at < cache.ttl) return cache.value;
  const entry = { at: now, ttl: OK_MS, value: undefined as unknown as Promise<EmailTheme> };
  entry.value = read().then((r) => {
    if (!r.ok) entry.ttl = FAIL_MS;
    return r.theme;
  });
  cache = entry;
  return entry.value;
}

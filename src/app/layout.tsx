import type { Metadata, Viewport } from "next";

import { SiteBrandProvider } from "@/components/brand/site-brand";
import { fontVariables } from "@/lib/fonts";
import { paletteCss } from "@/lib/palettes";
import { getSiteLogo, getSiteName, getThemeConfig } from "@/lib/site-brand";
import { DEFAULT_THEME, inlineThemeScript, THEME_COLOR } from "@/lib/theme";
import "./globals.css";

/** R8-11 — page titles follow the admin-editable site name (Settings → General). */
export async function generateMetadata(): Promise<Metadata> {
  const [siteName, logo] = await Promise.all([getSiteName(), getSiteLogo()]);
  return {
    title: { default: siteName, template: `%s · ${siteName}` },
    description: "Premium software studio and digital-product marketplace.",
    // Logo if set, else the existing default mark.
    icons: { icon: logo ?? "/brand/mark.svg" },
    applicationName: siteName,
    openGraph: { siteName },
  };
}

export const viewport: Viewport = { themeColor: THEME_COLOR[DEFAULT_THEME] };

const LIGHT_ENABLED = process.env.FEATURE_THEME_LIGHT_EDITORIAL === "true";

/**
 * Root layout stays static (no cookies()/headers()) so public routes can be ISR-cached (docs/08 §10).
 * The ≤300-byte inline script applies the visitor's cookie theme before first paint; dynamic
 * group layouts additionally read the session for `users.theme_pref` (P7).
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [siteName, siteLogo] = await Promise.all([getSiteName(), getSiteLogo()]);
  const { defaultTheme, palette } = await getThemeConfig();
  // An admin who picks light-editorial as the default has opted in, so it needs no env flag.
  const lightEnabled = LIGHT_ENABLED || defaultTheme === "light-editorial";
  return (
    <html
      lang="en"
      data-theme={defaultTheme}
      data-palette={palette}
      className={fontVariables}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: inlineThemeScript(lightEnabled) }} />
        <style dangerouslySetInnerHTML={{ __html: paletteCss(palette) }} />
      </head>
      <body className="min-h-screen bg-canvas text-fg antialiased">
        <SiteBrandProvider siteName={siteName} siteLogo={siteLogo}>
          {children}
        </SiteBrandProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";

import { fontVariables } from "@/lib/fonts";
import { DEFAULT_THEME, inlineThemeScript, THEME_COLOR } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CodeKraft", template: "%s · CodeKraft" },
  description: "Premium software studio and digital-product marketplace.",
};

export const viewport: Viewport = { themeColor: THEME_COLOR[DEFAULT_THEME] };

const LIGHT_ENABLED = process.env.FEATURE_THEME_LIGHT_EDITORIAL === "true";

/**
 * Root layout stays static (no cookies()/headers()) so public routes can be ISR-cached (docs/08 §10).
 * The ≤300-byte inline script applies the visitor's cookie theme before first paint; dynamic
 * group layouts additionally read the session for `users.theme_pref` (P7).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME} className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: inlineThemeScript(LIGHT_ENABLED) }} />
      </head>
      <body className="min-h-screen bg-canvas text-fg antialiased">{children}</body>
    </html>
  );
}

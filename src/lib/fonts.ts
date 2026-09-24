/**
 * Font loaders — docs/08 §5.3, docs/11 B3. Self-hosted through next/font/google (zero external
 * requests at runtime), `display: swap`, subsets latin + latin-ext.
 *
 * ≤ 2 text families per theme: Theme 1 = Space Grotesk (display) + Inter (body);
 * Theme 2 = Fraunces (display) + Inter. JetBrains Mono is shared for code. Every loader is
 * declared once here and exposed as a CSS variable that the `--ck-p-font-*` primitives in
 * src/styles/tokens.css consume; the browser fetches a face only when the active theme's
 * `--ck-font-display` resolves to it, so Fraunces costs nothing while Theme 1 is active.
 */
import { Fraunces, Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: "variable",
  display: "swap",
  variable: "--font-space-grotesk",
  adjustFontFallback: true,
});

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: "variable",
  display: "swap",
  variable: "--font-inter",
  // docs/11 B3: next/font preloads the display face only.
  preload: false,
  adjustFontFallback: true,
});

export const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
  variable: "--font-fraunces",
  // Theme 2 display face: fetched only when [data-theme="light-editorial"] is active.
  preload: false,
  adjustFontFallback: true,
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: "variable",
  display: "swap",
  variable: "--font-jetbrains-mono",
  preload: false,
  adjustFontFallback: true,
});

/** Class list for `<html>`: defines every `--font-*` variable for both themes. */
export const fontVariables = [
  spaceGrotesk.variable,
  inter.variable,
  fraunces.variable,
  jetbrainsMono.variable,
].join(" ");

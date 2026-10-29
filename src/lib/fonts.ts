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
import {
  Bricolage_Grotesque,
  DM_Sans,
  Fraunces,
  Geist,
  IBM_Plex_Sans,
  Instrument_Serif,
  Inter,
  Inter_Tight,
  JetBrains_Mono,
  Manrope,
  Space_Grotesk,
  Syne,
  Playfair_Display,
  DM_Serif_Display,
  Newsreader,
  Source_Serif_4,
  Poppins,
  Montserrat,
  Work_Sans,
  Outfit,
  Plus_Jakarta_Sans,
  Sora,
  Lexend,
  Rubik,
  Archivo,
  Figtree,
} from "next/font/google";

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

// P11-01 admin-selectable pairings (src/lib/ui-style.ts). Latin only, never preloaded: the
// @font-face is declared but the browser fetches a face only when the chosen pairing uses it.
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-inter-tight",
  preload: false,
  adjustFontFallback: true,
});
const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-ibm-plex",
  preload: false,
  adjustFontFallback: true,
});
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-instrument-serif",
  preload: false,
  adjustFontFallback: true,
});
const geist = Geist({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-geist",
  preload: false,
  adjustFontFallback: true,
});
const syne = Syne({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-syne",
  preload: false,
  adjustFontFallback: true,
});
const manrope = Manrope({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-manrope",
  preload: false,
  adjustFontFallback: true,
});
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-bricolage",
  preload: false,
  adjustFontFallback: true,
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-dm-sans",
  preload: false,
  adjustFontFallback: true,
});

// R9-08 extra pairings. Same rule: declared, never preloaded, fetched only when used or previewed.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-playfair",
  preload: false,
  adjustFontFallback: true,
});
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-dm-serif",
  preload: false,
  adjustFontFallback: true,
});
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-newsreader",
  preload: false,
  adjustFontFallback: true,
});
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-source-serif",
  preload: false,
  adjustFontFallback: true,
});
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
  preload: false,
  adjustFontFallback: true,
});
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-montserrat",
  preload: false,
  adjustFontFallback: true,
});
const workSans = Work_Sans({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-work-sans",
  preload: false,
  adjustFontFallback: true,
});
const outfit = Outfit({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-outfit",
  preload: false,
  adjustFontFallback: true,
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-jakarta",
  preload: false,
  adjustFontFallback: true,
});
const sora = Sora({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-sora",
  preload: false,
  adjustFontFallback: true,
});
const lexend = Lexend({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-lexend",
  preload: false,
  adjustFontFallback: true,
});
const rubik = Rubik({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-rubik",
  preload: false,
  adjustFontFallback: true,
});
const archivo = Archivo({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-archivo",
  preload: false,
  adjustFontFallback: true,
});
const figtree = Figtree({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-figtree",
  preload: false,
  adjustFontFallback: true,
});

/** Class list for `<html>`: defines every `--font-*` variable for both themes. */
export const fontVariables = [
  spaceGrotesk.variable,
  inter.variable,
  fraunces.variable,
  jetbrainsMono.variable,
  interTight.variable,
  ibmPlex.variable,
  instrumentSerif.variable,
  geist.variable,
  syne.variable,
  manrope.variable,
  bricolage.variable,
  dmSans.variable,
  playfair.variable,
  dmSerif.variable,
  newsreader.variable,
  sourceSerif.variable,
  poppins.variable,
  montserrat.variable,
  workSans.variable,
  outfit.variable,
  jakarta.variable,
  sora.variable,
  lexend.variable,
  rubik.variable,
  archivo.variable,
  figtree.variable,
].join(" ");

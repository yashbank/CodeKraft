import type { MetadataRoute } from "next";

import { DEFAULT_ICON } from "./brand-constants";
import { THEME_COLOR, type ThemeName } from "./theme";

/**
 * Web app manifest (P14-12b): name + icon follow Settings -> General, colours follow the default
 * theme. The static mark is declared at 192 and 512 (browsers rasterise the SVG); an uploaded logo
 * is added as a scalable icon. No service worker: install-to-home-screen only, nothing is cached offline.
 */
export function buildManifest(i: {
  siteName: string;
  logo?: string | null;
  theme: ThemeName;
}): MetadataRoute.Manifest {
  const color = THEME_COLOR[i.theme];
  const icons: MetadataRoute.Manifest["icons"] = [
    { src: DEFAULT_ICON, sizes: "192x192", type: "image/svg+xml", purpose: "any" },
    { src: DEFAULT_ICON, sizes: "512x512", type: "image/svg+xml", purpose: "any" },
  ];
  if (i.logo) icons.unshift({ src: i.logo, sizes: "any", purpose: "any" });
  return {
    name: i.siteName,
    short_name: i.siteName.length > 12 ? i.siteName.slice(0, 12).trimEnd() : i.siteName,
    description: "Premium software studio and digital-product marketplace.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: color,
    theme_color: color,
    icons,
  };
}

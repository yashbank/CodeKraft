import type { MetadataRoute } from "next";

import { buildManifest } from "@/lib/pwa";
import { getSiteLogo, getSiteName, getThemeConfig } from "@/lib/site-brand";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [siteName, logo, { defaultTheme }] = await Promise.all([
    getSiteName(),
    getSiteLogo(),
    getThemeConfig(),
  ]);
  return buildManifest({ siteName, logo, theme: defaultTheme });
}

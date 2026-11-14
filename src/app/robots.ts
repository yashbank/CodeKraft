import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/seo";
import { headers } from "next/headers";
import { getSitePhase } from "@/lib/site-phase-server";

/** BUG-073: the admin host is never indexable; customer rules unchanged. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const adminHost = process.env.ADMIN_HOST ?? "";
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  if (adminHost !== "" && host === adminHost) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  // Testing / maintenance: do not invite crawlers (no sitemap either).
  if ((await getSitePhase()) !== "live") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  const baseUrl = siteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/account/", "/api/", "/checkout/", "/auth/", "/dev/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

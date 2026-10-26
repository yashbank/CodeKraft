import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/** BUG-073: the admin host is never indexable; customer rules unchanged. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const adminHost = process.env.ADMIN_HOST ?? "";
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  if (adminHost !== "" && host === adminHost) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://codekraft.in";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/account/", "/api/", "/dev/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

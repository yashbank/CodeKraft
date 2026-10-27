import type { MetadataRoute } from "next";

import { anonymousContext } from "@/lib/authz/context";
import { listBlogPostsQuery } from "@/modules/blog/queries";
import { listProductsQuery } from "@/modules/catalog/queries";
import { listCaseStudiesQuery } from "@/modules/content/queries";
import { LEGAL_NAV } from "@/app/dev/screens/_fixtures/site";

// Only URLs that resolve: DB-backed published products / case studies / blog posts, plus static
// routes that exist under src/app/(site). Legal pages are served from LEGAL_DOCS keyed by LEGAL_NAV.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://codekraft.in";
  const now = new Date();
  const ctx = anonymousContext();
  const [productsResult, caseStudiesResult, blogResult] = await Promise.all([
    listProductsQuery({ limit: 100, displayCurrency: "INR" }, ctx),
    listCaseStudiesQuery({ limit: 100 }, ctx),
    listBlogPostsQuery({ limit: 100 }, ctx),
  ]);
  const products = productsResult.ok ? productsResult.data : [];
  const caseStudies = caseStudiesResult.ok ? caseStudiesResult.data.items : [];
  const blogPosts = blogResult.ok ? blogResult.data.items : [];

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/services`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/projects`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/products/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  const caseStudyRoutes: MetadataRoute.Sitemap = caseStudies.map((c) => ({
    url: `${baseUrl}/projects/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((b) => ({
    url: `${baseUrl}/blog/${b.slug}`,
    lastModified: new Date(b.publishedAt),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const legalRoutes: MetadataRoute.Sitemap = LEGAL_NAV.map((l) => ({
    url: `${baseUrl}/legal/${l.key}`,
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...productRoutes, ...caseStudyRoutes, ...blogRoutes, ...legalRoutes];
}

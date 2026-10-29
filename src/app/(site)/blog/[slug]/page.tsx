import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSiteShareImages } from "@/lib/site-brand";

import { BlogPostPage } from "@/components/site/BlogPostPage";
import { toBlogPost, toBlogTeaser } from "@/lib/blog-view";
import { anonymousContext } from "@/lib/authz/context";
import { toProductSummary } from "@/lib/product-summary";
import { getBlogBySlugQuery, listBlogPostsQuery } from "@/modules/blog/queries";
import { listServicesQuery } from "@/modules/content/queries";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ISR (API-CAT-33: 60 s); unknown slugs are rendered on demand.
export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getBlogBySlugQuery({ slug, displayCurrency: "INR" }, anonymousContext());
  if (!result.ok) return {};
  const { blog } = result.data;
  const title = blog.seoTitle ?? blog.title;
  const description = blog.seoDescription ?? blog.excerpt ?? undefined;

  return {
    title: `${title} — Blog`,
    description,
    openGraph: { title, description, images: await getSiteShareImages() },
  };
}

export default async function BlogPostRoute({ params }: PageProps) {
  const { slug } = await params;
  const ctx = anonymousContext();
  const [result, listResult, servicesResult] = await Promise.all([
    getBlogBySlugQuery({ slug, displayCurrency: "INR" }, ctx),
    listBlogPostsQuery({ limit: 100 }, ctx),
    listServicesQuery({}, ctx),
  ]);
  if (!result.ok) notFound();

  const { blog, product, html } = result.data;
  const teasers = listResult.ok ? listResult.data.items.map(toBlogTeaser) : [];
  const own = teasers.find((t) => t.slug === blog.slug);
  const post = toBlogPost(
    own ??
      toBlogTeaser({
        slug: blog.slug,
        title: blog.title,
        excerpt: blog.excerpt,
        cover: blog.cover,
        publishedAt: blog.publishedAt,
        product: { slug: product.slug, name: product.name },
        author: blog.author,
      }),
    html,
  );

  // List is newest-first: the next index is the older post.
  const index = teasers.findIndex((t) => t.slug === blog.slug);
  const newer = index > 0 ? teasers[index - 1] : undefined;
  const older = index >= 0 ? teasers[index + 1] : undefined;
  const prev = newer ? { title: newer.title, href: `/blog/${newer.slug}` } : undefined;
  const next = older ? { title: older.title, href: `/blog/${older.slug}` } : undefined;

  const serviceOptions = servicesResult.ok
    ? servicesResult.data.map((s) => ({ slug: s.slug, title: s.title }))
    : [];

  return (
    <BlogPostPage
      post={post}
      product={toProductSummary(product)}
      serviceOptions={serviceOptions}
      prev={prev}
      next={next}
    />
  );
}

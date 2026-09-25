/** Blog read models (API-CAT-33/34) and JSON-LD `Article` (D-804, docs/11). */
import { renderRichText } from "@/lib/rich-text/render";
import type { ProductBlog } from "../../../drizzle/schema/catalog";
import type { Media } from "../../../drizzle/schema/media";
import type { ProductCard } from "../catalog/types";
import { type MediaUrlResolver, defaultMediaUrl, imageRef, siteHost, siteUrl } from "../content/internal";
import { ORGANIZATION_NAME, breadcrumbListJsonLd } from "../content/views";
import type { BlogCard, BlogDetail, BlogTeaser } from "./types";

export interface BlogRowJoin {
  blog: ProductBlog;
  product: { slug: string; name: string };
  author: { name: string };
  cover: Media | null;
}

export function blogCard(row: BlogRowJoin, resolve: MediaUrlResolver = defaultMediaUrl): BlogCard {
  return {
    slug: row.blog.slug,
    title: row.blog.title,
    excerpt: row.blog.excerpt,
    cover: imageRef(row.cover, row.blog.title, resolve),
    publishedAt: (row.blog.publishedAt ?? row.blog.updatedAt).toISOString(),
    product: { slug: row.product.slug, name: row.product.name },
    author: { name: row.author.name },
  };
}

export function blogTeaser(card: BlogCard): BlogTeaser {
  return {
    slug: card.slug,
    title: card.title,
    excerpt: card.excerpt,
    cover: card.cover,
    publishedAt: card.publishedAt,
  };
}

export function blogDetail(
  row: BlogRowJoin,
  product: ProductCard,
  resolve: MediaUrlResolver = defaultMediaUrl,
): BlogDetail {
  const card = blogCard(row, resolve);
  const rendered = renderRichText(row.blog.bodyJson, { siteHost: siteHost() });
  const url = `${siteUrl()}/blog/${row.blog.slug}`;
  const description = row.blog.seoDescription ?? row.blog.excerpt ?? rendered.text.slice(0, 155);
  return {
    blog: {
      slug: card.slug,
      title: card.title,
      excerpt: card.excerpt,
      cover: card.cover,
      publishedAt: card.publishedAt,
      seoTitle: row.blog.seoTitle,
      seoDescription: row.blog.seoDescription,
      author: card.author,
    },
    product,
    html: rendered.html,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          headline: row.blog.seoTitle ?? row.blog.title,
          description,
          url,
          mainEntityOfPage: url,
          datePublished: card.publishedAt,
          dateModified: row.blog.updatedAt.toISOString(),
          ...(card.cover !== null ? { image: card.cover.url } : {}),
          author: { "@type": "Person", name: row.author.name },
          publisher: { "@type": "Organization", name: ORGANIZATION_NAME, url: siteUrl() },
          wordCount: rendered.wordCount,
          about: { "@type": "Product", name: product.name, url: `${siteUrl()}/products/${product.slug}` },
        },
        breadcrumbListJsonLd([
          { name: "Home", href: "/" },
          { name: "Blog", href: "/blog" },
          { name: row.blog.title, href: `/blog/${row.blog.slug}` },
        ]),
      ],
    },
  };
}

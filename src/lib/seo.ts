/** P12-03 — SEO helpers: absolute URLs, metadata factory and JSON-LD builders. Pure, no I/O. */
import type { Metadata } from "next";

export const NOINDEX = { index: false, follow: false } as const;

/** Public origin without trailing slash (NEXT_PUBLIC_SITE_URL, then APP_URL, then default). */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://codekraft.in";
  return raw.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Collapse whitespace and cut at `max` chars on a word boundary, with an ellipsis. */
export function truncate(text: string | null | undefined, max = 155): string | undefined {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2))}…`;
}

export interface PageMetaInput {
  path: string;
  title: string;
  description?: string | null;
  /** Explicit share images; omit to let the opengraph-image file convention supply one. */
  images?: string[];
  type?: "website" | "article";
  noindex?: boolean;
}

/** Title gets the root "%s · site name" template; canonical + OG + Twitter share one source. */
export function pageMetadata(i: PageMetaInput): Metadata {
  const description = truncate(i.description);
  const url = absoluteUrl(i.path);
  const images = i.images;
  return {
    title: i.title,
    description,
    alternates: { canonical: url },
    robots: i.noindex ? NOINDEX : undefined,
    openGraph: { type: i.type ?? "website", url, title: i.title, description, images },
    twitter: { card: "summary_large_image", title: i.title, description, images },
  };
}

/** JSON for an inline <script>: `<` is escaped so `</script` and `<!--` can never close/open anything. */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
}

const CTX = "https://schema.org";
const orgId = () => `${siteUrl()}/#organization`;

export function organizationLd(siteName: string, logo?: string | null) {
  return {
    "@context": CTX,
    "@type": "Organization",
    "@id": orgId(),
    name: siteName,
    url: `${siteUrl()}/`,
    ...(logo ? { logo: absoluteUrl(logo) } : {}),
  };
}

/** WebSite with a SearchAction (/search?q= hands off to the product list). */
export function websiteLd(siteName: string) {
  return {
    "@context": CTX,
    "@type": "WebSite",
    "@id": `${siteUrl()}/#website`,
    url: `${siteUrl()}/`,
    name: siteName,
    publisher: { "@id": orgId() },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl()}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function productLd(p: {
  slug: string;
  name: string;
  description?: string | null;
  image?: string | null;
  price?: { amountMinor: number; currency: string };
  inStock?: boolean;
}) {
  const url = absoluteUrl(`/products/${p.slug}`);
  return {
    "@context": CTX,
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.name,
    url,
    description: truncate(p.description, 300),
    ...(p.image ? { image: [absoluteUrl(p.image)] } : {}),
    ...(p.price
      ? {
          offers: {
            "@type": "Offer",
            url,
            price: (p.price.amountMinor / 100).toFixed(2),
            priceCurrency: p.price.currency,
            availability: `${CTX}/${p.inStock === false ? "OutOfStock" : "InStock"}`,
          },
        }
      : {}),
  };
}

export function articleLd(a: {
  type: "BlogPosting" | "Article";
  path: string;
  title: string;
  description?: string | null;
  image?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  author?: string | null;
}) {
  const url = absoluteUrl(a.path);
  return {
    "@context": CTX,
    "@type": a.type,
    "@id": `${url}#article`,
    headline: a.title,
    description: truncate(a.description),
    mainEntityOfPage: url,
    ...(a.image ? { image: [absoluteUrl(a.image)] } : {}),
    ...(a.datePublished ? { datePublished: a.datePublished } : {}),
    ...(a.dateModified || a.datePublished
      ? { dateModified: a.dateModified ?? a.datePublished }
      : {}),
    author: a.author ? { "@type": "Person", name: a.author } : { "@id": orgId() },
    publisher: { "@id": orgId() },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": CTX,
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function faqLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": CTX,
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

// R9-12 — per-type SEO inputs. Public pages AND the admin SEO preview call these, so they can't drift.
type Opt = string | null | undefined;
const pick = (...v: Opt[]) => v.find((x) => x?.trim()) ?? undefined;

export function productSeo(p: {
  slug: string;
  name: string;
  shortDescription?: Opt;
  seoTitle?: Opt;
  seoDescription?: Opt;
}): PageMetaInput {
  return {
    path: `/products/${p.slug}`,
    title: pick(p.seoTitle, p.name) ?? "",
    description: pick(p.seoDescription, p.shortDescription),
  };
}

export function blogSeo(b: {
  slug: string;
  title: string;
  excerpt?: Opt;
  seoTitle?: Opt;
  seoDescription?: Opt;
}): PageMetaInput {
  return {
    path: `/blog/${b.slug}`,
    title: pick(b.seoTitle, b.title) ?? "",
    description: pick(b.seoDescription, b.excerpt),
    type: "article",
  };
}

export function caseStudySeo(c: {
  slug: string;
  title: string;
  resultHighlight?: Opt;
  seoTitle?: Opt;
  seoDescription?: Opt;
}): PageMetaInput {
  return {
    path: `/projects/${c.slug}`,
    title: pick(c.seoTitle, c.title) ?? "",
    description: pick(c.seoDescription, c.resultHighlight),
    type: "article",
  };
}

/** Google-style snippet + share card fields read back from the built Metadata. */
export function seoSnippet(m: Metadata, siteName: string) {
  const full = `${typeof m.title === "string" ? m.title : ""} · ${siteName}`;
  const description = typeof m.description === "string" ? m.description : "";
  const url = String(m.alternates?.canonical ?? "");
  const warnings: string[] = [];
  if (full.length > 60) warnings.push("Title is over 60 characters; Google will cut it off.");
  if (!description) warnings.push("No description; Google will pick text from the page.");
  else if (description.endsWith("…"))
    warnings.push("Description is over 160 characters; Google will cut it off.");
  return {
    title: full.length > 60 ? `${full.slice(0, 59)}…` : full,
    url,
    description,
    image: `${url}/opengraph-image`,
    warnings,
  };
}

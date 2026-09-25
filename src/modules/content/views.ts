/**
 * Public read models (API-CONT-09) and JSON-LD builders for the content module. Pure mappers over
 * rows + a media map; the services load the rows.
 */
import { inArray } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { renderHtml } from "@/lib/rich-text/render";
import { toPlainText } from "@/lib/rich-text/plain-text";
import { media, type Media } from "../../../drizzle/schema/media";
import type {
  CaseStudy,
  ClientLogo,
  Faq,
  LandingChapter,
  LegalPage,
  Service,
  Testimonial,
} from "../../../drizzle/schema/content";
import type { ImageRef } from "../catalog/types";
import { type MediaUrlResolver, defaultMediaUrl, imageRef, iso, siteHost, siteUrl } from "./internal";
import type {
  CaseStudyCard,
  CaseStudyDetail,
  ClientLogoView,
  FaqView,
  LandingChapterView,
  LegalPageView,
  ServiceView,
  TestimonialView,
} from "./types";

export const ORGANIZATION_NAME = "CodeKraft";

export type MediaMap = ReadonlyMap<string, Media>;

/** Batch-load media rows by id (empty ids → empty map). */
export async function loadMediaMap(
  db: DbOrTx,
  ids: readonly (string | null | undefined)[],
): Promise<Map<string, Media>> {
  const wanted = Array.from(new Set(ids.filter((id): id is string => typeof id === "string")));
  const out = new Map<string, Media>();
  if (wanted.length === 0) return out;
  const rows = await db.select().from(media).where(inArray(media.id, wanted));
  for (const row of rows) out.set(row.id, row);
  return out;
}

export interface ViewContext {
  media: MediaMap;
  mediaUrl?: MediaUrlResolver;
}

function ref(ctx: ViewContext, mediaId: string | null | undefined, alt: string): ImageRef | null {
  if (mediaId === null || mediaId === undefined) return null;
  return imageRef(ctx.media.get(mediaId), alt, ctx.mediaUrl ?? defaultMediaUrl);
}

const html = (doc: Parameters<typeof renderHtml>[0]) => renderHtml(doc, { siteHost: siteHost() });

export function landingChapterView(row: LandingChapter, ctx: ViewContext): LandingChapterView {
  return {
    key: row.key,
    title: row.title,
    subtitle: row.subtitle,
    html: html(row.bodyJson),
    media: {
      poster: ref(ctx, row.media?.posterMediaId, row.title),
      videoEmbedUrl: row.media?.videoEmbedUrl ?? null,
      sceneVariant: row.media?.sceneVariant ?? null,
    },
    cta: row.cta ?? null,
    position: row.position,
  };
}

export function serviceView(row: Service): ServiceView {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    deliverables: row.deliverables ?? [],
    html: html(row.bodyJson),
    icon: row.icon,
    position: row.position,
  };
}

export function caseStudyCard(row: CaseStudy, ctx: ViewContext): CaseStudyCard {
  return {
    slug: row.slug,
    title: row.title,
    clientName: row.clientName,
    industry: row.industry,
    techStack: row.techStack,
    cover: ref(ctx, row.coverMediaId, row.title),
    publishedAt: iso(row.publishedAt),
  };
}

export function caseStudyDetail(row: CaseStudy, ctx: ViewContext): CaseStudyDetail {
  const card = caseStudyCard(row, ctx);
  const gallery: CaseStudyDetail["gallery"] = [];
  for (const item of row.gallery ?? []) {
    const image = ref(ctx, item.mediaId, item.alt);
    if (image !== null) gallery.push({ ...image, caption: item.caption ?? null });
  }
  const description =
    row.seoDescription ?? toPlainText(row.problemJson).replace(/\s+/g, " ").slice(0, 155);
  const url = `${siteUrl()}/projects/${row.slug}`;
  return {
    ...card,
    problemHtml: html(row.problemJson),
    solutionHtml: html(row.solutionJson),
    resultsHtml: html(row.resultsJson),
    gallery,
    seo: { title: row.seoTitle ?? row.title, description },
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          headline: row.title,
          description,
          url,
          mainEntityOfPage: url,
          ...(card.publishedAt !== null ? { datePublished: card.publishedAt } : {}),
          dateModified: row.updatedAt.toISOString(),
          ...(card.cover !== null ? { image: card.cover.url } : {}),
          author: { "@type": "Organization", name: ORGANIZATION_NAME },
          publisher: { "@type": "Organization", name: ORGANIZATION_NAME, url: siteUrl() },
          ...(row.techStack.length > 0 ? { keywords: row.techStack.join(", ") } : {}),
        },
        breadcrumbListJsonLd([
          { name: "Home", href: "/" },
          { name: "Case studies", href: "/projects" },
          { name: row.title, href: `/projects/${row.slug}` },
        ]),
      ],
    },
  };
}

export function testimonialView(
  row: Testimonial,
  ctx: ViewContext,
  productSlug: string | null,
): TestimonialView {
  return {
    id: row.id,
    quote: row.quote,
    authorName: row.authorName,
    authorTitle: row.authorTitle,
    company: row.company,
    avatar: ref(ctx, row.avatarMediaId, row.authorName),
    context: row.context,
    productSlug,
  };
}

/** `null` when the logo's media object is missing or private (nothing to render). */
export function clientLogoView(row: ClientLogo, ctx: ViewContext): ClientLogoView | null {
  const logo = ref(ctx, row.mediaId, row.name);
  if (logo === null) return null;
  return { id: row.id, name: row.name, logo, url: row.url };
}

export function faqView(row: Faq, productSlug: string | null): FaqView {
  return {
    id: row.id,
    question: row.question,
    answer: row.answerJson,
    html: html(row.answerJson),
    scope: row.scope,
    productSlug,
  };
}

export function legalPageView(
  page: Pick<LegalPage, "key" | "title">,
  version: { version: number; bodyJson: LegalPage["bodyJson"]; publishedAt: Date | null },
): LegalPageView {
  return {
    key: page.key,
    title: page.title,
    html: html(version.bodyJson),
    version: version.version,
    publishedAt: iso(version.publishedAt),
  };
}

/* --- JSON-LD -------------------------------------------------------------------------------- */

export function organizationJsonLd(input: { sameAs?: string[]; logoUrl?: string | null } = {}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl()}/#organization`,
        name: ORGANIZATION_NAME,
        url: siteUrl(),
        ...(input.logoUrl !== undefined && input.logoUrl !== null ? { logo: input.logoUrl } : {}),
        ...(input.sameAs !== undefined && input.sameAs.length > 0 ? { sameAs: input.sameAs } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl()}/#website`,
        url: siteUrl(),
        name: ORGANIZATION_NAME,
        publisher: { "@id": `${siteUrl()}/#organization` },
      },
    ],
  };
}

export function breadcrumbListJsonLd(items: readonly { name: string; href: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteUrl()}${item.href}`,
    })),
  };
}

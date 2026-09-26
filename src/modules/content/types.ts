/**
 * Content (CMS-lite) domain types — docs/05 §10, docs/06 §2.10 API-CONT-01..09, docs/04 §7.7.
 */
import type {
  faqScope,
  landingChapterKey,
  legalPageKey,
  testimonialContext,
  CtaLink,
  GalleryItem,
  LandingChapterCta,
  LandingChapterMedia,
} from "../../../drizzle/schema/content";
import type { TiptapDoc } from "../../../drizzle/schema/catalog";
import type { ImageRef } from "../catalog/types";
import { enumTuple } from "../catalog/types";

export type {
  CaseStudy,
  ClientLogo,
  Faq,
  LandingChapter,
  LegalPage,
  LegalPageVersion,
  Service,
  Testimonial,
} from "../../../drizzle/schema/content";
export type { CtaLink, GalleryItem, LandingChapterCta, LandingChapterMedia };

export type LandingChapterKey = (typeof landingChapterKey.enumValues)[number];
export const LANDING_CHAPTER_KEYS = enumTuple<LandingChapterKey>()([
  "who",
  "build",
  "sell",
  "proof",
  "talk",
] as const);

export type TestimonialContext = (typeof testimonialContext.enumValues)[number];
export const TESTIMONIAL_CONTEXTS = enumTuple<TestimonialContext>()(["site", "product"] as const);

export type FaqScope = (typeof faqScope.enumValues)[number];
export const FAQ_SCOPES = enumTuple<FaqScope>()(["site", "chatbot", "product"] as const);

export type LegalPageKey = (typeof legalPageKey.enumValues)[number];
export const LEGAL_PAGE_KEYS = enumTuple<LegalPageKey>()([
  "privacy",
  "terms",
  "refunds",
  "license",
] as const);

/** Max products on the landing "featured" strip (API-CONT-02). */
export const FEATURED_PRODUCTS_MAX = 8;

/* --- Public read models (API-CONT-09) ------------------------------------------------------- */

export interface LandingChapterView {
  key: LandingChapterKey;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  html: string;
  media: { poster: ImageRef | null; videoEmbedUrl: string | null; sceneVariant: string | null };
  cta: LandingChapterCta | null;
  position: number;
}

export interface ServiceView {
  slug: string;
  title: string;
  summary: string | null;
  deliverables: string[];
  html: string;
  icon: string | null;
  position: number;
}

export interface CaseStudyCard {
  slug: string;
  title: string;
  clientName: string | null;
  industry: string | null;
  techStack: string[];
  cover: ImageRef | null;
  publishedAt: string | null;
  resultHighlight: string | null;
}

export interface CaseStudyDetail extends CaseStudyCard {
  problemHtml: string;
  solutionHtml: string;
  resultsHtml: string;
  gallery: (ImageRef & { caption: string | null })[];
  seo: { title: string; description: string };
  jsonLd: Record<string, unknown>;
}

export interface TestimonialView {
  id: string;
  quote: string;
  authorName: string;
  authorTitle: string | null;
  company: string | null;
  avatar: ImageRef | null;
  context: TestimonialContext;
  productSlug: string | null;
}

export interface ClientLogoView {
  id: string;
  name: string;
  logo: ImageRef;
  url: string | null;
}

export interface FaqView {
  id: string;
  question: string;
  answer: TiptapDoc;
  html: string;
  scope: FaqScope;
  productSlug: string | null;
}

export interface LegalPageView {
  key: LegalPageKey;
  title: string;
  html: string;
  version: number;
  publishedAt: string | null;
}

/** `getLandingContent` aggregate (API-CONT-09). */
export interface LandingContent {
  chapters: LandingChapterView[];
  services: ServiceView[];
  testimonials: TestimonialView[];
  logos: ClientLogoView[];
  faqs: FaqView[];
  jsonLd: Record<string, unknown>;
}

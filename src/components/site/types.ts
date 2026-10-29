/**
 * Public-site view models — the prop shapes every `components/site/*` component renders.
 * P7 maps database rows / query results (docs/05, docs/06 API-CAT-*, API-CONT-09) onto these;
 * the dev previews feed them from `app/dev/screens/_fixtures/site.ts`. No component here fetches.
 */
import type { Money } from "@/lib/money";

export type PurchaseModel = "one_time" | "subscription" | "custom_quote";
export type BillingInterval = "monthly" | "quarterly" | "annual";
export type DeliveryType = "saas" | "hosted" | "download" | "license" | "service" | "custom";
export type UpdatePolicy = "all_free" | "during_access" | "major_paid";

export interface CategoryRef {
  slug: string;
  name: string;
  /** Parent category (two-level tree, D-303). */
  parent?: CategoryRef;
}

export interface OfferingView {
  id: string;
  name: string;
  purchaseModel: PurchaseModel;
  billingInterval?: BillingInterval;
  deliveryType: DeliveryType;
  /** Absent for `custom_quote`. */
  price?: Money;
  /** `price` is converted from the base price (render "≈"). */
  priceApprox?: boolean;
  compareAtPrice?: Money;
  licenseType?: string;
  /** "Lifetime" / "12 months" (D-605). */
  accessPeriod: string;
  trialDays?: number;
  updatePolicy: UpdatePolicy;
  isRefundable: boolean;
  /** Bullet list shown when the offering is selected. */
  features: string[];
}

/** What a product card needs (list page, landing, blog rail). */
export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  category: CategoryRef;
  /** Lowest active offering price; absent means "Custom quote" (or coming soon). */
  fromPrice?: Money;
  /** `fromPrice` is converted from the base price (render "≈"). */
  priceApprox?: boolean;
  compareAtPrice?: Money;
  purchaseModels: PurchaseModel[];
  deliveryTypes: DeliveryType[];
  isFeatured: boolean;
  isComingSoon: boolean;
  isNewVersion?: boolean;
  tags: string[];
  techStack: string[];
  industries: string[];
  audiences: string[];
  /** Alt text for the cover (placeholder frame until media lands). */
  coverAlt: string;
  /** Deterministic placeholder hue index for the cover frame (0–5). */
  coverTone: number;
  /** Real cover image URL, when the product has one; falls back to the placeholder frame. */
  coverImageUrl?: string;
  /** ISO date. */
  publishedAt: string;
  /** Relative popularity used by the "Most popular" sort. */
  popularity: number;
}

export type MediaKind =
  | "image"
  | "screenshot"
  | "gallery"
  | "video_embed"
  | "video_file"
  | "presentation"
  | "attachment"
  | "og";

export interface MediaItem {
  id: string;
  kind: MediaKind;
  alt: string;
  caption?: string;
  url?: string;
  mime?: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface ChangelogEntry {
  version: string;
  /** ISO date. */
  date: string;
  notesHtml: string;
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
}

export interface ClientLogo {
  id: string;
  name: string;
  /** Uploaded logo image (Admin → Content → Testimonials & logos); omitted = name as text. */
  logoUrl?: string;
  /** Optional link to the client's site. */
  href?: string;
}

export interface BlogTeaser {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date. */
  publishedAt: string;
  readingMinutes: number;
  coverAlt: string;
  coverTone: number;
  /** Uploaded cover (Admin → Content → Blog → Cover image); omitted = gradient placeholder. */
  coverUrl?: string;
  product: { slug: string; name: string; category: CategoryRef };
}

export interface BlogPost extends BlogTeaser {
  bodyHtml: string;
}

export interface ProductDetail extends ProductSummary {
  seo?: { title?: string | null; description?: string | null };
  version: string;
  descriptionHtml: string;
  benefits: string[];
  targetAudience: string[];
  useCases: string[];
  requirements: string[];
  features: string[];
  offerings: OfferingView[];
  media: MediaItem[];
  faqs: FaqItem[];
  changelog: ChangelogEntry[];
  testimonials: Testimonial[];
  hasPresentation: boolean;
  /** product_media.media_id of the presentation PDF (served by /api/files/product-media). */
  presentationMediaId?: string;
  liveDemoUrl?: string;
  blog?: BlogTeaser;
}

export type { ServiceIconName } from "./service-icons";
import type { ServiceIconName } from "./service-icons";

export interface Service {
  slug: string;
  title: string;
  summary: string;
  icon: ServiceIconName;
  deliverables: string[];
  bodyHtml?: string;
}

export interface CaseStudyMetric {
  label: string;
  value: string;
}

export interface CaseStudySummary {
  slug: string;
  title: string;
  /** Blank → "Confidential client". */
  client?: string;
  industry: string;
  techStack: string[];
  resultHighlight: string;
  /** ISO date. */
  publishedAt: string;
  coverAlt: string;
  coverTone: number;
  /** Uploaded cover (Admin → Content → Case studies → Cover image); omitted = placeholder. */
  coverUrl?: string;
}

export interface CaseStudy extends CaseStudySummary {
  problemHtml: string;
  solutionHtml: string;
  resultsHtml: string;
  metrics: CaseStudyMetric[];
  timeline?: string;
  gallery: MediaItem[];
}

export type LegalKey = "privacy" | "terms" | "refunds" | "license";

export interface LegalSection {
  id: string;
  title: string;
  bodyHtml: string;
}

export interface LegalPageView {
  key: LegalKey;
  title: string;
  version: number;
  /** ISO date. */
  updatedAt: string;
  sections: LegalSection[];
}

export interface LandingChapterCopy {
  eyebrow: string;
  title: string;
  body: string;
  /** Admin-stored CTA (Landing editor); the hero renders it, falling back to its defaults. */
  cta?: { primary: { label: string; href: string }; secondary?: { label: string; href: string } };
}

export interface LandingContent {
  who: LandingChapterCopy & {
    subtitle: string;
    /** Admin-uploaded hero poster (Landing editor, "Who we are" chapter). Falls back to the
     * built-in architecture render when none is set. */
    poster: { url: string; alt: string } | null;
    /** Hero panel label: undefined = default text, "" = hidden. */
    nodeLabel?: string;
    nodeStyle?: "pill" | "terminal" | "outline";
  };
  build: LandingChapterCopy;
  sell: LandingChapterCopy;
  proof: LandingChapterCopy & { stats: { label: string; value: string }[] };
  talk: LandingChapterCopy;
}

/** Option shown in the inquiry form's "What do you need?" select. */
export interface ServiceOption {
  slug: string;
  title: string;
}

export interface InquiryValues {
  name: string;
  email: string;
  phone: string;
  company: string;
  serviceInterest: string;
  budget: string;
  message: string;
}

export interface InquiryResult {
  ok: boolean;
  /** Short reference shown on success ("Inquiry #CK-L-3F9A"). */
  reference?: string;
  error?: string;
}

/** Links shared by the header, drawer and footer. */
export interface SiteNavItem {
  href: string;
  label: string;
}

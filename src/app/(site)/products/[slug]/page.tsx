import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SERVICE_OPTIONS } from "@/app/dev/screens/_fixtures/site";
import { ProductDetailPage } from "@/components/site/product/ProductDetailPage";
import type {
  ChangelogEntry,
  FaqItem,
  MediaItem,
  OfferingView,
  ProductDetail,
  Testimonial,
} from "@/components/site/types";
import { anonymousContext } from "@/lib/authz/context";
import { toneFromSlug } from "@/lib/media-tone";
import { getProductBySlugQuery } from "@/modules/catalog/queries";
import { renderToHtml, toPlainText } from "@/modules/content/render";
import type { RichTextDoc } from "@/modules/_shared/zod";
import type { ChangelogJson } from "../../../../../drizzle/schema/catalog";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function accessPeriod(purchaseModel: string, billingInterval: string | null): string {
  if (purchaseModel === "one_time") return "Lifetime";
  if (billingInterval === "monthly") return "Monthly";
  if (billingInterval === "quarterly") return "Quarterly";
  if (billingInterval === "annual") return "Annual";
  return "Custom";
}

function changelogHtml(c: ChangelogJson | null): string {
  if (!c) return "";
  const sections: string[] = [];
  if (c.summary) sections.push(`<p>${c.summary}</p>`);
  const group = (label: string, items?: string[]) =>
    items && items.length
      ? `<p><strong>${label}:</strong></p><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`
      : "";
  sections.push(group("Added", c.added));
  sections.push(group("Changed", c.changed));
  sections.push(group("Fixed", c.fixed));
  sections.push(group("Breaking", c.breaking));
  return sections.filter(Boolean).join("");
}

async function loadProduct(slug: string): Promise<ProductDetail | null> {
  const ctx = anonymousContext();
  const result = await getProductBySlugQuery({ slug, displayCurrency: "INR" }, ctx);
  if (!result.ok) return null;
  const p = result.data;

  const offerings: OfferingView[] = p.offerings.map((o) => ({
    id: o.id,
    name: o.name,
    purchaseModel: o.purchaseModel,
    billingInterval: o.billingInterval ?? undefined,
    deliveryType: o.deliveryType,
    price: o.price?.display,
    compareAtPrice: o.price?.compareAt ?? undefined,
    licenseType: o.licenseType ?? undefined,
    accessPeriod: accessPeriod(o.purchaseModel, o.billingInterval),
    trialDays: o.trialDays ?? undefined,
    updatePolicy: "during_access",
    isRefundable: p.isRefundable,
    features: [],
  }));

  const purchaseModels = Array.from(new Set(offerings.map((o) => o.purchaseModel)));
  const deliveryTypes = Array.from(new Set(offerings.map((o) => o.deliveryType)));
  const cheapest = offerings
    .map((o) => o.price)
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .sort((a, b) => a.amountMinor - b.amountMinor)[0];

  const media: MediaItem[] = p.media.map((m) => ({
    id: m.id,
    kind: m.kind as MediaItem["kind"],
    alt: m.alt,
    caption: m.title ?? undefined,
  }));

  const faqs: FaqItem[] = p.faqs.map((f) => ({
    id: f.id,
    question: f.question,
    answer: toPlainText(f.answer as unknown as RichTextDoc),
  }));

  const changelog: ChangelogEntry[] = p.versions.map((v) => ({
    version: v.version,
    date: v.releasedAt,
    notesHtml: changelogHtml(v.changelog),
  }));

  const testimonials: Testimonial[] = p.testimonials.map((t) => ({
    id: t.id,
    quote: t.quote,
    author: t.authorName,
    role: t.authorTitle ?? "",
    company: t.company ?? "",
  }));

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    category: p.category
      ? { slug: p.category.slug, name: p.category.name }
      : { slug: "uncategorized", name: "Uncategorized" },
    fromPrice: cheapest,
    purchaseModels: purchaseModels.length ? purchaseModels : ["custom_quote"],
    deliveryTypes: deliveryTypes.length ? deliveryTypes : ["custom"],
    isFeatured: p.isFeatured,
    isComingSoon: p.isComingSoon,
    tags: p.tags.map((t) => t.name),
    techStack: p.techStack,
    industries: p.industry,
    audiences: p.targetAudience.map((a) => a.title),
    coverAlt: p.name,
    coverTone: toneFromSlug(p.slug),
    publishedAt: new Date().toISOString(),
    popularity: 0,
    version: p.currentVersion ?? "1.0.0",
    descriptionHtml: renderToHtml(p.description as unknown as RichTextDoc),
    benefits: p.benefits.map((b) => b.title),
    targetAudience: p.targetAudience.map((a) => a.title),
    useCases: p.useCases.map((u) => u.title),
    requirements: p.requirements
      ? [toPlainText(p.requirements as unknown as RichTextDoc)].filter(Boolean)
      : [],
    features: p.features.map((f) => f.title),
    offerings,
    media,
    faqs,
    changelog,
    testimonials,
    hasPresentation: p.media.some((m) => m.kind === "presentation"),
    liveDemoUrl: p.liveDemoUrl ?? undefined,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return {};

  return {
    title: `${product.name} — Software by CodeKraft`,
    description: product.shortDescription,
    openGraph: { title: product.name, description: product.shortDescription },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  return <ProductDetailPage product={product} serviceOptions={SERVICE_OPTIONS} />;
}

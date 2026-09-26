import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  PRODUCTS,
  PRODUCT_DETAIL,
  SERVICE_OPTIONS,
} from "@/app/dev/screens/_fixtures/site";
import { ProductDetailPage } from "@/components/site/product/ProductDetailPage";
import type { ProductDetail } from "@/components/site/types";
import { money } from "@/lib/money";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

function getProductDetail(slug: string): ProductDetail | undefined {
  if (PRODUCT_DETAIL.slug === slug) {
    return PRODUCT_DETAIL;
  }
  const summary = PRODUCTS.find((p) => p.slug === slug);
  if (!summary) return undefined;

  return {
    ...summary,
    version: "1.0.0",
    descriptionHtml: `<p>${summary.shortDescription}</p><p>Built with enterprise-grade stability, seamless deployment, and continuous updates backed by our team.</p>`,
    benefits: [
      "Rapid deployment with zero boilerplate configuration",
      "Full source code and ownership options available",
      "Comprehensive documentation and architectural runbooks",
      "Dedicated integration support during onboarding",
    ],
    targetAudience: ["Startups", "Scale-ups", "Internal tool teams"],
    useCases: ["Digital operations automation", "Customer workflow management", "Production ready MVP"],
    requirements: ["Modern web browser", "Node.js 20+ or Docker runtime"],
    features: [
      "Postgres relational persistence with ACID compliance",
      "Role-based access control and audited actions",
      "Automated schema migrations and data protection",
      "Integrated structured logging and telemetry",
      "Automated backup strategies and disaster recovery",
    ],
    techStack: ["Next.js", "TypeScript", "Tailwind CSS", "PostgreSQL"],
    media: [
      {
        id: "m-1",
        kind: "image",
        alt: summary.name,
        caption: summary.name,
      },
    ],
    faqs: [
      {
        id: "faq-1",
        question: "Can I self-host this software?",
        answer: "Yes, our self-hosted license includes Docker containers and deployment scripts.",
      },
    ],
    changelog: [
      {
        version: "1.0.0",
        date: "2026-09-01",
        notesHtml: "<p>Initial production release.</p>",
      },
    ],
    testimonials: [],
    hasPresentation: false,
    offerings: [
      {
        id: `offering-${summary.slug}-cloud`,
        name: "Cloud Hosted",
        purchaseModel: "subscription",
        deliveryType: "saas",
        billingInterval: "monthly",
        price: money(499900, "INR"),
        accessPeriod: "Monthly",
        trialDays: 14,
        updatePolicy: "during_access",
        isRefundable: true,
        features: ["Managed hosting", "Automated backups", "Security updates"],
      },
      {
        id: `offering-${summary.slug}-self`,
        name: "Self-Hosted License",
        purchaseModel: "one_time",
        deliveryType: "license",
        price: money(2499900, "INR"),
        accessPeriod: "Lifetime",
        updatePolicy: "all_free",
        isRefundable: false,
        features: ["Full binary access", "Perpetual license", "Standard updates"],
      },
    ],
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductDetail(slug);
  if (!product) return {};

  return {
    title: `${product.name} — Software by CodeKraft`,
    description: product.shortDescription,
    openGraph: {
      title: product.name,
      description: product.shortDescription,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = getProductDetail(slug);

  if (!product) {
    notFound();
  }

  return (
    <ProductDetailPage
      product={product}
      serviceOptions={SERVICE_OPTIONS}
    />
  );
}

import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

import { LEGAL_NAV, LEGAL_PRIVACY } from "@/app/dev/screens/_fixtures/site";
import { contentService } from "@/modules/content/service";
import { LegalPage } from "@/components/site/LegalPage";
import type { LegalKey, LegalPageView } from "@/components/site/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const LEGAL_DOCS: Record<LegalKey, LegalPageView> = {
  privacy: LEGAL_PRIVACY,
  terms: {
    key: "terms",
    title: "Terms of service",
    version: 2,
    updatedAt: "2026-09-24",
    sections: [
      {
        id: "acceptance",
        title: "1. Acceptance of terms",
        bodyHtml:
          "<p>By accessing CodeKraft services, software products, or purchasing customized engineering, you agree to be bound by these Terms of Service.</p>",
      },
      {
        id: "commercial-agreements",
        title: "2. Commercial terms & proposals",
        bodyHtml:
          "<p>All bespoke consulting and development work is executed under agreed scope documents with milestone deliveries and fixed timelines.</p>",
      },
      {
        id: "ip-ownership",
        title: "3. Intellectual property",
        bodyHtml:
          "<p>Upon full settlement of invoices, clients retain full ownership of bespoke artifacts, source code, and delivered documentation.</p>",
      },
      {
        id: "liability",
        title: "4. Limitation of liability",
        bodyHtml:
          "<p>In no event shall CodeKraft be liable for indirect, incidental, or consequential damages resulting from downtime or service integrations.</p>",
      },
    ],
  },
  refunds: {
    key: "refunds",
    title: "Refund & cancellation policy",
    version: 1,
    updatedAt: "2026-09-24",
    sections: [
      {
        id: "policy-scope",
        title: "1. Overview & eligibility",
        bodyHtml:
          "<p>We strive for complete satisfaction with our products and solutions. Because software licenses provide immediate digital access, refund terms are subject to verified operational failure or mutual agreement during onboarding.</p>",
      },
      {
        id: "refund-query-thread",
        title: "2. Requesting a refund",
        bodyHtml:
          "<p>To request a refund for an active order, customers can open a refund query thread directly from their customer dashboard under Orders & Purchases.</p>",
      },
      {
        id: "processing-time",
        title: "3. Processing timeline",
        bodyHtml:
          "<p>Approved refunds are processed through the original payment gateway (Razorpay or Stripe) within 5-7 business days back to the originating bank account or card.</p>",
      },
    ],
  },
  license: {
    key: "license",
    title: "Product license",
    version: 2,
    updatedAt: "2026-09-24",
    sections: [
      {
        id: "license-grant",
        title: "1. License grant",
        bodyHtml:
          "<p>Subject to the terms of your purchase order, CodeKraft grants you a non-exclusive, worldwide license to install, execute, and customize the licensed software for your organization.</p>",
      },
      {
        id: "restrictions",
        title: "2. Restrictions",
        bodyHtml:
          "<p>You may not redistribute, sublicense, or resell the underlying source code or binaries as a standalone competing product.</p>",
      },
      {
        id: "audit-keys",
        title: "3. License keys & telemetry",
        bodyHtml:
          "<p>Self-hosted binaries may validate operational license authenticity against the CodeKraft licensing endpoint periodically without transmitting proprietary customer data.</p>",
      },
    ],
  },
};

// Published copy comes from the DB; static rendering would pin the built-in fixtures forever.
export const dynamic = "force-dynamic";

/** DB-published page when one exists (fixture copy otherwise, e.g. before seeding). */
async function loadDoc(slug: string): Promise<LegalPageView | undefined> {
  const fallback = LEGAL_DOCS[slug as LegalKey];
  if (!fallback) return undefined;
  try {
    const db = await contentService.getLegalPage({} as never, { key: fallback.key });
    if (!db.publishedAt) return fallback;
    return {
      key: db.key,
      title: db.title,
      version: db.version,
      updatedAt: db.publishedAt.slice(0, 10),
      sections: [{ id: "content", title: db.title, bodyHtml: db.html }],
    };
  } catch {
    return fallback;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = await loadDoc(slug);
  if (!doc) return {};

  return pageMetadata({
    path: `/legal/${slug}`,
    title: doc.title,
    description: `Official ${doc.title.toLowerCase()} for our products and engineering services.`,
  });
}

export default async function LegalPageRoute({ params }: PageProps) {
  const { slug } = await params;
  const doc = await loadDoc(slug);

  if (!doc) {
    notFound();
  }

  return <LegalPage page={doc} nav={LEGAL_NAV} />;
}

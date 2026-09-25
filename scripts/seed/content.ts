/**
 * Step 4 — site content (docs/05 §10 / §14). Non-production only.
 *
 * landing_chapters (five keys), eight services, three case studies, three testimonials, six client
 * logos (with placeholder `media` rows — no object is uploaded), site + chatbot FAQs and the four
 * legal pages. The copy is the dev-screen fixture text (src/app/dev/screens/_fixtures/site.ts),
 * copied here so the seed does not depend on preview fixtures. Every title carries `[PLACEHOLDER]`
 * (see shared.ts) — the founders replace it before launch.
 *
 * Natural keys: chapter `key`, service/case-study `slug`, legal page `key`, media `object_key`,
 * logo `name`, testimonial (`author_name`, `context`), FAQ (`scope`, `question`). Every row is
 * insert-if-absent: a second run changes nothing, and edits made in the admin survive a re-seed
 * (`pnpm db:reset` is the way to start over).
 */
import { and, eq, isNull } from "drizzle-orm";

import { getEnv } from "@/lib/env";
import {
  type LandingChapterCta,
  caseStudies,
  clientLogos,
  faqs,
  landingChapters,
  legalPageVersions,
  legalPages,
  services,
  testimonials,
} from "../../drizzle/schema/content";
import { media } from "../../drizzle/schema/media";
import { type SeedContext, placeholder, sha256Hex, tally, tiptap } from "./shared";

export interface SeedContentOptions {
  /** Author of legal page versions and uploader of placeholder media (the CEO). */
  adminUserId: string;
}

// ---------------------------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------------------------

const CHAPTERS: {
  key: "who" | "build" | "sell" | "proof" | "talk";
  title: string;
  subtitle: string;
  body: string;
  cta?: LandingChapterCta;
}[] = [
  {
    key: "who",
    title: "Software that ships, products that sell.",
    subtitle: "CodeKraft — software studio",
    body: "We design and build web, mobile and SaaS products for clients — and sell the ones we've perfected, ready to run.",
    cta: {
      primary: { label: "Browse products", href: "/products" },
      secondary: { label: "Talk to us", href: "/contact" },
    },
  },
  {
    key: "build",
    title: "Eight service lines, one fixed-scope promise.",
    subtitle: "02 / What we build",
    body: "Every engagement starts with a written scope, a date and a price. No hourly billing, no surprises.",
    cta: { primary: { label: "See services", href: "/services" } },
  },
  {
    key: "sell",
    title: "Ready-made software, priced honestly.",
    subtitle: "03 / What we sell",
    body: "Subscriptions, licenses and downloads — each with a clear delivery model and a real changelog.",
    cta: { primary: { label: "Browse products", href: "/products" } },
  },
  {
    key: "proof",
    title: "Work that our clients put their name to.",
    subtitle: "04 / Proof",
    body: "Case studies with numbers, not adjectives.",
    cta: { primary: { label: "Read case studies", href: "/case-studies" } },
  },
  {
    key: "talk",
    title: "Tell us what you're building.",
    subtitle: "05 / Talk to us",
    body: "We reply by email within 2 working days.",
    cta: { primary: { label: "Start an inquiry", href: "/contact" } },
  },
];

const SERVICES: {
  slug: string;
  title: string;
  summary: string;
  icon: string;
  deliverables: string[];
  body: string;
}[] = [
  {
    slug: "custom-web-apps",
    title: "Custom web applications",
    summary:
      "Internal tools, portals and dashboards built on Next.js and Postgres — scoped, shipped and handed over with documentation.",
    icon: "layout",
    deliverables: [
      "Discovery workshop and scope document",
      "Clickable prototype",
      "Production app with CI/CD",
      "Admin panel and role model",
      "Handover docs and a recorded walkthrough",
      "30 days of post-launch fixes",
    ],
    body: "We build the application your spreadsheet wishes it was. Every engagement starts with a fixed-scope proposal, so you know what ships and when.",
  },
  {
    slug: "mobile-apps",
    title: "Mobile apps",
    summary:
      "React Native apps for iOS and Android with a shared codebase, offline-first data and store submission handled for you.",
    icon: "smartphone",
    deliverables: [
      "UX flows and design system",
      "iOS and Android builds",
      "Push notifications and deep links",
      "App Store and Play Store submission",
    ],
    body: "One codebase, two stores, and a release process you can run without us.",
  },
  {
    slug: "saas-product-development",
    title: "SaaS product development",
    summary:
      "From MVP to multi-tenant platform: billing, subscriptions, onboarding and the operational tooling around them.",
    icon: "cloud",
    deliverables: [
      "Product roadmap and MVP scope",
      "Multi-tenant architecture",
      "Subscription billing and invoicing",
      "Usage analytics and admin console",
      "Observability and on-call runbook",
    ],
    body: "We have built and operated SaaS products of our own; we bring that operational experience to yours.",
  },
  {
    slug: "website-development",
    title: "Website development",
    summary:
      "Marketing sites and content platforms that score green on Core Web Vitals and are editable without a developer.",
    icon: "globe",
    deliverables: [
      "Design-to-code build",
      "Headless CMS integration",
      "SEO and structured data",
      "Performance budget and Lighthouse CI",
    ],
    body: "Fast, accessible and editable: the three things a marketing site has to be.",
  },
  {
    slug: "ui-ux-design",
    title: "UI/UX design",
    summary:
      "Research-led product design: flows, wireframes, a token-based design system and high-fidelity screens in both themes.",
    icon: "pen-tool",
    deliverables: [
      "User research summary",
      "Information architecture",
      "Wireframes and prototypes",
      "Design system and component library",
    ],
    body: "Design that engineers can build from directly, with tokens instead of pixel specs.",
  },
  {
    slug: "ai-integration",
    title: "AI integration",
    summary:
      "Assistants, document extraction and search grounded in your data — with guardrails, evaluation and cost controls.",
    icon: "sparkles",
    deliverables: [
      "Use-case assessment",
      "Retrieval pipeline on your content",
      "Assistant with escalation to humans",
      "Evaluation suite and usage dashboard",
    ],
    body: "Grounded assistants with measurable quality and a cost ceiling, not demos.",
  },
  {
    slug: "maintenance-support",
    title: "Maintenance & support",
    summary:
      "Monthly retainers that keep dependencies current, monitor uptime and fix what breaks before customers notice.",
    icon: "wrench",
    deliverables: [
      "Dependency and security updates",
      "Uptime and error monitoring",
      "Monthly health report",
      "Priority bug-fix queue",
    ],
    body: "A named engineer, a monthly report and a queue that gets worked every week.",
  },
  {
    slug: "consulting",
    title: "Consulting",
    summary:
      "Architecture reviews, technical due diligence and roadmap planning for founders and product teams.",
    icon: "compass",
    deliverables: [
      "Architecture review report",
      "Technical due-diligence memo",
      "90-day engineering roadmap",
      "Hiring and vendor evaluation support",
    ],
    body: "Senior engineering judgement, for the decisions you only get to make once.",
  },
];

const CASE_STUDIES: {
  slug: string;
  title: string;
  clientName: string | null;
  industry: string;
  techStack: string[];
  problem: string;
  solution: string;
  results: string;
  publishedAt: string;
}[] = [
  {
    slug: "northwind-checkout",
    title: "Cutting checkout drop-off for a lending marketplace",
    clientName: "Northwind Capital",
    industry: "Fintech",
    techStack: ["Next.js", "Postgres", "Razorpay", "Sentry"],
    problem:
      "Northwind's loan application ended in a five-step checkout that lost more than half of applicants on mobile. Analytics showed where, not why.",
    solution:
      "We rebuilt the flow as a single adaptive form with save-and-resume, inline document capture and a payment step that offers UPI first.",
    results:
      "Drop-off fell by 38% within the first month and support tickets about application status disappeared entirely.",
    publishedAt: "2026-08-20",
  },
  {
    slug: "meridian-mis",
    title: "One MIS for eleven hospital branches",
    clientName: "Meridian Health",
    industry: "Healthcare",
    techStack: ["Next.js", "Postgres", "Recharts"],
    problem: "Eleven branches reported monthly numbers in eleven formats.",
    solution: "MIS Portal with branch-level entry, approvals and consolidated roll-ups.",
    results: "Month-end closes in two days instead of nine.",
    publishedAt: "2026-07-05",
  },
  {
    slug: "confidential-logistics",
    title: "Real-time fleet dashboard for a regional carrier",
    clientName: null,
    industry: "Logistics",
    techStack: ["React", "Node.js", "TimescaleDB"],
    problem: "Dispatchers worked from phone calls and a whiteboard.",
    solution: "Live map, ETA prediction and exception queues.",
    results: "Idle time down 21% in the first quarter.",
    publishedAt: "2026-05-28",
  },
];

const TESTIMONIALS: { quote: string; authorName: string; authorTitle: string; company: string }[] =
  [
    {
      quote:
        "They scoped the work honestly, shipped on the date they said, and the handover was so thorough our own team could take it from there.",
      authorName: "Ritika Menon",
      authorTitle: "COO",
      company: "Northwind Capital",
    },
    {
      quote:
        "The MIS portal replaced four spreadsheets and a weekly reconciliation meeting. Payback in under a quarter.",
      authorName: "Arjun Desai",
      authorTitle: "Head of Operations",
      company: "Meridian Health",
    },
    {
      quote:
        "We bought TradeFlow off the shelf and had it customised for our workflow within three weeks. That combination is rare.",
      authorName: "Sofia Lindqvist",
      authorTitle: "Founder",
      company: "Kestrel Logistics",
    },
  ];

const CLIENT_LOGOS: { slug: string; name: string }[] = [
  { slug: "northwind-capital", name: "Northwind Capital" },
  { slug: "meridian-health", name: "Meridian Health" },
  { slug: "kestrel-logistics", name: "Kestrel Logistics" },
  { slug: "bloomfield-retail", name: "Bloomfield Retail" },
  { slug: "atlas-learning", name: "Atlas Learning" },
  { slug: "sunbeam-energy", name: "Sunbeam Energy" },
];

const SITE_FAQS: { question: string; answer: string }[] = [
  {
    question: "How do I pay?",
    answer:
      "Checkout shows UPI and bank-transfer instructions. Enter your transaction reference and we confirm the payment within one working day.",
  },
  {
    question: "Do you issue GST invoices?",
    answer: "Yes. A PDF invoice is issued for every confirmed order and stays in your account.",
  },
  {
    question: "Can I pay in a currency other than INR?",
    answer:
      "Prices are shown in your chosen currency for reference; invoices and manual payments are in INR.",
  },
  {
    question: "How do downloads work?",
    answer:
      "After payment confirmation the product appears in your account with a download button and the remaining download count.",
  },
  {
    question: "What is your refund policy?",
    answer: "Refunds are product-specific; each product page states whether it is refundable.",
  },
  {
    question: "Can you customise a product for us?",
    answer: "Yes. Send an inquiry from the product page and we reply with a fixed-scope quote.",
  },
];

const CHATBOT_FAQS: { question: string; answer: string }[] = [
  {
    question: "Where is my order?",
    answer:
      "Open Account → Orders. Pending payments show the instructions again; confirmed orders show the invoice and delivery.",
  },
  {
    question: "Where do I download my purchase?",
    answer: "Account → My products lists every entitlement with its download or access link.",
  },
  {
    question: "How do I contact a human?",
    answer: "Ask the assistant to escalate, or open Account → Support to raise a query.",
  },
  {
    question: "Which products do you sell?",
    answer:
      "SaaS subscriptions, perpetual licenses, hosted portals and downloadable website templates — see the catalogue.",
  },
];

const LEGAL_PAGES: {
  key: "privacy" | "terms" | "refunds" | "license";
  title: string;
  body: string[];
}[] = [
  {
    key: "privacy",
    title: "Privacy policy",
    body: [
      "This placeholder privacy policy must be replaced before launch. It should cover what we collect, cookies (strictly necessary only), the AI assistant provider and retention periods.",
    ],
  },
  {
    key: "terms",
    title: "Terms of service",
    body: [
      "This placeholder terms-of-service text must be replaced before launch. It should cover accounts, purchases, acceptable use and governing law (India).",
    ],
  },
  {
    key: "refunds",
    title: "Refund and cancellation policy",
    body: [
      "This placeholder refund policy must be replaced before launch.",
      "Payments are currently accepted by manual UPI and bank transfer only; refunds are returned to the originating account after admin approval.",
      "[PLACEHOLDER: gateway wording] When card or gateway payments are enabled, this section will describe gateway refund timelines.",
    ],
  },
  {
    key: "license",
    title: "Product license",
    body: [
      "This placeholder product license must be replaced before launch. It should define perpetual licenses, download-based access, update policies and permitted use.",
    ],
  },
];

// ---------------------------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------------------------

export async function seedContent(ctx: SeedContext, opts: SeedContentOptions): Promise<void> {
  const { db } = ctx;
  const now = new Date();

  // landing_chapters — by key
  {
    let created = 0;
    for (const [position, c] of CHAPTERS.entries()) {
      const rows = await db
        .insert(landingChapters)
        .values({
          key: c.key,
          title: placeholder(c.title),
          subtitle: c.subtitle,
          bodyJson: tiptap(c.body),
          cta: c.cta ?? null,
          position,
          published: true,
        })
        .onConflictDoNothing({ target: landingChapters.key })
        .returning({ id: landingChapters.id });
      created += rows.length;
    }
    tally(ctx, "landing_chapters", created);
  }

  // services — by slug
  {
    let created = 0;
    for (const [position, s] of SERVICES.entries()) {
      const rows = await db
        .insert(services)
        .values({
          slug: s.slug,
          title: placeholder(s.title),
          summary: s.summary,
          deliverables: s.deliverables,
          bodyJson: tiptap(s.body),
          icon: s.icon,
          position,
          published: true,
        })
        .onConflictDoNothing({ target: services.slug })
        .returning({ id: services.id });
      created += rows.length;
    }
    tally(ctx, "services", created);
  }

  // case_studies — by slug
  {
    let created = 0;
    for (const cs of CASE_STUDIES) {
      const rows = await db
        .insert(caseStudies)
        .values({
          slug: cs.slug,
          title: placeholder(cs.title),
          clientName: cs.clientName,
          industry: cs.industry,
          problemJson: tiptap(cs.problem),
          solutionJson: tiptap(cs.solution),
          resultsJson: tiptap(cs.results),
          techStack: cs.techStack,
          published: true,
          publishedAt: new Date(`${cs.publishedAt}T00:00:00Z`),
        })
        .onConflictDoNothing({ target: caseStudies.slug })
        .returning({ id: caseStudies.id });
      created += rows.length;
    }
    tally(ctx, "case_studies", created);
  }

  // testimonials (site) — insert-if-absent by (author_name, context = site)
  {
    let created = 0;
    for (const [position, t] of TESTIMONIALS.entries()) {
      const [row] = await db
        .select({ id: testimonials.id })
        .from(testimonials)
        .where(and(eq(testimonials.authorName, t.authorName), eq(testimonials.context, "site")))
        .limit(1);
      if (row !== undefined) continue;
      await db.insert(testimonials).values({
        quote: placeholder(t.quote),
        authorName: t.authorName,
        authorTitle: t.authorTitle,
        company: t.company,
        context: "site",
        position,
        published: true,
      });
      created += 1;
    }
    tally(ctx, "testimonials", created);
  }

  // client_logos + placeholder media — media by object_key, logo by name
  {
    const bucket = getEnv().R2_BUCKET_PUBLIC;
    let createdMedia = 0;
    let createdLogos = 0;
    for (const [position, logo] of CLIENT_LOGOS.entries()) {
      const objectKey = `seed/logos/${logo.slug}.svg`;
      const inserted = await db
        .insert(media)
        .values({
          bucket,
          objectKey,
          mime: "image/svg+xml",
          sizeBytes: 1024,
          width: 240,
          height: 80,
          checksum: sha256Hex(objectKey),
          visibility: "public",
          uploadedBy: opts.adminUserId,
        })
        .onConflictDoNothing({ target: media.objectKey })
        .returning({ id: media.id });
      createdMedia += inserted.length;
      const [mediaRow] = await db
        .select({ id: media.id })
        .from(media)
        .where(eq(media.objectKey, objectKey))
        .limit(1);
      if (mediaRow === undefined) throw new Error(`media row for ${objectKey} missing`);

      const name = placeholder(logo.name);
      const [existing] = await db
        .select({ id: clientLogos.id })
        .from(clientLogos)
        .where(eq(clientLogos.name, name))
        .limit(1);
      if (existing !== undefined) continue;
      await db
        .insert(clientLogos)
        .values({ name, mediaId: mediaRow.id, url: null, position, published: true });
      createdLogos += 1;
    }
    tally(ctx, "media", createdMedia);
    tally(ctx, "client_logos", createdLogos);
  }

  // faqs (site + chatbot) — insert-if-absent by (scope, question); product FAQs live in product_faqs
  {
    let created = 0;
    const groups = [
      ["site", SITE_FAQS],
      ["chatbot", CHATBOT_FAQS],
    ] as const;
    for (const [scope, list] of groups) {
      for (const [position, f] of list.entries()) {
        const question = placeholder(f.question);
        const [row] = await db
          .select({ id: faqs.id })
          .from(faqs)
          .where(and(eq(faqs.scope, scope), eq(faqs.question, question), isNull(faqs.productId)))
          .limit(1);
        if (row !== undefined) continue;
        await db.insert(faqs).values({
          question,
          answerJson: tiptap(f.answer),
          scope,
          position,
          published: true,
        });
        created += 1;
      }
    }
    tally(ctx, "faqs", created);
  }

  // legal_pages — insert-if-absent by key (edits bump versions; the seed never overwrites them)
  {
    let created = 0;
    let versions = 0;
    for (const page of LEGAL_PAGES) {
      const body = tiptap(...page.body);
      const inserted = await db
        .insert(legalPages)
        .values({
          key: page.key,
          title: placeholder(page.title),
          bodyJson: body,
          version: 1,
          publishedAt: now,
        })
        .onConflictDoNothing({ target: legalPages.key })
        .returning({ id: legalPages.id });
      created += inserted.length;
      const [row] = await db
        .select({ id: legalPages.id })
        .from(legalPages)
        .where(eq(legalPages.key, page.key))
        .limit(1);
      if (row === undefined) throw new Error(`legal page ${page.key} missing`);
      const v = await db
        .insert(legalPageVersions)
        .values({
          legalPageId: row.id,
          version: 1,
          bodyJson: body,
          publishedAt: now,
          publishedBy: opts.adminUserId,
        })
        .onConflictDoNothing()
        .returning({ id: legalPageVersions.id });
      versions += v.length;
    }
    tally(ctx, "legal_pages", created);
    tally(ctx, "legal_page_versions", versions);
  }

  ctx.log(
    `content: ${CHAPTERS.length} chapters, ${SERVICES.length} services, ${CASE_STUDIES.length} case studies, ${LEGAL_PAGES.length} legal pages ensured`,
  );
}

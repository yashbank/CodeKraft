/**
 * Step 3 — catalog (docs/05 §14, docs/10 §3). Non-production only.
 *
 * The five example products, their offerings/prices/methods and `active` ownership versions come
 * from `seedExampleCatalog()` (tests/factories/example-catalog.ts — the single copy of that data,
 * D-018). This step adds what the factory does not: a `1.0.0` changelog per product, two product
 * FAQs and one product testimonial each, the FitDesk Pro blog, three `featured_products` and the
 * docs/10 §3 coupons. Everything is keyed by natural keys (slug, version, question, code).
 */
import { and, eq } from "drizzle-orm";

import {
  categories,
  featuredProducts,
  productBlogs,
  productFaqs,
  productTestimonials,
  productVersions,
  products,
} from "../../drizzle/schema/catalog";
import { coupons } from "../../drizzle/schema/commerce";
import { offerings } from "../../drizzle/schema/offerings";
import { productOwnerships } from "../../drizzle/schema/ownership";
import { seedExampleCatalog } from "../../tests/factories/example-catalog";
import { type SeedContext, countRows, placeholder, tally, tiptap } from "./shared";

export interface SeedCatalogOptions {
  /** Super Admin addresses in CEO, CFO order (the partners the ownership lines point at). */
  partnerEmails: { ceo: string; cfo: string };
}

const FEATURED_SLUGS = ["fitdesk-pro", "tradeflow", "ecommerce-website"] as const;

interface ProductCopy {
  faqs: { question: string; answer: string }[];
  testimonial: { authorName: string; authorTitle: string; company: string; quote: string };
  added: string[];
}

const PRODUCT_COPY: Record<string, ProductCopy> = {
  "fitdesk-pro": {
    faqs: [
      {
        question: "Can I import members from my current tool?",
        answer: "Yes. CSV import maps names, phones, plans and expiry dates.",
      },
      {
        question: "What happens if I cancel?",
        answer:
          "Your studio stays active until the end of the paid period; data export remains available for 60 days after.",
      },
    ],
    testimonial: {
      authorName: "Ritika Menon",
      authorTitle: "Owner",
      company: "Pulse Studio",
      quote: "The reconciliation view is the first one I open every morning.",
    },
    added: ["Member CRM", "Class scheduling", "Automated billing"],
  },
  tradeflow: {
    faqs: [
      {
        question: "Does the license expire?",
        answer: "No. The perpetual license covers this major version; major upgrades are paid.",
      },
      {
        question: "Does it work offline?",
        answer: "Yes. TradeFlow stores data locally and syncs nothing to the cloud.",
      },
    ],
    testimonial: {
      authorName: "Sofia Lindqvist",
      authorTitle: "Founder",
      company: "Kestrel Logistics",
      quote: "We bought TradeFlow off the shelf and had it customised within three weeks.",
    },
    added: ["GST invoicing", "Stock ledger", "Offline first"],
  },
  "mis-portal": {
    faqs: [
      {
        question: "Where is the portal hosted?",
        answer:
          "On our infrastructure, with backups, monitoring and updates included for 12 months.",
      },
      {
        question: "How long does onboarding take?",
        answer: "Three steps: kick-off call, data import and go-live — typically four weeks.",
      },
    ],
    testimonial: {
      authorName: "Arjun Desai",
      authorTitle: "Head of Operations",
      company: "Meridian Health",
      quote: "The MIS portal replaced four spreadsheets and a weekly reconciliation meeting.",
    },
    added: ["KPI dashboards", "Scheduled reports", "Role-based access"],
  },
  "resume-portfolio-website": {
    faqs: [
      {
        question: "How many times can I download the package?",
        answer: "Three downloads per purchase; contact support if you need the cap reset.",
      },
      {
        question: "Can I get a refund?",
        answer: "Yes, within the refund window described on the refunds page.",
      },
    ],
    testimonial: {
      authorName: "Neha Kulkarni",
      authorTitle: "Freelance designer",
      company: "Independent",
      quote: "Deployed my portfolio in an afternoon; the dark theme looks great.",
    },
    added: ["Two themes", "SEO ready", "Markdown content"],
  },
  "ecommerce-website": {
    faqs: [
      {
        question: "Which payment providers are supported?",
        answer:
          "Stripe out of the box; the setup service can wire Razorpay for Indian storefronts.",
      },
      {
        question: "What does the setup service include?",
        answer: "A requirements call, deployment to your host and a handover session.",
      },
    ],
    testimonial: {
      authorName: "Vikram Rao",
      authorTitle: "Founder",
      company: "Bloomfield Retail",
      quote: "Catalogue, cart and checkout were live within a week of the handover call.",
    },
    added: ["Cart and checkout", "Admin panel", "Setup service"],
  },
};

export async function seedCatalog(ctx: SeedContext, opts: SeedCatalogOptions): Promise<void> {
  const { db } = ctx;

  // The factory returns what exists without saying what it inserted: diff the counts around it.
  const counted = [
    ["categories", categories],
    ["products", products],
    ["offerings", offerings],
    ["product_ownerships", productOwnerships],
  ] as const;
  const before = await Promise.all(counted.map(([, table]) => countRows(db, table)));
  const seeded = await seedExampleCatalog(
    { partnerEmails: opts.partnerEmails, status: "published" },
    db,
  );
  const ceoId = seeded.users.ceo.id;
  const after = await Promise.all(counted.map(([, table]) => countRows(db, table)));
  counted.forEach(([name], i) => tally(ctx, name, (after[i] ?? 0) - (before[i] ?? 0)));

  let versions = 0;
  let faqs = 0;
  let testimonials = 0;
  for (const { data, product } of seeded.products) {
    const copy = PRODUCT_COPY[data.slug];
    if (copy === undefined) throw new Error(`no seed copy for product ${data.slug}`);

    const v = await db
      .insert(productVersions)
      .values({
        productId: product.id,
        version: "1.0.0",
        changelogJson: { summary: `${data.name} 1.0.0 — initial release.`, added: copy.added },
        createdBy: ceoId,
      })
      .onConflictDoNothing()
      .returning({ id: productVersions.id });
    versions += v.length;

    for (const [i, faq] of copy.faqs.entries()) {
      const question = placeholder(faq.question);
      const [existing] = await db
        .select({ id: productFaqs.id })
        .from(productFaqs)
        .where(and(eq(productFaqs.productId, product.id), eq(productFaqs.question, question)))
        .limit(1);
      if (existing !== undefined) continue;
      await db.insert(productFaqs).values({
        productId: product.id,
        question,
        answerJson: tiptap(faq.answer),
        position: i,
      });
      faqs += 1;
    }

    const t = copy.testimonial;
    const [existingT] = await db
      .select({ id: productTestimonials.id })
      .from(productTestimonials)
      .where(
        and(
          eq(productTestimonials.productId, product.id),
          eq(productTestimonials.authorName, t.authorName),
        ),
      )
      .limit(1);
    if (existingT === undefined) {
      await db.insert(productTestimonials).values({
        productId: product.id,
        authorName: t.authorName,
        authorTitle: t.authorTitle,
        company: t.company,
        quote: placeholder(t.quote),
        position: 0,
        published: true,
      });
      testimonials += 1;
    }
  }
  tally(ctx, "product_versions", versions);
  tally(ctx, "product_faqs", faqs);
  tally(ctx, "product_testimonials", testimonials);

  const bySlug = new Map(seeded.products.map((p) => [p.data.slug, p.product]));
  const fitdesk = bySlug.get("fitdesk-pro");
  if (fitdesk === undefined) throw new Error("fitdesk-pro missing after seedExampleCatalog");
  const blog = await db
    .insert(productBlogs)
    .values({
      productId: fitdesk.id,
      slug: "how-fitdesk-pro-collects-fees-on-upi",
      title: placeholder("How FitDesk Pro collects membership fees on UPI without chasing anyone"),
      excerpt:
        "Autopay mandates, reminders that respect quiet hours and a reconciliation view that finally matches the bank statement.",
      bodyJson: tiptap(
        "Most studios lose money not because members leave, but because fees are collected late. FitDesk Pro treats collection as a product feature, not an afterthought.",
        "When a member signs up, FitDesk Pro offers a UPI autopay mandate. The mandate is the default; manual payment is the exception.",
        "Each settlement file from the bank is matched against expected debits. Shortfalls and overpayments are flagged, never silently absorbed.",
      ),
      status: "published",
      publishedAt: new Date(),
      authorId: ceoId,
    })
    .onConflictDoNothing()
    .returning({ id: productBlogs.id });
  tally(ctx, "product_blogs", blog.length);

  let featured = 0;
  for (const [position, slug] of FEATURED_SLUGS.entries()) {
    const product = bySlug.get(slug);
    if (product === undefined) throw new Error(`${slug} missing after seedExampleCatalog`);
    const rows = await db
      .insert(featuredProducts)
      .values({ productId: product.id, position })
      .onConflictDoNothing()
      .returning({ productId: featuredProducts.productId });
    featured += rows.length;
  }
  tally(ctx, "featured_products", featured);

  let couponRows = 0;
  const couponSpecs: (typeof coupons.$inferInsert)[] = [
    { code: "WELCOME10", kind: "percent", value: 1000, firstPurchaseOnly: true, createdBy: ceoId },
    {
      code: "FLAT500",
      kind: "fixed",
      value: 50_000,
      currency: "INR",
      maxRedemptions: 1,
      createdBy: ceoId,
    },
    {
      code: "EXPIRED",
      kind: "percent",
      value: 1000,
      startsAt: new Date("2020-01-01T00:00:00Z"),
      endsAt: new Date("2020-12-31T23:59:59Z"),
      createdBy: ceoId,
    },
  ];
  for (const spec of couponSpecs) {
    const rows = await db
      .insert(coupons)
      .values(spec)
      .onConflictDoNothing({ target: coupons.code })
      .returning({ id: coupons.id });
    couponRows += rows.length;
  }
  tally(ctx, "coupons", couponRows);

  ctx.log(`catalog: ${seeded.products.length} products ensured`);
}

/**
 * Fixture data for the public-site screen previews (/dev/screens/site/*). Shapes are the real
 * `components/site/types` view models so P7 can swap these for query results without touching
 * the components. Prices are integer paise (INR).
 */
import type {
  BlogPost,
  CaseStudy,
  ClientLogo,
  LandingContent,
  LegalPageView,
  ProductDetail,
  ProductSummary,
  Service,
  ServiceOption,
  Testimonial,
} from "@/components/site/types";
import type { Money } from "@/lib/money";

const inr = (paise: number): Money => ({ amountMinor: paise, currency: "INR" });

const CATEGORIES = {
  saas: { slug: "saas", name: "SaaS" },
  business: { slug: "business-software", name: "Business software" },
  websites: { slug: "websites", name: "Websites" },
  ecommerce: {
    slug: "ecommerce",
    name: "E-commerce",
    parent: { slug: "websites", name: "Websites" },
  },
} as const;

/** Two-level category tree for the filter panel (D-303). */
export const CATEGORY_TREE: {
  slug: string;
  name: string;
  children: { slug: string; name: string }[];
}[] = [
  { slug: "saas", name: "SaaS", children: [] },
  { slug: "business-software", name: "Business software", children: [] },
  {
    slug: "websites",
    name: "Websites",
    children: [
      { slug: "ecommerce", name: "E-commerce" },
      { slug: "portfolio", name: "Portfolio & résumé" },
    ],
  },
];

const SERVICE_OPTIONS_SOURCE: Service[] = [
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
    bodyHtml:
      "<p>We build the application your spreadsheet wishes it was. Every engagement starts with a fixed-scope proposal, so you know what ships and when.</p>",
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
  },
];

export const SERVICES: Service[] = SERVICE_OPTIONS_SOURCE;

export const SERVICE_OPTIONS: ServiceOption[] = SERVICES.map((s) => ({
  slug: s.slug,
  title: s.title,
}));

export const CLIENT_LOGOS: ClientLogo[] = [
  { id: "l1", name: "Northwind Capital" },
  { id: "l2", name: "Meridian Health" },
  { id: "l3", name: "Kestrel Logistics" },
  { id: "l4", name: "Bloomfield Retail" },
  { id: "l5", name: "Atlas Learning" },
  { id: "l6", name: "Sunbeam Energy" },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    quote:
      "They scoped the work honestly, shipped on the date they said, and the handover was so thorough our own team could take it from there.",
    author: "Ritika Menon",
    role: "COO",
    company: "Northwind Capital",
  },
  {
    id: "t2",
    quote:
      "The MIS portal replaced four spreadsheets and a weekly reconciliation meeting. Payback in under a quarter.",
    author: "Arjun Desai",
    role: "Head of Operations",
    company: "Meridian Health",
  },
  {
    id: "t3",
    quote:
      "We bought TradeFlow off the shelf and had it customised for our workflow within three weeks. That combination is rare.",
    author: "Sofia Lindqvist",
    role: "Founder",
    company: "Kestrel Logistics",
  },
];

const BASE_PRODUCTS: ProductSummary[] = [
  {
    id: "p-fitdesk",
    slug: "fitdesk-pro",
    name: "FitDesk Pro",
    shortDescription:
      "Gym and studio management SaaS: memberships, class schedules, UPI collections and trainer payroll.",
    category: CATEGORIES.saas,
    fromPrice: inr(149_900),
    purchaseModels: ["subscription"],
    deliveryTypes: ["saas"],
    isFeatured: true,
    isComingSoon: false,
    tags: ["Fitness", "Memberships"],
    techStack: ["Next.js", "Postgres", "Razorpay"],
    industries: ["Fitness", "Wellness"],
    audiences: ["Small business", "Studios"],
    coverAlt: "FitDesk Pro dashboard showing today's classes and member check-ins",
    coverTone: 0,
    publishedAt: "2026-08-12",
    popularity: 92,
  },
  {
    id: "p-tradeflow",
    slug: "tradeflow",
    name: "TradeFlow",
    shortDescription:
      "Desktop inventory and invoicing for traders and distributors, with GST e-invoicing and multi-godown stock.",
    category: CATEGORIES.business,
    fromPrice: inr(4_999_900),
    purchaseModels: ["one_time", "custom_quote"],
    deliveryTypes: ["license"],
    isFeatured: false,
    isComingSoon: false,
    isNewVersion: true,
    tags: ["Inventory", "GST"],
    techStack: ["Electron", "SQLite", "React"],
    industries: ["Trading", "Distribution"],
    audiences: ["SMEs"],
    coverAlt: "TradeFlow stock ledger with a GST invoice open beside it",
    coverTone: 1,
    publishedAt: "2026-06-03",
    popularity: 71,
  },
  {
    id: "p-mis",
    slug: "mis-portal",
    name: "MIS Portal",
    shortDescription:
      "Management information system for multi-branch organisations: KPI roll-ups, approvals and audit trails, hosted and onboarded by us.",
    category: CATEGORIES.business,
    fromPrice: inr(14_999_900),
    purchaseModels: ["one_time", "subscription"],
    deliveryTypes: ["hosted", "service"],
    isFeatured: true,
    isComingSoon: false,
    tags: ["Reporting", "Approvals"],
    techStack: ["Next.js", "Postgres", "Recharts"],
    industries: ["Healthcare", "Education", "Manufacturing"],
    audiences: ["Enterprises", "Mid-market"],
    coverAlt: "MIS Portal executive dashboard with branch KPIs",
    coverTone: 2,
    publishedAt: "2026-07-21",
    popularity: 64,
  },
  {
    id: "p-resume",
    slug: "resume-portfolio-website",
    name: "Résumé / Portfolio Website",
    shortDescription:
      "A fast, single-page personal site template with a CV section, project gallery and contact form. Download, edit, deploy.",
    category: { slug: "portfolio", name: "Portfolio & résumé", parent: CATEGORIES.websites },
    fromPrice: inr(299_900),
    compareAtPrice: inr(499_900),
    purchaseModels: ["one_time"],
    deliveryTypes: ["download"],
    isFeatured: true,
    isComingSoon: false,
    tags: ["Template", "Personal"],
    techStack: ["Astro", "Tailwind"],
    industries: ["Creative", "Freelance"],
    audiences: ["Individuals", "Freelancers"],
    coverAlt: "Portfolio website template hero with a project grid",
    coverTone: 3,
    publishedAt: "2026-09-02",
    popularity: 88,
  },
  {
    id: "p-ecom",
    slug: "ecommerce-website",
    name: "E-commerce Website",
    shortDescription:
      "Storefront kit with catalogue, cart, UPI and card checkout and an order desk — download it or let us set it up for you.",
    category: CATEGORIES.ecommerce,
    fromPrice: inr(1_999_900),
    purchaseModels: ["one_time"],
    deliveryTypes: ["download", "service"],
    isFeatured: false,
    isComingSoon: true,
    tags: ["Storefront", "Checkout"],
    techStack: ["Next.js", "Stripe", "Postgres"],
    industries: ["Retail", "D2C"],
    audiences: ["Small business", "Brands"],
    coverAlt: "E-commerce storefront product page with cart drawer open",
    coverTone: 4,
    publishedAt: "2026-09-20",
    popularity: 40,
  },
];

export const PRODUCTS: ProductSummary[] = BASE_PRODUCTS;

export const FEATURED_PRODUCTS: ProductSummary[] = PRODUCTS.filter((p) => p.isFeatured);

const fitdesk = BASE_PRODUCTS[0] as ProductSummary;

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-fitdesk-pro-collects-fees-on-upi",
    title: "How FitDesk Pro collects membership fees on UPI without chasing anyone",
    excerpt:
      "Autopay mandates, reminders that respect quiet hours and a reconciliation view that finally matches the bank statement.",
    publishedAt: "2026-09-18",
    readingMinutes: 6,
    coverAlt: "Illustration of a phone showing a UPI payment reminder",
    coverTone: 0,
    product: { slug: "fitdesk-pro", name: "FitDesk Pro", category: CATEGORIES.saas },
    bodyHtml: `
<p>Most studios lose money not because members leave, but because fees are collected late. FitDesk Pro treats collection as a product feature, not an afterthought.</p>
<h2>Mandates, not reminders</h2>
<p>When a member signs up, FitDesk Pro offers a UPI autopay mandate. The mandate is the default; manual payment is the exception.</p>
<ul><li>Mandates are created during onboarding, on the member's own phone.</li><li>Failed debits retry twice, then hand over to the front desk with context.</li><li>Every debit posts to the ledger with the member, plan and period attached.</li></ul>
<h2>Reminders that respect people</h2>
<p>Reminders go out inside a configurable window and never on holidays. Members can reply with a payment link tap; the desk sees who paid and who didn't.</p>
<blockquote>"The reconciliation view is the first one I open every morning." — a studio owner in Pune</blockquote>
<h2>Reconciliation that matches the bank</h2>
<p>Each settlement file from the bank is matched against expected debits. Shortfalls and overpayments are flagged, never silently absorbed.</p>
<pre><code class="language-ts">const expected = plan.amountMinor;
const received = settlement.amountMinor;
if (received !== expected) flag(member, { expected, received });</code></pre>
<h3>What is next</h3>
<p>Quarterly plans with pro-rated upgrades are in the current release; family plans follow.</p>`,
  },
  {
    slug: "tradeflow-2-3-multi-godown-stock",
    title: "TradeFlow 2.3: multi-godown stock, finally done right",
    excerpt:
      "Transfers, in-transit quantities and a stock ledger that explains every movement. Here is how we modelled it.",
    publishedAt: "2026-08-30",
    readingMinutes: 8,
    coverAlt: "Diagram of stock moving between two warehouses",
    coverTone: 1,
    product: { slug: "tradeflow", name: "TradeFlow", category: CATEGORIES.business },
    bodyHtml:
      "<p>Multi-location stock is where most inventory tools become spreadsheets again.</p><h2>The model</h2><p>Every movement is a signed ledger row against a location.</p><h2>Transfers</h2><p>A transfer is two rows and an in-transit state, never a silent edit.</p>",
  },
  {
    slug: "why-we-host-the-mis-portal-for-you",
    title: "Why we host the MIS Portal for you (and what that costs)",
    excerpt:
      "Hosted plus onboarding is the delivery model for MIS Portal. This is the reasoning and what the annual hosting plan covers.",
    publishedAt: "2026-08-05",
    readingMinutes: 5,
    coverAlt: "Server rack illustration with a shield icon",
    coverTone: 2,
    product: { slug: "mis-portal", name: "MIS Portal", category: CATEGORIES.business },
    bodyHtml:
      "<p>Organisations buying an MIS want the reports, not the servers.</p><h2>What hosting includes</h2><p>Backups, monitoring, updates and a named contact.</p><h2>What onboarding includes</h2><p>Data import, role setup and two training sessions.</p>",
  },
];

export const PRODUCT_DETAIL: ProductDetail = {
  ...fitdesk,
  version: "3.2.0",
  descriptionHtml:
    "<p>FitDesk Pro runs the front desk, the class floor and the back office of a fitness studio from one browser tab. Members book on their phone, trainers see their day, and owners see revenue that reconciles.</p><p>It is hosted by us, updated continuously and priced per studio, not per member.</p>",
  benefits: [
    "Collect fees on UPI autopay with automatic reconciliation",
    "Fill classes with waitlists and reminders",
    "Pay trainers from attendance, not spreadsheets",
    "See revenue, churn and utilisation in one dashboard",
  ],
  targetAudience: ["Independent gyms", "Yoga and pilates studios", "Multi-branch fitness chains"],
  useCases: [
    "Member onboarding with KYC and plan selection",
    "Class scheduling with capacity and waitlists",
    "Trainer payroll from attendance",
    "Branch-level P&L for chains",
  ],
  requirements: [
    "A modern browser (Chrome, Safari, Edge, Firefox)",
    "UPI-enabled business account for autopay",
    "Optional: turnstile or QR scanner for check-ins",
  ],
  features: [
    "Membership plans with pro-rated upgrades",
    "UPI autopay mandates and payment links",
    "Class calendar with capacity, waitlist and reminders",
    "Trainer attendance and payroll export",
    "Member app (PWA) with bookings and receipts",
    "Branch roll-ups and owner dashboard",
    "Role-based access with audit log",
    "CSV import from existing tools",
  ],
  offerings: [
    {
      id: "off-starter-m",
      name: "Starter",
      purchaseModel: "subscription",
      billingInterval: "monthly",
      deliveryType: "saas",
      price: inr(149_900),
      accessPeriod: "While subscribed",
      trialDays: 14,
      updatePolicy: "during_access",
      isRefundable: false,
      features: ["1 branch", "Up to 300 members", "Class scheduling", "UPI payment links"],
    },
    {
      id: "off-pro-m",
      name: "Pro",
      purchaseModel: "subscription",
      billingInterval: "monthly",
      deliveryType: "saas",
      price: inr(399_900),
      accessPeriod: "While subscribed",
      trialDays: 14,
      updatePolicy: "during_access",
      isRefundable: false,
      features: [
        "Up to 3 branches",
        "Unlimited members",
        "UPI autopay mandates",
        "Trainer payroll",
        "Member PWA",
      ],
    },
    {
      id: "off-pro-a",
      name: "Pro · annual",
      purchaseModel: "subscription",
      billingInterval: "annual",
      deliveryType: "saas",
      price: inr(3_999_000),
      compareAtPrice: inr(4_798_800),
      accessPeriod: "12 months",
      updatePolicy: "during_access",
      isRefundable: false,
      features: ["Everything in Pro", "Two months free", "Priority support"],
    },
    {
      id: "off-chain",
      name: "Chain",
      purchaseModel: "custom_quote",
      deliveryType: "custom",
      accessPeriod: "Per agreement",
      updatePolicy: "all_free",
      isRefundable: false,
      features: ["10+ branches", "SSO and custom roles", "Dedicated onboarding"],
    },
  ],
  media: [
    {
      id: "m1",
      kind: "image",
      alt: "FitDesk Pro owner dashboard with today's revenue and check-ins",
    },
    { id: "m2", kind: "screenshot", alt: "Class calendar week view with capacity bars" },
    { id: "m3", kind: "screenshot", alt: "Member profile with UPI mandate status" },
    { id: "m4", kind: "gallery", alt: "Trainer payroll export screen" },
    {
      id: "m5",
      kind: "video_embed",
      alt: "Three-minute product tour video",
      caption: "Product tour",
    },
    { id: "m6", kind: "presentation", alt: "FitDesk Pro overview deck", caption: "Overview deck" },
  ],
  faqs: [
    {
      id: "f1",
      question: "Can I import members from my current tool?",
      answer:
        "Yes. CSV import maps names, phones, plans and expiry dates. We also import from the two most common Indian gym tools directly.",
    },
    {
      id: "f2",
      question: "Does autopay work with every bank?",
      answer:
        "UPI autopay works with all NPCI-enabled banks. Members without autopay receive payment links instead.",
    },
    {
      id: "f3",
      question: "Is my data backed up?",
      answer:
        "Daily encrypted backups with 30-day retention. You can export everything as CSV at any time.",
    },
    {
      id: "f4",
      question: "What happens if I cancel?",
      answer:
        "Your studio stays active until the end of the paid period; data export remains available for 60 days after.",
    },
  ],
  changelog: [
    {
      version: "3.2.0",
      date: "2026-09-10",
      notesHtml:
        "<ul><li>Quarterly plans with pro-rated upgrades</li><li>Waitlist auto-promotion notifications</li><li>Faster owner dashboard on large chains</li></ul>",
    },
    {
      version: "3.1.2",
      date: "2026-08-14",
      notesHtml:
        "<ul><li>Fix: mandate retries no longer double-notify</li><li>Hindi labels in the member app</li></ul>",
    },
    {
      version: "3.1.0",
      date: "2026-07-02",
      notesHtml:
        "<ul><li>Trainer payroll export (Excel, Tally)</li><li>Branch roll-ups for chains</li></ul>",
    },
  ],
  testimonials: [TESTIMONIALS[0] as Testimonial, TESTIMONIALS[1] as Testimonial],
  hasPresentation: true,
  liveDemoUrl: "https://demo.example.invalid/fitdesk",
  blog: BLOG_POSTS[0] as BlogPost,
};

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "northwind-checkout",
    title: "Cutting checkout drop-off for a lending marketplace",
    client: "Northwind Capital",
    industry: "Fintech",
    techStack: ["Next.js", "Postgres", "Razorpay", "Sentry"],
    resultHighlight: "−38% checkout drop-off",
    publishedAt: "2026-08-20",
    coverAlt: "Loan checkout flow on desktop and phone",
    coverTone: 5,
    problemHtml:
      "<p>Northwind's loan application ended in a five-step checkout that lost more than half of applicants on mobile. Analytics showed where, not why.</p>",
    solutionHtml:
      "<p>We rebuilt the flow as a single adaptive form with save-and-resume, inline document capture and a payment step that offers UPI first. Every field got an error message a human would write.</p><ul><li>Session-resumable applications</li><li>Camera capture for KYC documents</li><li>UPI intent on Android, QR on desktop</li></ul>",
    resultsHtml:
      '<p>Drop-off fell by 38% within the first month and support tickets about "where is my application" disappeared entirely.</p>',
    metrics: [
      { label: "Checkout drop-off", value: "−38%" },
      { label: "Median completion time", value: "4m 10s" },
      { label: "Support tickets", value: "−72%" },
    ],
    timeline: "9 weeks",
    gallery: [
      {
        id: "g1",
        kind: "gallery",
        alt: "Adaptive application form step",
        caption: "One adaptive form instead of five pages",
      },
      {
        id: "g2",
        kind: "gallery",
        alt: "UPI payment step with QR code",
        caption: "UPI first on every device",
      },
      {
        id: "g3",
        kind: "gallery",
        alt: "Ops dashboard of stalled applications",
        caption: "Ops view of stalled applications",
      },
    ],
  },
  {
    slug: "meridian-mis",
    title: "One MIS for eleven hospital branches",
    client: "Meridian Health",
    industry: "Healthcare",
    techStack: ["Next.js", "Postgres", "Recharts"],
    resultHighlight: "4 spreadsheets retired",
    publishedAt: "2026-07-05",
    coverAlt: "Hospital branch KPI dashboard",
    coverTone: 2,
    problemHtml: "<p>Eleven branches reported monthly numbers in eleven formats.</p>",
    solutionHtml: "<p>MIS Portal with branch-level entry, approvals and consolidated roll-ups.</p>",
    resultsHtml: "<p>Month-end closes in two days instead of nine.</p>",
    metrics: [
      { label: "Month-end close", value: "2 days" },
      { label: "Branches onboarded", value: "11" },
    ],
    timeline: "12 weeks",
    gallery: [
      {
        id: "g4",
        kind: "gallery",
        alt: "Consolidated KPI roll-up",
        caption: "Consolidated roll-up",
      },
    ],
  },
  {
    slug: "confidential-logistics",
    title: "Real-time fleet dashboard for a regional carrier",
    industry: "Logistics",
    techStack: ["React", "Node.js", "TimescaleDB"],
    resultHighlight: "−21% idle time",
    publishedAt: "2026-05-28",
    coverAlt: "Map view of trucks with status badges",
    coverTone: 4,
    problemHtml: "<p>Dispatchers worked from phone calls and a whiteboard.</p>",
    solutionHtml: "<p>Live map, ETA prediction and exception queues.</p>",
    resultsHtml: "<p>Idle time down 21% in the first quarter.</p>",
    metrics: [{ label: "Idle time", value: "−21%" }],
    gallery: [],
  },
];

export const LANDING: LandingContent = {
  who: {
    eyebrow: "CodeKraft — software studio",
    title: "Software that ships, products that sell.",
    subtitle:
      "We design and build web, mobile and SaaS products for clients — and sell the ones we've perfected, ready to run.",
    body: "",
  },
  build: {
    eyebrow: "02 / What we build",
    title: "Eight service lines, one fixed-scope promise.",
    body: "Every engagement starts with a written scope, a date and a price. No hourly billing, no surprises.",
  },
  sell: {
    eyebrow: "03 / What we sell",
    title: "Ready-made software, priced honestly.",
    body: "Subscriptions, licenses and downloads — each with a clear delivery model and a real changelog.",
  },
  proof: {
    eyebrow: "04 / Proof",
    title: "Work that our clients put their name to.",
    body: "Case studies with numbers, not adjectives.",
    stats: [
      { label: "Projects delivered", value: "48" },
      { label: "Products live", value: "5" },
      { label: "Countries served", value: "7" },
    ],
  },
  talk: {
    eyebrow: "05 / Talk to us",
    title: "Tell us what you're building.",
    body: "We reply by email within 2 working days.",
  },
};

export const LEGAL_PRIVACY: LegalPageView = {
  key: "privacy",
  title: "Privacy policy",
  version: 3,
  updatedAt: "2026-09-24",
  sections: [
    {
      id: "what-we-collect",
      title: "1. What we collect",
      bodyHtml:
        "<p>We collect the information you give us when you create an account, buy a product, send an inquiry or talk to the assistant: name, email, optional phone and company, billing details and the content of your messages.</p><h3>1.1 Automatically collected</h3><p>Server logs record IP address, user agent and the pages requested. Analytics are cookie-free and aggregate.</p>",
    },
    {
      id: "how-we-use-it",
      title: "2. How we use it",
      bodyHtml:
        "<p>To deliver what you bought, reply to your inquiry, send the emails you asked for, prevent abuse and meet our legal obligations in India.</p>",
    },
    {
      id: "cookies",
      title: "3. Cookies",
      bodyHtml:
        "<p>We use strictly necessary cookies for sign-in, your currency and theme preference. We do not use advertising cookies.</p>",
    },
    {
      id: "ai-assistant",
      title: "4. The assistant",
      bodyHtml:
        "<p>Conversations with the assistant are sent to our AI provider to generate replies. Transcripts are retained for 90 days for quality review and then deleted.</p>",
    },
    {
      id: "retention",
      title: "5. Retention",
      bodyHtml:
        '<table><thead><tr><th scope="col">Data</th><th scope="col">Retained for</th></tr></thead><tbody><tr><td>Account and purchases</td><td>Life of the account + 8 years (tax law)</td></tr><tr><td>Inquiry messages</td><td>24 months</td></tr><tr><td>Assistant transcripts</td><td>90 days</td></tr><tr><td>Server logs</td><td>30 days</td></tr></tbody></table>',
    },
    {
      id: "your-rights",
      title: "6. Your rights",
      bodyHtml:
        "<p>You can export or delete your account from Settings. Deletion is irreversible; invoices are retained as required by law.</p>",
    },
  ],
};

export const LEGAL_NAV: { key: LegalPageView["key"]; title: string }[] = [
  { key: "privacy", title: "Privacy" },
  { key: "terms", title: "Terms" },
  { key: "refunds", title: "Refund & cancellation" },
  { key: "license", title: "Product license" },
];

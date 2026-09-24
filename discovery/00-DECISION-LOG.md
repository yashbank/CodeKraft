# CodeKraft — Running Decision Log

Canonical, append-only record of decisions made during requirements discovery.
Source: `CODECRAFT_INITIAL_SPEC.md` (baseline) + founder answers per batch.
Status legend: CONFIRMED (spec or founder) · PENDING (asked, awaiting answer) · FOLLOW-UP (answered, needs refinement) · REJECTED

## A. Confirmed from CODECRAFT_INITIAL_SPEC.md (never re-ask)

| ID | Decision | Source |
|----|----------|--------|
| D-001 | Business type: software company + company-owned digital product marketplace | Spec §1, §19 |
| D-002 | Public marketplace: yes. Public multi-vendor marketplace: no, not initially | Spec §1, §19 |
| D-003 | Initial internal partners/admins: 2 | Spec §2, §19 |
| D-004 | Product ownership configurable per product | Spec §2, §19 |
| D-005 | Revenue split configurable per product; may differ per product | Spec §2, §12 |
| D-006 | Revenue allocation stored immutably per transaction; future split changes never alter history | Spec §2, §12 |
| D-007 | Financial architecture uses a transaction/ledger model, not just a percentage field | Spec §2, §12 |
| D-008 | Delivery model admin-configurable per product (SaaS, hosted, source, download, license, product+service, custom) | Spec §3, §19 |
| D-009 | Payment model admin-configurable per product (one-time, subscription, extensible) | Spec §4, §19 |
| D-010 | Post-purchase access determined by product configuration | Spec §3, §19 |
| D-011 | Two substantially different visual themes; business logic/components separated from theme/design system | Spec §7, §19 |
| D-012 | Responsive: mobile → tablet → laptop → desktop → large desktop → TV where practical; deliberately designed | Spec §6, §19 |
| D-013 | Chatbot/query system: yes; exact intelligence level TBD | Spec §11, §19 |
| D-014 | Lead generation: yes; leads/queries surface in admin dashboard | Spec §10, §19 |
| D-015 | Live/real-time admin updates required where appropriate | Spec §10, §19 |
| D-016 | Separate professional admin application | Spec §10 |
| D-017 | Full user account/dashboard (not just an auth gate) | Spec §8 |
| D-018 | Products are configurable entities; example products are NOT hardcoded | Spec §9 |
| D-019 | SEO, performance (Core Web Vitals), security designed in from the start | Spec §13–15, §19 |
| D-020 | Technology stack NOT chosen prematurely; selected via justified architecture process | Spec §18 |
| D-021 | AI-assisted, multi-phase implementation (Claude Code → docs → GitHub → Antigravity) | Spec §17, §19 |
| D-022 | Structured engineering documentation set required (BRD…Phase plans), consolidated where sensible | Spec §16 |

## B. Decisions from discovery batches

### Batch 1 — Business & Company (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-101 | Brand name is **CodeKraft** (with K). Spec's "CodeCraft" is superseded everywhere. | Terminology fix |
| D-102 | Positioning: company that builds software, websites and products as a service AND lists its own pre-built products for purchase. Equal weight on services and products. | |
| D-103 | Company-brand-only presentation. No founders/team names/photos shown at launch. Careers section deferred. | |
| D-104 | Target segments (unranked): startups/founders, SMBs, mid-market/enterprise, individual professionals, agencies/resellers. No vertical-specific targeting. | Founder unsure of exact audience |
| D-105 | Services sold as inquiry/lead only. No service pricing on the site. | |
| D-106 | Business objectives: leads, product sales, brand, subscriptions, partner ecosystem are ALL equal priority. | See R-101 |
| D-107 | Year-1 revenue expectation ₹10–20 lakh. Order volume 1–30 per YEAR. Prices TBD. | Very low volume → manual settlement acceptable |
| D-108 | Sell worldwide. | |
| D-109 | Payment methods required: UPI, bank transfer, credit/debit cards, netbanking, PayPal, Stripe, "others". | Multi-provider abstraction required |
| D-110 | Admin selects which payment methods are enabled **per product** at product creation/edit. | |
| D-111 | Logged-in users choose a display currency in settings; all prices render in that currency. | Display vs charge currency TBD (Batch 4) |
| D-112 | Two founders: CEO and CFO. No legal entity formed yet; organisation to be formed later. | See R-102 |
| D-113 | Revenue share is set per product by admin at upload time; customisable later. | Consistent with D-005 |
| D-114 | Partner model must scale: 1–3 more leadership partners and employees expected within 1–2 years. Onboarding new people must need "few changes". | → N-partner abstraction + RBAC, never hardcode 2 |
| D-115 | Platform to be integrable with a future internal MIS for employees. | Scope of "integrate" TBD (Batch 2) |
| D-116 | Buyers never see which admin/partner owns a product. Ownership is internal-only. | |
| D-117 | Credibility assets available as raw data (case studies, client logos, testimonials, portfolio); content must be produced. No founding story. | |
| D-118 | No KPIs defined. | |
| D-119 | Timeline: 3–6 days for all documentation + UI design, then build, then 1 day of full testing. | See R-103 |
| D-120 | **Customisable admin dashboard**: widget library of 10–20 widgets; each admin picks and arranges widgets independently. | New requirement |
| D-121 | **Product blog**: optional, one per product, authored by admin via a rich form; rendered as designed cards at the bottom of the product detail page, after all product details. Landing page shows blog teasers. Admins maintain all content; no external CMS. | Standalone blog URL TBD (see F-105) |

### Batch 2 — Users & Roles (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-201 | Roles: Visitor, Customer, Admin, Super Admin. Staff roles anticipated in RBAC but not seeded at launch. | |
| D-202 | Both founders are **Super Admin**. Future partners join as **Admin**. | |
| D-203 | Changing a live product's revenue split requires acknowledgement from every affected partner. | Interpreted from "2.2: C"; a/b/c pending (F-201) |
| D-204 | Purchase requires login. No guest checkout. | |
| D-205 | Chatbot requires login. Visitors get a query/contact form instead. | Conflicts with spec §11 visitor→chatbot funnel, see R-201 |
| D-206 | One login per customer; no team seats in V1. | |
| D-207 | Customer auth methods: phone OTP, email + password, Google. | Email verification & reset flow pending (F-202) |
| D-208 | 2FA: optional for admins; none for customers. | Method & admin hosting pending (F-203) |
| D-209 | Signup collects only email OR phone; customer then pays via any gateway enabled for the product. | See R-202 (billing data for tax/invoices) |
| D-210 | MIS integration: "do not block it". No concrete integration mode chosen. | Architecture assumption A-201 |
| D-211 | Session lifetime: admins 30 min, customers 60 min. | Idle vs absolute, and single-session, pending (F-204) |

### Batch 3 — Marketplace & Products (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-301 | Terminology: **Product** = ready-made item listed on the marketplace. **Project** = client engagement to develop something. | Resolves F-106 |
| D-302 | Services page includes: custom web apps, mobile apps, SaaS product development, website development, UI/UX design, AI integration, maintenance & support, consulting. Admin-editable list. | Resolves F-101 part 1 |
| D-303 | Categories are admin-managed, two-level (category → subcategory), and rendered flat in some UI locations. Launch set includes SaaS, Web Templates, Business Tools, Fintech, Health & Fitness "and many more". Free-form admin tags. | |
| D-304 | **Pricing structure is per-product configurable**: a product may have a single price, multiple tiers/plans, and/or multiple license types. Some products already sell as SaaS, some as license, and terms can differ per client. | Major: product → offerings/plans model (A-301) |
| D-305 | Product statuses: Draft, Published, Unpublished, Archived, plus orchestrator may add states needed for approval, scheduling and coming-soon. | See A-302 |
| D-306 | An approval step exists before publish. | Who approves with 2 Super Admins → F-301 |
| D-307 | Scheduled publishing at a future date: yes. | |
| D-308 | Delete only when a product has zero orders; otherwise archive. | |
| D-309 | Demo video: both external embed (YouTube/Vimeo) and self-hosted upload. | Interpreted from "3.6: c"; presentations/live-demo → F-302 |
| D-310 | Filters: category, price range, purchase model, delivery type, technology stack, industry, target audience. | Sort list & search scope → A-303 |
| D-311 | Wishlist: V1. | |
| D-312 | Public reviews/ratings: none. Admin-curated testimonials per product instead. | |
| D-313 | Product page shows version number and public changelog. | Buyer update notifications → Batch 6 |
| D-314 | Unlisted products (direct link only): yes. Coming-soon listings without buy button: yes. Admin-chosen featured products for landing: yes. | |
| D-315 | Every product page has a "Request customisation / Talk to us" CTA that creates a lead linked to the product. | |

### Batch 4 — Commerce & Payments (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-401 | Invoices/receipts issued in the name "CodeKraft" (the CodeKraft bank account holder). | Registration country still assumed India (F-102) |
| D-402 | **V1 payment methods: UPI and bank transfer only.** Provider accounts (Razorpay/Stripe/PayPal) to be created later; card/PayPal/Stripe added after launch. | See R-401; UPI mode → F-401 |
| D-403 | Currencies: at least INR, GBP, EUR, USD + one more widely used global currency (founder to name). Admin sets prices/currency; users see prices in an enabled currency. | Reconciliation with D-111 → F-402 |
| D-404 | Purchase models per offering: one-time, subscription, custom quote. | |
| D-405 | Subscription intervals: monthly, quarterly, annual. Prices customisable later. | Trial/free/billing engine/grace/cancel/proration → F-403 |
| D-406 | Licensed products: invoice carries CodeKraft contact numbers; customer contacts CodeKraft; license key and install details delivered by admin via email or SMS. Human-assisted delivery. | Feeds Batch 6 |
| D-407 | Taxes handled manually. Tax rate(s) configured in admin settings, editable, applied across products. | Inclusive/exclusive, GST reg, GST-number capture → F-404 |
| D-408 | Product discount displays original price struck through and the discounted price. | |
| D-409 | Coupon codes: V1. | Feature set → A-401 |
| D-410 | Checkout collects: full name, email, country (required), optional company, billing address, GST number. Signup stays email-or-phone. | Resolves R-202 |
| D-411 | Order statuses: Pending Payment, Paid, Fulfilled, Failed, Cancelled, Refunded, Partially Refunded. | |
| D-412 | Unpaid orders expire after 7 days. | |
| D-413 | A customer cannot buy the same one-time product twice. | |
| D-414 | Auto-generated PDF invoice per paid order, emailed + downloadable. Numbering sequential per financial year, e.g. CK/2026-27/0001. Credit notes issued for refunds. | |
| D-415 | Refund policy: mostly non-refundable; refundability is set per product by admin at listing. Refunds requested by emailing admins; executed by admin. Access revoked on refund. | Partial refunds → F-405 |
| D-416 | Chargeback → revoke access and flag customer. Failed payment → customer can retry from order page. | |
| D-417 | Bundles: later. | |

### Batch 5 — Revenue & Partner Accounting (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-501 | V1 UPI = static UPI QR; customer submits transaction ID; admin verifies and approves. Razorpay (and others) integrated shortly after launch (phase 2). | Resolves F-401 |
| D-502 | Currency: admin sets ONE platform base currency, consistent across the platform. Logged-in users may switch display currency in settings (converted via exchange-rate API). Charge happens in base currency in V1. | Resolves F-402/R-402; 5th currency still unnamed |
| D-503 | Subscriptions and trials/demos exist per product only if the admin enables them. | Grace/cancel/proration → A-501 |
| D-504 | Tax is applied per product only if the admin enables tax on that product; rate from admin settings. | Inclusive/exclusive & GST reg still open |
| D-505 | Refunds: not available through the portal. Customer emails admin; admin reviews manually and decides. Gateway-paid amounts are non-refundable; only UPI/manual payments may be refunded after admin review. | |
| D-506 | Revenue split per product is set by admin and takes effect only after approval by **all partners** (both admins). Any later change also requires all-partner approval. | Supersedes/aligns D-203 |
| D-507 | Split formula: gross − discount − tax − gateway charges = distributable; split by product percentages. Gateway fees are therefore shared proportionally. | |
| D-508 | Company cut before split: supported/configurable (may be 0). A product may be 100% one partner. Splits total 100%. | Interpreted from "5.2 c) both" |
| D-509 | One split per product (applies to all its offerings). Splits are effective-dated; changes apply to sales after approval only. | |
| D-510 | **Client project (services) revenue is tracked on the platform from V1**: admin creates project invoices manually; partner split applies. | Scope add; see R-501 |
| D-511 | All money lands in the single CodeKraft account. Payouts to partners are manual bank transfers recorded in the ledger (date, amount, reference). Cadence: on demand. Ledger shows running balance per partner. | |
| D-512 | Both Super Admins see everything and both may record payouts. Future Admin role sees only their own share by default. | Resolves F-201 (revenue part) |
| D-513 | Partner statements exportable as PDF and CSV. Reports at launch: revenue by product, by partner, by period, tax collected, refunds, outstanding payouts. | |
| D-514 | **Cost/expense tracking against products from V1** to compute profit, not just revenue. | Scope add |
| D-515 | Reporting base currency INR. Each ledger entry stores transaction currency/amount + INR equivalent at payment-date rate from an exchange-rate API. | |
| D-516 | Manual payment reconciliation: admin records actual amount received; the shortfall vs invoice is recorded as a bank-charge expense on that order (deducted before split). | |
| D-517 | Ledger adjustments require approval from all partners before they apply. Entries are immutable; corrections via adjusting entries. | |
| D-518 | Fifth currency: **CAD**. Launch set = INR, USD, EUR, GBP, CAD. | Closes F-402 |
| D-519 | Prices are tax-exclusive; tax added at checkout only when enabled on the product. | Closes F-404 part |
| D-520 | Custom-quote private offers for a specific customer with negotiated price and pay link: **V1**. | Closes F-406 |
| D-521 | Manual-renewal subscriptions: reminders before period end, 7-day grace, then suspend until paid. Cancellation = no renewal, access to period end. No proration in V1. | Confirms A-501 |

### Batch 6 — Product Delivery (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-601 | SaaS/hosted access provisioning is configurable per product: manual (admin creates account, emails credentials) or automated (API/webhook). Manual ships in V1; automated adapter slots in later. | |
| D-602 | Downloadable products delivered via secure dashboard download: private storage, short-lived signed links, downloads tracked. | |
| D-603 | License keys: admin enters the key per order; customer sees it in dashboard and receives it by email/SMS. | Consistent with D-406 |
| D-604 | Update policy configurable per product: all future versions free / free during access period / major versions paid separately. | |
| D-605 | One-time purchase access period configurable per product: lifetime or fixed term in months. Expired entitlements hide downloads. | |
| D-606 | Downloads: short-lived signed links tied to the buyer, every download logged, plus an admin-set **download cap per purchase**; buyer contacts admin to reset. | |
| D-607 | Revocation: automatic for platform-controlled assets (downloads, key visibility); for external SaaS accounts the platform raises an admin task + email reminder to disable by hand. | |
| D-608 | Product-with-service: admin defines service steps per product; each order shows a checklist; customer sees progress in dashboard; order becomes Fulfilled when all steps complete. | Resolves F-101 part 2 |

### Batch 7 — Chatbot / Leads / CRM (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-701 | Chatbot is **hybrid**: quick-reply menus for common tasks (order status, downloads, contact) + AI answers for free text, grounded only on site content (products, services, FAQs). Captures leads. Cost-controlled. | AI provider chosen in architecture (spec §12) |
| D-702 | Handoff: conversation becomes a query in admin dashboard; admin replies in the same thread; customer sees replies in dashboard + email. Near-live, not a live-chat widget. | |
| D-703 | Lead pipeline: New → Contacted → Qualified → Proposal → Won / Lost. | |
| D-704 | Lead sources tracked: contact/query form, product page CTA, chatbot, manual admin entry. | |
| D-705 | Assignment: new leads/queries land in a shared unassigned pool; any admin claims or assigns. | |
| D-706 | Follow-ups: admin sets next follow-up date + note per lead; overdue items highlighted in dashboard and emailed. | |
| D-707 | Admin alerts: **in-app real-time only** (no email/WhatsApp/push). Notifications persist in an inbox so an offline admin sees everything unread when they return. | Email alerts explicitly not selected |
| D-708 | AI cost control: admin-configurable **platform-wide daily message limit** and **per-user daily limit**. On hitting a limit the bot falls back to menus. | No monthly spend cap chosen |

### Batch 8 — Public Website & UX (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-801 | Landing page is **story chapters**: full-screen scroll chapters — Who we are → What we build → What we sell → Proof → Talk to us. Most cinematic option. | Heaviest build; see R-801 |
| D-802 | Hero has two CTAs: primary "Start a project" (opens project inquiry form), secondary "Explore products". | |
| D-803 | Case studies: grid + a detail page per case study (problem, solution, tech stack, results, images), each with its own URL. Admin-managed. | |
| D-804 | Product blogs get their own URL (/blog/slug), are embedded at the bottom of their product page, and appear as teasers on landing and a blog index. No company-level (non-product) blogs. | Resolves F-105 |
| D-805 | Product page: uploaded presentations render in an inline PDF viewer; admin may add an optional "Try live demo" link per product (opens hosted sandbox in new tab). | Resolves F-302 |
| D-806 | Services: a single page with one section per service (description, deliverables, CTA). No per-service detail pages. | |
| D-807 | Legal pages at launch: Privacy policy, Terms of service, Refund & cancellation policy, Product license terms. | |
| D-808 | Contact page/footer: **inquiry form only**. No public email, phone, WhatsApp or social links. | Contact numbers still appear on invoices per D-406 |

### Batch 9 — UI / Design (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-901 | Brand personality: all four selected (bold/futuristic, minimal/premium, playful/vibrant, corporate/trustworthy) with the instruction "most premium, designer and catchy". | Orchestrator will resolve as: premium-first, bold accents, restrained playfulness; see R-901 |
| D-902 | Theme 1: **Dark cinematic** — deep dark backgrounds, gradient glows, glass panels, light text. | |
| D-903 | Theme 2: **Light editorial** — off-white canvas, large serif headlines + clean sans body, generous spacing, subtle motion. (First answer "Dark cinematic" was re-asked due to D-011 conflict.) | |
| D-904 | Motion: scroll-driven 2D animation everywhere + one lazy-loaded WebGL 3D hero scene on landing, static-image fallback on low-power devices. | |
| D-905 | Theme control: admin sets the default site theme in settings; a visible toggle lets any visitor override; choice remembered per device and per account. | |
| D-906 | No existing brand assets. Design-system doc proposes logo direction, palette per theme, and font pairings for approval. | |
| D-907 | Accessibility: WCAG 2.1 AA. `prefers-reduced-motion` honored (animations off). Mobile gets simplified animation and no 3D. | |

### Batch 10 — User Dashboard (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-1001 | Customer dashboard sections at launch: Profile, Settings (currency, theme), Security, Notifications, Purchases & Access (orders, entitlements, downloads, keys, subscription status, service checklist, instructions), Invoices & Payment history, Queries & Conversations, Wishlist. | |
| D-1002 | Customer notification channels: **Email + In-app** confirmed. WhatsApp selected but founder asked for "free, no-cost ones only" → WhatsApp is conditional and deferred (see R-1001). No SMS. | Conflicts with D-406 "email or SMS" for keys → email only |
| D-1003 | Customers can self-delete (personal data anonymised; orders, invoices, ledger retained). Admins can suspend/ban. | Resolves F-205 |
| D-1004 | Subscription self-service: dashboard shows next due date; customer pays renewal via the product's enabled methods and can cancel with effect at period end. | |

### Batch 11 — Admin Dashboard (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-1101 | Widget library groups: Sales & revenue, Operations queue, Leads & queries, Traffic & engagement, **plus more** (orchestrator adds Catalog & content, Customers, System/AI health) to reach the 10–20 widget target of D-120. | |
| D-1102 | Publish approval: the submitting admin cannot self-approve; the other admin must approve. | Resolves F-301 |
| D-1103 | Peer access: all admins (currently both Super Admins) see and edit everything. **Critical actions require approval from both admins.** | Critical list → asked in round 2 |
| D-1104 | Audit log covers all admin actions and auth events with actor, timestamp, before/after; filterable in admin; exportable. | |
| D-1105 | **Dual-approval actions** (both admins): publish, revenue-split change, ledger adjustment, refund, recording a payout, product delete/archive, admin user invite/remove/role change. | Generic "approval request" workflow entity |
| D-1106 | Admin-editable content without a developer: landing chapters (copy, media, CTA, featured products), services page, case studies, testimonials, client logos, FAQs, legal pages. | Built-in CMS-lite in admin |
| D-1107 | Admins can create orders/invoices manually for client projects and offline sales using the same order model: customer or client details, offerings or free-form project line items, split, payment record. Same invoice numbering and ledger. | Implements D-510 |
| D-1108 | Customer record actions: notes & tags, suspend/ban, manual grant/revoke of entitlements, send password reset or one-time login link. | |

### Batch 12 — Security (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-1201 | Email accounts must verify via link before purchasing. Phone accounts log in with SMS OTP. Google accounts pre-verified. Password reset by email link. | Resolves F-202. SMS OTP needs an SMS provider (cost) — see R-1201 |
| D-1202 | Admin 2FA: optional TOTP via Google Authenticator per admin. | Admin hosting location → A-1201 |
| D-1203 | Sessions: idle timeout (30 min admin / 60 min customer); one active session per account; new login ends previous session. | Resolves F-204 |
| D-1204 | Abuse protection: per-IP and per-account rate limits on login, OTP, signup, query form, chatbot, downloads; invisible captcha on public forms. | |

### Batch 13 — SEO / Analytics / Performance (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-1301 | Analytics: privacy-friendly lightweight tool (Umami/Plausible class, no cookie banner) + built-in platform event tracking feeding admin widgets. No GA4. | |
| D-1302 | Events from day one: inquiry submitted (all forms/CTAs), product funnel (view, wishlist, checkout start, payment submitted, payment confirmed), signup/login with method, chatbot (started, escalated, lead captured). | |
| D-1303 | Performance target: Core Web Vitals "good" on a mid-range mobile for every public page including the story landing (LCP < 2.5s, INP < 200ms, CLS < 0.1). 3D and heavy animation lazy-loaded. | |
| D-1304 | Browser support: evergreen last 2 major versions — Chrome, Edge, Firefox, Safari desktop and mobile. | |

### Batch 14 — Infrastructure / DevOps (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-1401 | Hosting: deploy free on **Vercel** immediately; founder buys hosting + domain within ~1 week. Platform must stay portable (containerisable, no Vercel-only primitives). | See R-1401 |
| D-1402 | Database/storage: managed **PostgreSQL** + S3-compatible object storage, on free tiers (e.g. Neon/Supabase Postgres free tier; Cloudflare R2 free tier). | Free-tier limits → R-1402 |
| D-1403 | Transactional email service (Resend/Postmark/SES class), free tier. | |
| D-1404 | Environments: dev, staging, production. PR previews; main → staging; tagged release → production; tests in CI on every push. | |

### Batch 15 — Legal / Compliance (answered 2026-09-24)

| ID | Decision | Notes |
|----|----------|-------|
| D-1501 | Not GST-registered at launch. Invoices carry no GST until a GSTIN is entered in admin settings, which switches invoice format to GST breakdown (CGST/SGST/IGST by buyer state) without code changes. | Resolves F-404 |
| D-1502 | Domain not decided. Build with a configurable placeholder; set at launch. Admin app on admin.<domain>. | |
| D-1503 | Retention: chatbot transcripts 12 months; leads, orders, invoices, ledger, audit logs 7 years. | |
| D-1504 | Terms governed by Indian law. No foreign tax collected in V1; prices tax-exclusive; foreign buyers responsible for local taxes. Revisit when gateway payments enable international sales. | Resolves R-105 for V1 |

### Batch 16 — MVP / Roadmap (answered 2026-09-24) — DISCOVERY COMPLETE

| ID | Decision | Notes |
|----|----------|-------|
| D-1601 | Founder declines to rank objectives: "All" remain equal for release 1. | R-101 stays open as accepted risk |
| D-1602 | **Release 1 = all discovered scope except Theme 2.** Core first, but everything covered in discovery ships, including AI chatbot, widget dashboard, project invoicing and expenses. Theme 2 (light editorial) moves to V1.1. Already-deferred items stay deferred: gateways (~1 week after launch), bundles, WhatsApp, automated SaaS provisioning. | R-103 timeline risk accepted by founder |
| D-1603 | Phone OTP: platform built SMS-ready (provider interface + phone-login UI behind a feature flag), disabled at launch; enabled when an SMS provider is configured (~1 week later if needed). Launch login = email + password, Google. | |
| D-1604 | WhatsApp notifications deferred until cost accepted; notification channels are pluggable. | |
| D-1605 | WebGL 3D hero scene ships in **release 1** (with static fallback and reduced-motion/mobile handling). | |
| D-1606 | Build and launch on Vercel free tier now; purchased hosting + domain added and re-tested later. Founder accepts the commercial-use terms risk (R-1401) for the interim. | |
| D-1607 | Testing: all tests planned during development from discovery inputs; unit, integration and end-to-end suites run automatically in CI with no human intervention; founder does one final manual check after full development. | |
| D-1608 | V2 roadmap (after V1.1): external vendor marketplace; employee MIS + SSO; automated payouts + accounting export (Tally/Zoho class); automated SaaS provisioning + license validation API. | |

## C. Unresolved questions (from Spec §20 + discovery)

| ID | Question | Batch | Status |
|----|----------|-------|--------|
| Q-001 | Exact target customer segments | 1 | ANSWERED (D-104), unranked |
| Q-002 | Exact CodeKraft services | 1 | FOLLOW-UP (F-101) |
| Q-003 | Brand positioning | 1 | ANSWERED (D-102) |
| Q-004 | Company/team presentation | 1 | ANSWERED (D-103) |
| Q-005 | Supported countries / geography | 1 (feeds 4, 15) | ANSWERED (D-108); registration country FOLLOW-UP (F-102) |
| Q-006 | Legal relationship between the two partners and CodeKraft (single entity vs separate entities) — affects merchant of record, invoicing, tax, payouts | 1 (feeds 5, 15) | FOLLOW-UP (F-103) |
| Q-007 | Primary business objective ranking (leads vs product sales vs brand) | 1 | ANSWERED (D-106) |
| Q-008 | Success metrics / KPIs | 1 | ANSWERED (D-118) — none |
| Q-009 | Whether external vendors are a realistic future — affects partner/vendor abstraction in the data model | 1 (feeds 3, 5) | ANSWERED (D-114) |
| Q-010 | Content strategy (blog, case studies, etc.) | 1 / 8 | ANSWERED (D-121) |
| Q-011 | Authentication methods, social login, email verification, password reset | 2 | ANSWERED (D-207); verification/reset FOLLOW-UP (F-202) |
| Q-012 | Admin 2FA, exact admin roles/permissions, user roles | 2 / 12 | ANSWERED (D-201, D-202, D-208); peer visibility FOLLOW-UP (F-201) |
| Q-013 | Payment provider, currencies, tax model, invoices, refunds, coupons, subscriptions | 4 | ANSWERED (D-401–D-417) with follow-ups F-401–F-405 |
| Q-014 | SaaS provisioning, source-code delivery, licensing, download security, updates, versioning | 6 | ANSWERED (D-601–D-608) |
| Q-015 | Reviews/ratings, wishlist, comparison, search architecture | 3 | ANSWERED (D-310–D-312) |
| Q-016 | Chatbot intelligence, AI provider, CRM requirements | 7 | ANSWERED (D-701–D-708); AI provider chosen in architecture |
| Q-017 | Email provider, notification channels, analytics provider | 13 / 14 | Analytics ANSWERED (D-1301); channels (D-707, D-1002); email provider → Batch 14 |
| Q-018 | Hosting, DB, storage, CDN, monitoring, logging, backups | 14 | ANSWERED (D-1401–D-1404); monitoring/backups → A-1401 |
| Q-019 | Legal, privacy, accessibility target, browser support | 13 / 15 | ANSWERED (D-807, D-907, D-1304, D-1501–D-1504) |
| Q-020 | UI/animation direction, Theme 1 & 2 direction, brand colors, typography | 9 | ANSWERED (D-901–D-907); palette/fonts proposed in design-system doc |
| Q-021 | Sitemap, implementation phases, MVP boundary, roadmap | 8 / 16 | ANSWERED (D-801–D-808, D-1602, D-1608); phases defined in docs stage |

### Follow-ups from Batch 1

| ID | Follow-up | Ask in |
|----|-----------|--------|
| F-101 | ~~RESOLVED (D-302, D-608)~~ Services list and product+service meaning for the Services page (custom dev, web, mobile, SaaS, design, AI, support…). Also meaning of "product + service" delivery type (1.3c unanswered). | Batch 3/8 |
| F-102 | ~~RESOLVED: India (D-1501, D-1504)~~ Country/state of registration once entity is formed (assumed India from UPI/lakh usage, unconfirmed). | Batch 4 |
| F-103 | ~~RESOLVED (D-401)~~ Who receives customer money before incorporation (individual bank account? whose?). Merchant of record on invoices. Payment providers require KYC of a legal entity or individual. | Batch 4/5 |
| F-104 | Can a product be 100% one partner? Is there a platform/company cut before partner split? (1.7c, 1.7d unanswered) | Batch 5 |
| F-105 | ~~RESOLVED (D-804)~~ Does a product blog get its own URL/page (SEO) or exist only inline on the product page? Are non-product (company) blogs needed? | Batch 8 |
| F-106 | ~~RESOLVED (D-301)~~ "Product" vs "project" used interchangeably. Proposed: product = marketplace item; project = service work / case study. Confirm. | Batch 3 |
| F-201 | ~~RESOLVED (D-512, D-1103)~~ Admin-to-admin visibility (2.2 a/b/c): with both founders as Super Admin, all-see-all is implied. Confirm, and define default scoping for future Admin role (own products / own share / assigned leads only?). | Batch 11 |
| F-202 | ~~RESOLVED (Batch 12)~~ Email verification before purchase? Password reset by email link assumed. Is OTP login phone-only or also email OTP? | Batch 12 |
| F-203 | ~~RESOLVED (Batch 12)~~ Admin 2FA method (authenticator app vs email OTP). Admin app on separate subdomain vs /admin path. | Batch 12 |
| F-204 | ~~RESOLVED (Batch 12)~~ Session: 30/60 min is idle timeout or absolute? Is "one login session" = single concurrent session per account (login elsewhere kicks the old one)? Session revoke UI in settings? | Batch 12 |
| F-205 | ~~RESOLVED (D-1003)~~ Can customers delete their own account (with purchase records retained)? Can admins suspend/ban customers? | Batch 10/11 |
| F-301 | ~~RESOLVED (D-1102)~~ Approval before publish with only two Super Admins: does the *other* partner approve? What if they are unavailable — can a Super Admin self-approve? Future Admin-role products must be approved by a Super Admin? | Batch 11 |
| F-302 | Presentations: PDF inline viewer vs external slide link vs both? "Try live demo" link to hosted sandbox on product pages? | Batch 8 |
| F-303 | OPEN (assumption A-304 stands) Expected catalog size (under 10 / 10–50 / 50+). Assumed small (A-304). | Batch 16 |
| F-304 | ~~RESOLVED (D-417: later)~~ Bundles | — |
| F-401 | ~~RESOLVED (D-501)~~ UPI in V1: via a gateway (Razorpay/Cashfree — auto-confirmed, enables UPI AutoPay for subscriptions) or a static UPI ID/QR with the customer entering a UTR and admin confirming manually (zero integration, fully manual)? | Batch 5 (asked) |
| F-402 | ~~RESOLVED (D-502)~~ except 5th currency name. Currency model reconciliation: proposed = admin sets an explicit price per enabled currency on each offering; customer picks display currency from the enabled list (D-111); customer is charged in that currency where the payment method supports it, else in INR. Name the 5th currency. | Batch 5 (asked) |
| F-403 | ~~RESOLVED (D-503, D-521)~~ Subscriptions: free trial? free products? recurring billing engine vs manual renewal (forced by D-402 in V1)? grace period days? cancel immediate vs end-of-period? proration on tier change? | Batch 5 (asked) |
| F-404 | ~~RESOLVED (D-519, D-1501, D-1504)~~ Tax: GST registered at launch? Prices tax-inclusive vs exclusive? Capture GST number (D-410 says optional field exists — confirm invoice shows it)? Tax on international orders: none in V1? | Batch 5 (asked) |
| F-405 | ~~RESOLVED (D-505)~~ Partial refunds allowed? Refund of subscription = current period only? | Batch 5 (asked) |
| F-406 | ~~RESOLVED (D-520)~~ Custom quote / private offer for a specific customer with negotiated price (pay link): V1 / later / never. 4.5 was answered about license delivery instead. | Batch 5 (asked) |
| F-107 | ~~Superseded by F-402~~ Is the display currency purely visual (converted at live FX) while charging happens in a base currency, or must the customer be charged in the selected currency? | Batch 4 |

## D. Spec review — risks & ambiguities detected (to resolve during discovery)

| ID | Observation | Resolve in |
|----|-------------|-----------|
| R-001 | "Company-owned marketplace" + per-partner revenue shares is ambiguous about legal structure. If partners are separate legal entities, CodeKraft becomes a platform/merchant-of-record with payout obligations (tax, KYC, invoicing). If one entity, "revenue split" is internal bookkeeping only. | Batch 1, 5, 15 |
| R-002 | Example products span SaaS (FitDesk Pro, TradeFlow, MIS Portal) and templates/sites (Resume site, E-commerce site) — implies two very different buyer profiles and delivery flows. | Batch 1, 3, 6 |
| R-003 | Both partners "manage leads and inquiries according to permissions" — permission model between two peers is undefined (who sees whose leads/revenue?). | Batch 2, 11 |
| R-004 | "Partners can publish their own products" + "not multi-vendor" — need to confirm whether a future vendor layer must be designed in now (abstraction cost) or explicitly deferred. | Batch 1, 16 |
| R-005 | Refunds, chargebacks and fees interact with immutable allocations — need explicit reversal-entry rules in ledger. | Batch 5 |
| R-006 | Dual themes + heavy animation + Core Web Vitals + TV-scale responsive is a real performance/scope tension; MVP boundary must decide how much lands in V1. | Batch 9, 13, 16 |
| R-007 | Real-time admin updates + chatbot + lead pipeline implies a CRM-lite; scope creep risk unless bounded. | Batch 7, 11 |
| R-008 | No mention of who owns customer support after purchase (SaaS uptime, source-code questions). Operational gap. | Batch 6, 11 |
| R-101 | All five business objectives ranked equal. A landing page and MVP cannot optimise for everything; an implicit priority will be forced at Batch 16. Founder must rank then. | Batch 16 |
| R-102 | No legal entity exists. Stripe/PayPal/Razorpay onboarding, GST, and international tax all require a registered entity or individual KYC. Blocks payment integration go-live, not design. | Batch 4, 15 |
| R-103 | Timeline of 3–6 days for docs+UI then build+1 day test is extremely aggressive against the stated scope (dual themes, multi-provider payments, ledger, chatbot, widget dashboard, worldwide tax). MVP boundary must be cut hard in Batch 16. | Batch 16 |
| R-104 | Worldwide sales + UPI/netbanking + PayPal/Stripe means at least two payment providers behind one abstraction; bank transfer means a manual "awaiting payment → admin confirms" order state. | Batch 4 |
| R-105 | Worldwide digital-goods sales trigger tax rules (India GST, EU VAT on digital services, US state sales tax). At 1–30 orders/year manual handling is viable but must be a conscious decision. | Batch 4, 15 |
| R-201 | Chatbot behind login removes the anonymous visitor→chatbot→lead funnel the spec assumes. Lead capture from visitors then depends entirely on the query form and CTAs. Founder decision stands; noted for Batch 7. | Batch 7 |
| R-202 | Email-or-phone-only profile is insufficient for worldwide invoicing/tax (needs billing country at minimum; GST number for Indian B2B; Stripe/PayPal need address for 3DS/AVS). Also a phone-only account has no channel for receipts/download links unless SMS/WhatsApp is a delivery channel. Must resolve at Batch 4 checkout design. | Batch 4 |
| R-301 | Self-hosted video upload implies large-file storage, transcoding and streaming cost/complexity. Recommend embed-first with upload as optional; decide in Batch 14. | Batch 14 |
| R-302 | "Terms can differ per client" for licensed products implies negotiated/custom-quote sales outside the fixed catalog price. Needs a custom-offer/quote flow or admin-created private offerings. | Batch 4 |
| R-401 | **V1 is manual-payment only** (UPI + bank transfer, admin-confirmed). Consequences: (1) no automated recurring billing — subscriptions become manual renewal with reminders and expiry; (2) international buyers cannot use UPI and SWIFT transfers are impractical, so V1 is effectively India-first despite "worldwide"; (3) every order needs an admin confirmation step. Founder decision stands; must be explicit in MVP scope. | Batch 5, 16 |
| R-402 | D-403 ("currency set by admin") appeared to contradict D-111 ("user toggles currency"). Reconciled as F-402 pending confirmation. | Batch 5 |
| R-403 | Manual tax config + worldwide + tax-inclusive/exclusive undecided → invoice correctness risk. Small volume mitigates. | Batch 5 |
| R-501 | Project invoicing (D-510) + expense tracking (D-514) + all-partner approval workflows (D-506, D-517) add a mini accounting system to V1. Combined with R-103 timeline this is the largest scope risk so far. | Batch 16 |
| R-502 | "Gateway payments non-refundable" (D-505) may conflict with card-network/consumer rules in some jurisdictions and with the refund policy shown per product (D-415). Legal page wording must match. | Batch 15 |
| R-701 | Admin alerts are in-app only (D-707) while D-706 says overdue follow-ups are emailed. Minor inconsistency: treat follow-up emails as a reminder digest, not event alerts. Confirm at baseline. | Baseline |
| R-801 | Story-chapter landing page (D-801) is the heaviest UX option: full-screen scroll-jacking sections need careful reduced-motion, mobile and Core Web Vitals handling, and two theme variants each. Directly stresses R-103 timeline. Must be scoped precisely in Batch 9 and 16. | Batch 9, 16 |
| R-901 | All four brand personalities selected. They pull in different directions (minimal vs playful vs corporate). Design system will anchor on "premium" and use the others as accents; founder should confirm the resolved direction when the design-system doc is produced. | Docs phase |
| R-1001 | WhatsApp Business API charges per conversation; there is no free automated channel. Only a free "click-to-chat" link exists, which D-808 excluded from the public site. Treat WhatsApp notifications as post-MVP unless founder accepts cost. License keys therefore go by email + in-app, not SMS. | Batch 16 |
| R-1201 | Phone OTP login (D-207, D-1201) requires an SMS provider with per-message cost, which conflicts with the "free channels only" stance in D-1002. Either accept SMS cost for OTP only, or drop phone login from V1. Decide at Batch 16. | Batch 16 |
| R-1401 | Vercel Hobby tier forbids commercial use; a marketplace taking payments needs Vercel Pro (~20 USD/mo) or the purchased hosting. Also "buy a hosting" must be Node-capable (VPS or managed Node host), not shared PHP hosting. | Batch 16 / DevOps doc |
| R-1402 | Free-tier Postgres (auto-suspend, size caps) and R2 (10 GB) are fine for 1–30 orders/year but self-hosted video uploads can exhaust storage quickly. | DevOps doc |
| R-106 | Display-currency toggle needs an FX rate source and rounding rules; charging in that currency depends on provider support. | Batch 4 |

## F. Architecture assumptions (to be validated in docs)

| ID | Assumption | Basis |
|----|-----------|-------|
| A-301 | Product model separates **Product** (catalog/content/SEO) from **Offerings** (1..n purchasable plans per product, each with purchase model, price(s), license type, billing interval, delivery config, enabled payment methods). A single-price product is a product with one offering. | D-304, D-110 |
| A-302 | Proposed full status set: Draft → Pending Approval → Scheduled → Published → Unpublished → Archived; plus "Coming Soon" as a published-but-not-purchasable flag rather than a status. | D-305–D-307, D-314 |
| A-303 | Sort options: newest, price asc/desc, most popular, featured. Site search covers products only in V1. To be confirmed at baseline. | 3.7 b/c unanswered |
| A-304 | Catalog stays under ~50 products in year one → database full-text search is sufficient; no external search engine. | D-107, F-303 |
| A-401 | Coupon V1 feature set (unconfirmed): percentage or fixed amount, expiry date, usage limit, product restriction, first-purchase-only. | D-409, 4.7c unanswered |
| A-402 | Payment layer is a provider-agnostic abstraction from day one; V1 ships only the "manual" provider (UPI/bank with admin confirmation). Gateway providers plug in later without touching order/ledger code. | D-402, D-109 |
| A-501 | V1 subscriptions are manual-renewal: reminder before period end; access continues through a grace period (default 7 days, to confirm) then suspends; cancellation = no renewal (access to period end); no proration in V1. | D-503, R-401 |
| A-502 | Project invoices reuse the same order/invoice/ledger model as product orders (order type = PROJECT) so the finance domain stays single. | D-510 |
| A-601 | Post-purchase instructions are admin-authored rich text per offering, falling back to the product-level text; shown on the order page and in the confirmation email. | Spec §3, not explicitly asked |
| A-602 | Entitlement is a first-class record (customer × offering × order) carrying status, access period, download count, license key, provisioning state, update policy. All delivery types resolve to entitlements. | D-601–D-608 |
| A-801 | Public sitemap: / (story chapters), /services, /products (+ /products/[slug]), /projects (+ /projects/[slug] case studies), /blog (+ /blog/[slug]), /contact, /legal/privacy, /legal/terms, /legal/refunds, /legal/license, /auth/*, /account/*. Admin app separate. | D-801–D-808 |
| A-1102 | Manual entitlement grants/revocations (D-1108) are exempt from dual approval (BR-13 list); mandatory reason, audit row, notification to other admins, no ledger effect. | MASTER_SPEC §7 |
| A-1101 | A single generic **ApprovalRequest** entity (type, payload, requester, required approvers, status) backs every dual-approval action in D-1105, D-506, D-517, D-1102. | D-1105 |
| A-1201 | Admin app served on its own subdomain (admin.<domain>) with separate cookie scope and stricter headers. Founder did not choose; to confirm at baseline. | D-1202 |
| A-1202 | Standard controls assumed without asking: file-upload type/size validation and private storage, CSRF/XSS/SQLi protections, secrets in environment/secret manager, password hashing (argon2/bcrypt), HTTPS everywhere. | Spec §15 |
| A-1301 | SEO baseline assumed from spec §13 without asking: SSR/SSG for all public pages, dynamic metadata, OG/Twitter cards, sitemap.xml, robots.txt, canonical URLs, JSON-LD (Organization, Product, Article, BreadcrumbList), clean slugs, image optimisation. | Spec §13 |
| A-1401 | Monitoring/logging/backups not asked (founder wants short batches): assume host-native logs + free-tier error tracking (Sentry class), uptime ping, daily automated Postgres backups with 7-day retention, weekly off-site copy. Confirm at baseline. | Spec §14 |
| A-1402 | Self-hosted video (D-309) goes to object storage with size caps; no transcoding pipeline in V1 — embed is the primary path. | R-301 |
| A-1501 | Cookie consent: with privacy-friendly analytics and only strictly-necessary cookies (session, theme, currency), no consent banner is required; a cookie notice line in the privacy policy suffices. | D-1301 |
| A-201 | Single `users` table with role assignments (RBAC); employees/partners/customers are the same identity type with different roles, so a future MIS/SSO can attach without schema change. | D-114, D-210 |

## E. Explicitly rejected features

| ID | Rejected | Source |
|----|----------|--------|
| X-001 | Guest checkout | D-204 |
| X-002 | Anonymous chatbot usage | D-205 |
| X-003 | Customer 2FA | D-208 |
| X-004 | Multi-user customer accounts / team seats (V1) | D-206 |
| X-005 | Team/founder showcase on site (launch) | D-103 |
| X-006 | Product comparison | 3.8b "never" |
| X-007 | Public buyer reviews/ratings | D-312 |
| X-008 | Related-products section on product page | 3.10d |
| X-009 | Company-level (non-product) blogs | D-804 |
| X-010 | Per-service detail pages | D-806 |
| X-011 | Public email / phone / WhatsApp / social links on site | D-808 |
| X-012 | Email, WhatsApp/SMS, browser-push admin alerts (V1) | D-707 |
| X-013 | Live-chat widget with real-time admin presence | D-702 |

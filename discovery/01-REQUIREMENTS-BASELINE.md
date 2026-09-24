# CODEKRAFT REQUIREMENTS BASELINE

**Status:** APPROVED by founder on 2026-09-24
**Date:** 2026-09-24
**Sources:** `CODECRAFT_INITIAL_SPEC.md` + 16 discovery batches. Every statement below traces to a decision ID in `discovery/00-DECISION-LOG.md` (D-xxx), an assumption (A-xxx), a risk (R-xxx) or a rejection (X-xxx).
**Naming:** The brand is **CodeKraft**. "CodeCraft" in the initial spec is superseded (D-101).

---

## 1. Product Summary

CodeKraft is a company-owned software studio website and digital-product marketplace run by two founders (CEO, CFO). One platform does four jobs:

1. Presents CodeKraft as a premium studio that builds software, websites and products for clients, and converts visitors into project leads.
2. Lists CodeKraft's own pre-built products for purchase, with per-product pricing, delivery and payment configuration.
3. Gives customers an account with purchases, access, downloads, invoices, queries and a chatbot.
4. Gives the founders a separate admin application covering catalog, orders, manual payment confirmation, leads, queries, content, a partner revenue ledger with immutable splits, project invoicing, expenses, approvals and audit.

Not a multi-vendor marketplace. Designed so more partners and employees can be added later with few changes (D-002, D-114).

---

## 2. Business Rules

| ID | Rule | Source |
|----|------|--------|
| BR-01 | Services are sold by inquiry only; no service pricing on the site. | D-105 |
| BR-02 | Buyers never see which partner owns a product. | D-116 |
| BR-03 | Login is required to purchase and to use the chatbot. Visitors may submit the query/inquiry form. | D-204, D-205 |
| BR-04 | One login per customer account; no team seats. | D-206 |
| BR-05 | A product's revenue split, and any change to it, takes effect only after approval by all partners, and applies to sales after approval. Historical allocations are immutable. | D-506, D-509, D-006 |
| BR-06 | Distributable amount = gross − discount − tax − gateway charges − bank shortfall. Company cut (may be 0) is taken first, remainder split by product percentages that total 100%. | D-507, D-508, D-516 |
| BR-07 | A product may be 100% owned by one partner. | D-508 |
| BR-08 | Tax is charged only on products where the admin enabled tax; prices are tax-exclusive; no GST until a GSTIN is configured; no foreign tax collected. | D-504, D-519, D-1501, D-1504 |
| BR-09 | Refunds are never self-service. Customer emails admin; admin decides. Only UPI/manual payments are refundable. Refund revokes access and issues a credit note. | D-505, D-415, D-414 |
| BR-10 | Unpaid orders expire after 7 days. A one-time product cannot be bought twice by the same customer. | D-412, D-413 |
| BR-11 | A product can be deleted only if it has zero orders; otherwise it is archived. | D-308 |
| BR-12 | Publish requires approval by an admin other than the submitter. | D-1102 |
| BR-13 | Dual approval (all admins) is required for: publish, split change, ledger adjustment, refund, payout record, product delete/archive, admin user changes. | D-1105 |
| BR-14 | Subscriptions in release 1 renew manually: reminder before period end, 7-day grace, then suspend; cancel = no renewal, access to period end; no proration. | D-521 |
| BR-15 | Every download uses a short-lived signed link tied to the buyer, is logged, and counts against an admin-set cap per purchase. | D-606 |
| BR-16 | Invoices are numbered sequentially per Indian financial year (e.g. CK/2026-27/0001) in the name "CodeKraft". | D-414, D-401 |
| BR-17 | Ledger entries are immutable; corrections are adjusting entries requiring dual approval. | D-517 |
| BR-18 | Personal data on account deletion is anonymised; orders, invoices, ledger and audit records are retained 7 years. Chat transcripts retained 12 months. | D-1003, D-1503 |

---

## 3. User Roles

| Role | Who | Access |
|------|-----|--------|
| Visitor | Anyone | Public site, catalog, query/inquiry form, theme toggle |
| Customer | Registered user | Everything a Visitor has + purchase, dashboard, chatbot, wishlist, currency setting |
| Admin | Future partners | Admin app scoped to own products, own revenue share, assigned leads (default) |
| Super Admin | Both founders | Full admin app: everything, subject to dual-approval rules |
| Staff (future) | Employees | Defined in RBAC, not seeded at launch |

Sources: D-201, D-202, D-512, D-1103.

## 4. Permission Model

- RBAC on a single identity table; roles are assignments, not account types (A-201).
- Super Admins see and edit all products, orders, leads, customers, content, settings and the full ledger (D-1103, D-512).
- Admin role default scope: own products, own share, assigned leads (D-512).
- Critical actions create an **ApprovalRequest** that all required approvers must accept before the change applies (A-1101, BR-13).
- Every admin action and auth event is written to an audit log with actor, timestamp, before/after (D-1104).

---

## 5. Product Model

**Product** (catalog entity, admin-created, never hardcoded — D-018):
- Identity: name, slug, short/full description, category (2-level tree), tags, status, version + public changelog (D-303, D-313).
- Content: features, benefits, target audience, use cases, industry, tech stack, requirements, FAQs, curated testimonials (D-312).
- Media: images, screenshots, gallery, demo video (embed or upload), presentation PDF (inline viewer), optional live-demo link, attachments (D-309, D-805).
- Flags: featured, unlisted (direct link only), coming soon (no buy button), refundable, tax-enabled (D-314, D-415, D-504).
- Optional blog: one rich-text article with its own `/blog/slug` URL, embedded at bottom of product page, teased on landing and blog index (D-121, D-804).
- SEO: title, meta description, OG image, canonical, JSON-LD (spec §9).
- Ownership: company cut %, partner split % (effective-dated, dual-approved) (D-508, D-509).
- Status lifecycle: Draft → Pending Approval → Scheduled → Published → Unpublished → Archived (A-302).

**Offering** (1..n per product — A-301): purchase model (one-time / subscription / custom quote), price per enabled currency, license type, billing interval (monthly/quarterly/annual), trial (if enabled), discount price, enabled payment methods, delivery configuration, access period (lifetime / months), update policy, download cap, post-purchase instructions, service checklist steps (D-304, D-404, D-405, D-110, D-601–D-608).

**Entitlement** (customer × offering × order — A-602): status, access period, download count, license key, provisioning state, update policy.

---

## 6. Commerce Model

- **Currencies:** INR (base), USD, EUR, GBP, CAD. Admin sets base currency; users pick display currency; conversion via exchange-rate API; charged in base in release 1 (D-502, D-518).
- **Payment methods (release 1):** static UPI QR and bank transfer, both manually confirmed by admin against a customer-submitted transaction reference. Payment layer is provider-agnostic; Razorpay (then Stripe, PayPal) plug in ~1 week post-launch (D-402, D-501, A-402).
- **Checkout data:** name, email, country (required); company, billing address, GST number optional (D-410).
- **Order statuses:** Pending Payment, Paid, Fulfilled, Failed, Cancelled, Refunded, Partially Refunded (D-411).
- **Discounts:** product-level sale price shown with strike-through; coupon codes in V1 (percentage/fixed, expiry, usage limit, product restriction, first-purchase-only — A-401).
- **Custom quotes:** admin creates a private offer for a specific customer with negotiated price and pay link (D-520).
- **Manual orders:** admin creates orders/invoices for client projects and offline sales in the same order model (D-1107, D-510).
- **Invoices:** PDF per paid order, emailed + downloadable; credit notes on refund (D-414).
- **Chargeback:** revoke access, flag customer. Failed payment: retry from order page (D-416).
- **Bundles:** later (D-417).

## 7. Revenue Model

- Single CodeKraft bank account receives all money (D-511).
- Per order item the ledger records: gross, discount, tax, gateway fee, bank shortfall, company cut, and one allocation line per partner — all in transaction currency plus INR equivalent at payment-date rate (D-507, D-515, D-516).
- Refunds create proportional reversal entries (5.5a confirmed).
- Payouts are manual bank transfers recorded in the ledger (date, amount, reference), on demand, dual-approved; running balance per partner (D-511, D-1105).
- Expenses can be recorded against products to compute profit (D-514).
- Reports: revenue by product / partner / period, tax collected, refunds, outstanding payouts; partner statements as PDF and CSV (D-513).
- Project (services) revenue flows through the same ledger via manual orders (A-502).

## 8. Delivery Model

| Delivery type | Release 1 behaviour | Source |
|---------------|--------------------|--------|
| SaaS / hosted | Admin provisions account by hand and emails credentials; automated adapter slot for later | D-601 |
| Downloadable (source, project) | Private storage, signed links from dashboard, logged, capped | D-602, D-606 |
| License | Admin enters key per order; shown in dashboard, emailed | D-603, D-406 |
| Product + service | Admin-defined checklist per product; customer sees progress; Fulfilled when complete | D-608 |
| Custom | Admin-authored instructions + manual fulfilment | A-601 |

Common: access period per product (lifetime / fixed months); update policy per product; revocation automatic for platform assets, admin task for external accounts (D-604, D-605, D-607).

---

## 9. User Journeys (release 1)

1. **Discover:** land on story-chapter home (Who we are → What we build → What we sell → Proof → Talk to us), dual CTA "Start a project" / "Explore products" (D-801, D-802).
2. **Inquire:** visitor submits inquiry form (or product-page "Request customisation") → lead created (D-315, D-808).
3. **Register:** email + password (verify link) or Google; phone OTP behind feature flag (D-1201, D-1603).
4. **Buy:** pick offering → checkout details → choose enabled method → pay via UPI QR or bank details → submit reference → order Pending Payment → admin confirms → Paid → delivery per type → Fulfilled (D-501, D-411).
5. **Use:** dashboard shows purchases, downloads, keys, subscription status, service progress, invoices, payment history, queries, wishlist, notifications, settings (currency, theme, security) (D-1001).
6. **Renew:** reminder → pay renewal from dashboard → admin confirms; cancel from dashboard (D-1004, D-521).
7. **Get help:** chatbot (menus + AI on site content) → escalate to query → admin replies in thread → email + in-app notification (D-701, D-702, D-1002).
8. **Leave:** self-delete with records retained (D-1003).

## 10. Admin Journeys (release 1)

1. **Login:** admin subdomain, optional TOTP, 30-min idle, single session (D-1202, D-1203, A-1201).
2. **Dashboard:** widget library (sales, operations queue, leads, traffic, catalog, customers, system) arranged per admin (D-120, D-1101).
3. **Catalog:** create product → offerings → media → delivery → split → submit → other admin approves → schedule/publish (D-1102, A-302).
4. **Orders:** confirm UPI/bank payments, record received amount and shortfall, fulfil, enter license keys, tick service steps, revoke (D-516, D-603, D-608, D-607).
5. **Leads & queries:** shared pool, claim/assign, pipeline New→Contacted→Qualified→Proposal→Won/Lost, notes, follow-up dates, reply in thread (D-703–D-706).
6. **Finance:** ledger, partner balances, record payouts, expenses, adjustments, reports, statements (D-511–D-517).
7. **Manual orders:** project invoices and offline sales (D-1107).
8. **Content:** landing chapters, services, case studies, testimonials, logos, FAQs, legal pages, product blogs (D-1106, D-121).
9. **Customers:** notes/tags, suspend, manual grant/revoke, send reset link (D-1108).
10. **Settings:** base currency, tax rate, GSTIN, payment methods, theme default, AI limits, notification channels, retention (D-502, D-504, D-1501, D-905, D-708).
11. **Approvals inbox + audit log** (A-1101, D-1104).

## 11. Chatbot / Lead Model

- Hybrid bot: quick-reply menus (order status, downloads, contact) + AI grounded only on site content; login required (D-701, D-205).
- Limits: platform-wide daily message cap and per-user daily cap; fallback to menus (D-708).
- Escalation creates a query; admin replies in-thread (D-702).
- Lead sources: inquiry form, product CTA, chatbot, manual (D-704). Pipeline per D-703. Assignment from shared pool (D-705). Follow-up dates with overdue highlighting (D-706).
- Admin alerts in-app only, persisted inbox (D-707). Transcripts retained 12 months (D-1503).
- AI provider is selected in the architecture document per spec §12 (not decided in discovery).

---

## 12. Non-Functional Requirements

| Area | Requirement | Source |
|------|-------------|--------|
| Responsive | Mobile → tablet → laptop → desktop → large → TV where practical, deliberately designed | D-012 |
| Themes | Theme 1 Dark cinematic at launch; Theme 2 Light editorial in V1.1; admin default + user toggle; logic/components separated from design tokens | D-902, D-903, D-905, D-011 |
| Motion | Scroll-driven 2D animation; one lazy-loaded WebGL hero with static fallback; reduced-motion honored; mobile simplified, no 3D | D-904, D-907, D-1605 |
| Accessibility | WCAG 2.1 AA | D-907 |
| Browsers | Evergreen last 2 versions incl. mobile Safari | D-1304 |
| Real-time | Admin in-app notifications and queues update live | D-015, D-707 |
| Portability | Runs on Vercel now; containerisable for purchased hosting later | D-1401 |
| Scale | Designed for 1–30 orders/year, <50 products; DB full-text search sufficient | D-107, A-304 |

## 13. Security Requirements

- Email verification before purchase; Google pre-verified; password reset by email link; phone OTP feature-flagged (D-1201, D-1603).
- Optional TOTP 2FA for admins; admin app on separate subdomain (D-1202, A-1201).
- Idle timeouts 30/60 min; single active session (D-1203).
- Rate limits on login, OTP, signup, forms, chatbot, downloads; invisible captcha on public forms (D-1204).
- Signed, expiring download URLs; private object storage; upload validation (D-606, A-1202).
- RBAC + dual approval for critical actions; full audit log (D-1103, D-1105, D-1104).
- Standard web protections (CSRF, XSS, injection), secrets management, hashed passwords, HTTPS (A-1202).

## 14. SEO Requirements

SSR/SSG for all public pages; dynamic metadata; OG/Twitter cards; sitemap.xml; robots.txt; canonicals; JSON-LD (Organization, Product, Article, BreadcrumbList); clean slugs; own URLs for products, case studies and blogs; image optimisation (A-1301, D-803, D-804).

## 15. Performance Requirements

Core Web Vitals "good" on mid-range mobile for every public page including the story landing: LCP < 2.5 s, INP < 200 ms, CLS < 0.1. Code splitting, lazy media, optimised fonts, CDN (D-1303, spec §14).

## 16. Legal Requirements

Privacy policy, Terms of service, Refund & cancellation policy, Product license terms (D-807). Indian governing law; no foreign tax collected; tax-exclusive prices (D-1504). No cookie banner needed with privacy-friendly analytics (A-1501). Retention per BR-18. GST invoice format activates when GSTIN is set (D-1501).

---

## 17. Scope

### Release 1 (launch) — D-1602
Everything in sections 2–16 **except** the items listed under V1.1 and V2. Includes: story landing with 3D hero, Theme 1, full catalog and product pages with blogs, case studies, services page, inquiry forms, auth (email/Google), checkout with manual UPI/bank confirmation, coupons, custom quotes, delivery for all types (manual provisioning), invoices and credit notes, ledger with splits/company cut/expenses/payouts/reports, project invoicing via manual orders, dual-approval workflows, audit log, widget dashboard, leads/queries pipeline, hybrid AI chatbot with limits, customer dashboard, wishlist, admin content editing, privacy-friendly + built-in analytics, automated CI test suites.

### V1.1 (weeks after launch)
Theme 2 Light editorial (D-1602); Razorpay then Stripe/PayPal via the payment abstraction (D-501); phone OTP once SMS provider is budgeted (D-1603); WhatsApp channel if cost accepted (D-1604); purchased hosting + domain migration (D-1606); bundles (D-417).

### V2 — D-1608
External vendor marketplace; employee MIS + SSO; automated payouts and accounting export; automated SaaS provisioning and license validation API. Also: tier upgrade proration, automated recurring billing, foreign tax collection, self-hosted video transcoding.

---

## 18. Open Risks (accepted or unresolved)

| ID | Risk | Status |
|----|------|--------|
| R-103 / R-501 / R-801 | Release-1 scope (full commerce + ledger + project invoicing + AI bot + widget dashboard + cinematic landing + 3D) versus a 3–6 day docs+build window. | **Accepted by founder** (D-1602, D-1605). Implementation plan will sequence for earliest usable increments. |
| R-101 | No objective ranking; landing and MVP cannot optimise for everything. | Accepted (D-1601) |
| R-401 | Release 1 is manual-payment only: India-first in practice, admin in the loop on every order, manual subscription renewal. | Accepted (D-402, D-501) |
| R-102 | No legal entity yet; gateway KYC and GST depend on it. | Open, outside platform |
| R-1401 | Vercel free tier disallows commercial use. | Accepted for interim (D-1606) |
| R-502 | "Gateway payments non-refundable" may conflict with card-network rules abroad. | Open until gateways ship; legal pages must state it |
| R-901 | Four brand personalities selected. | Resolved in design-system doc as premium-first |
| R-701 | Overdue-follow-up emails vs in-app-only admin alerts. | Treat as a reminder digest; confirm here |
| R-1402 | Free-tier storage limits vs self-hosted video. | Embed-first (A-1402) |

## 19. Assumptions (confirm by approving this baseline)

A-201 single identity table with RBAC · A-301 Product/Offering split · A-302 status lifecycle · A-303 sort options and products-only search · A-304 catalog < 50 · A-401 coupon feature set · A-402 provider-agnostic payment layer with manual provider first · A-501 manual renewal rules · A-502 project revenue via manual orders · A-601 per-offering instructions · A-602 Entitlement entity · A-801 sitemap · A-1101 ApprovalRequest entity · A-1201 admin subdomain · A-1202 standard security controls · A-1301 SEO baseline · A-1401 monitoring/backups (host logs, Sentry-class errors, uptime ping, daily DB backups, 7-day retention) · A-1402 embed-first video · A-1501 no cookie banner.

## 20. Explicitly Rejected Features

Guest checkout · anonymous chatbot · customer 2FA · team seats · founder/team showcase · product comparison · public reviews/ratings · related-products section · company-level blogs · per-service detail pages · public email/phone/WhatsApp/social links · email/SMS/push admin alerts · live-chat widget · GA4 · Theme 2 dark variant (X-001–X-013, D-1301, D-903).

---

## 21. Post-approval amendments (2026-09-25)

Resolutions made during document generation that refine, but do not reverse, approved decisions. Full list in `MASTER_SPEC.md` §7.

| Amends | Amendment |
|--------|-----------|
| §17 V1.1, D-1606 | The **domain** must be purchased and verified before release 1 (transactional email requires a verified sending domain). Purchased **hosting** remains V1.1. |
| §3 Visitor "theme toggle" | The toggle is hidden until the Theme 2 flag is on (V1.1). Theme 2 token CSS still ships in release 1. |
| D-411 / BR-10 | Unpaid orders become `failed` at expiry; `cancelled` is reserved for explicit cancellation. |
| BR-13 / D-1108 | Manual entitlement grants are exempt from dual approval; they require a reason, notify other admins, and never touch the ledger (A-1102). |
| BR-13 | Removing the last active Super Admin is rejected; dropping below two admin-class users is allowed with a warning. |
| §18 risks | Added: Turnstile outage fails public forms closed (lead capture pauses) — accepted residual risk. |
| D-505 | Refund requests are raised from the order page as a query (no public email exists). |
| D-406 / D-603 | License keys are revealed in the dashboard; email carries a link only. |
| BR-08 / D-1501 | `tax_enabled` has effect only once a GSTIN is configured. |
| D-510 | Project orders carry a dual-approved `split_snapshot` (`project_order.split`). |
| §8 delivery table | Access period, update policy and download cap are configured **per offering** (`offerings.delivery_config`), not per product; a single-offering product behaves identically. |
| §18 R-801 | "Scroll-jacking" reworded: story chapters use pinned sections with spacing at ≥ 1024 px and stacked sections below; no scroll hijacking or snap. |

**Baseline approved by founder on 2026-09-24; amendments above are orchestrator resolutions the founder may override.**

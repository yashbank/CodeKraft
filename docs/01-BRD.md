# 01 — BUSINESS REQUIREMENTS DOCUMENT (BRD)

**Product:** CodeKraft · **Version:** 1.0 · **Date:** 2026-09-24 · **Status:** Draft for founder review
**Implements:** `discovery/01-REQUIREMENTS-BASELINE.md` (approved), `discovery/00-DECISION-LOG.md`, `MASTER_SPEC.md` §1–§7.
**Feeds:** `docs/02-PRD.md`, `docs/03-SRS.md`, `docs/13-ROADMAP.md`.
**Terminology:** canonical terms per `MASTER_SPEC.md` §3. The brand is **CodeKraft**; "CodeCraft" in the initial spec is superseded (D-101). Money in this document is always integer minor units (paise, cents) with a currency code (MASTER_SPEC §4.8).

---

## 1. Executive summary

CodeKraft is a two-founder software studio that (a) builds custom software, websites and products for clients and (b) sells its own pre-built digital products. Today it has neither a website nor a sales channel, and no legal entity (D-112). It needs one platform that does four jobs at once (baseline §1):

| # | Job | Business outcome | Primary decisions |
|---|-----|------------------|-------------------|
| 1 | Present CodeKraft as a premium studio | Brand credibility, project leads | D-102, D-801, D-901 |
| 2 | Sell CodeKraft's own products worldwide | Product and subscription revenue | D-001, D-108, D-304 |
| 3 | Give customers an account with access, downloads, invoices and support | Retention, low support load | D-017, D-1001 |
| 4 | Give the founders an admin app with catalog, orders, leads, content and a partner ledger | Operational control, fair revenue split between partners | D-016, D-007, D-511 |

Release 1 ships everything discovered except Theme 2 (D-1602), with payments taken manually by UPI QR and bank transfer and confirmed by an admin (D-402, D-501). Card, netbanking and PayPal payments follow within roughly a week of launch through a provider abstraction (A-402). Expected year-1 volume is 1–30 orders and ₹10–20 lakh revenue (D-107), which makes admin-in-the-loop operations acceptable in release 1 (R-401).

## 2. Business context

### 2.1 The company

| Fact | Detail | Source |
|------|--------|--------|
| Founders | Two: CEO and CFO. Both are **Super Admins** and **Partners** in the platform. | D-112, D-202, D-003 |
| Legal entity | None yet; to be formed later. Invoices are issued in the name "CodeKraft" (the bank-account holder). | D-112, D-401, R-102 |
| Registration country (assumed) | India — Indian governing law, GST once a GSTIN exists, INR reporting base. | D-1501, D-1504, D-515 |
| Market | Worldwide, but release 1 is India-first in practice because only UPI and bank transfer are accepted. | D-108, R-401 |
| Growth plan | 1–3 more leadership partners and employees within 1–2 years; onboarding them must need "few changes". | D-114 |
| Future integrations | Internal employee MIS + SSO (V2); must not be blocked by today's design. | D-115, D-210, D-1608 |
| Brand presentation | Company-brand only. No founder or team names, photos or founding story at launch. | D-103, D-117 |
| Credibility assets | Case studies, client logos, testimonials and portfolio exist as raw data; content must be produced. | D-117 |
| KPIs | None defined by the founders. | D-118 |

### 2.2 Why one platform, not three

The founders want brand, lead generation, product sales, subscriptions and the partner ecosystem to advance together (D-106). Splitting the studio site, the store and the admin app across separate tools would fragment leads, customers and revenue records. A single platform with a shared identity table (A-201), a single order model for product and project revenue (A-502) and one ledger (D-007) keeps every rupee and every lead in one place from day one.

### 2.3 Not a multi-vendor marketplace

Products are company-owned. Partners are internal admins with a revenue share, never external sellers (D-002). Buyers never learn which partner owns a product (BR-02). The data model anticipates external vendors only as a V2 possibility (D-1608, R-004).

## 3. Business objectives

All five objectives carry **equal priority** by founder decision (D-106, D-1601). The accepted consequence is that neither the landing page nor the release-1 scope optimises for any one of them (R-101).

| ID | Objective | What the platform does for it | Release |
|----|-----------|-------------------------------|---------|
| OBJ-1 | Generate project leads | Story-chapter landing with "Start a project" CTA, services page, inquiry forms, product-page "Request customisation", chatbot lead capture, admin pipeline | R1 (D-801, D-802, D-315, D-703) |
| OBJ-2 | Sell products | Public catalog, per-product offerings, login-gated checkout, manual payment confirmation, all five delivery types | R1 (D-304, D-402, D-601–D-608) |
| OBJ-3 | Build brand credibility | Premium dual-theme design, cinematic 3D hero, case studies, testimonials, client logos, SEO | R1 Theme 1 (D-901, D-1605, D-803); V1.1 Theme 2 |
| OBJ-4 | Earn recurring subscription revenue | Subscription offerings with manual renewal, reminders, grace and suspension | R1 manual (BR-14); V2 automated billing |
| OBJ-5 | Run a fair partner ecosystem | Per-product ownership, effective-dated dual-approved splits, immutable allocations, running partner balances, payouts, statements | R1 (BR-05–BR-07, D-511–D-513) |

## 4. Stakeholders

| Stakeholder | Role in platform | Interest | Involvement |
|-------------|------------------|----------|-------------|
| Founder — CEO | Super Admin, Partner | Leads, brand, catalog, approvals | Approves baseline, does the final manual check (D-1607) |
| Founder — CFO | Super Admin, Partner | Ledger, payouts, invoices, tax, expenses, reports | Approves finance-critical actions (BR-13) |
| Future partners | Admin (scoped) | Own products, own share, assigned leads | Onboarded post-launch via admin user change approval (D-512, D-1105) |
| Future employees | Staff (RBAC-defined, not seeded) | Operational tasks | V2 with MIS/SSO (D-201, D-1608) |
| Customers | Customer | Buy, access, download, renew, get support | Self-serve via account (D-1001) |
| Prospective clients | Visitor → Lead | Learn services, submit inquiry | Inquiry form only; no public contact details (D-808) |
| AI implementation agents | — | Unambiguous specs and IDs | Consume this doc set (D-021, D-022) |
| Providers | — | Neon, R2, Resend, Umami, Turnstile, Sentry, Anthropic, open.er-api | Free tiers (D-1402, D-1403; docs/04 §4) |

## 5. Target segments

Unranked and non-vertical by founder decision (D-104). The catalog seeds (FitDesk Pro, TradeFlow, MIS Portal, Resume/Portfolio Website, E-commerce Website — docs/05 §14) span two very different buyer profiles (R-002), which is why delivery and pricing are configured per offering rather than per platform.

| Segment | Likely need | Platform touchpoint |
|---------|-------------|---------------------|
| Startups / founders | MVP build, SaaS products | Services inquiry; SaaS offerings |
| SMBs | Business tools, websites | Website/template downloads; product + service checklist |
| Mid-market / enterprise | Custom builds, hosted MIS, licenses | Project inquiry; custom quotes (D-520); manual project invoices (D-1107) |
| Individual professionals | Portfolio sites, templates | One-time downloads |
| Agencies / resellers | Licensed products, negotiated terms | License offerings; custom quotes; per-client terms (R-302) |

## 6. Services offered

Services are sold by inquiry only; no service pricing appears on the site (BR-01, D-105). The list is admin-editable (D-302) and rendered as one page with one section per service, no per-service detail pages (D-806, X-010).

| # | Service | Typical lead source |
|---|---------|---------------------|
| 1 | Custom web applications | "Start a project" (D-802) |
| 2 | Mobile apps | Inquiry form |
| 3 | SaaS product development | Inquiry form |
| 4 | Website development | Inquiry form, product CTA |
| 5 | UI/UX design | Inquiry form |
| 6 | AI integration | Inquiry form, chatbot |
| 7 | Maintenance & support | Product CTA "Request customisation" (D-315) |
| 8 | Consulting | Inquiry form |

Project (services) revenue is tracked on the platform from release 1 through manual project orders and invoices (D-510, A-502).

## 7. Business model and money flow

### 7.1 Revenue streams

| Stream | Mechanism | Release |
|--------|-----------|---------|
| One-time product sales | Offering with `one_time` purchase model; lifetime or fixed-month access | R1 (D-404, D-605) |
| Subscriptions | Monthly / quarterly / annual offerings; manual renewal | R1 (D-405, BR-14) |
| Custom quotes | Admin-created private offer with negotiated price and pay link | R1 (D-520) |
| Client projects | Admin-created manual order of type PROJECT with free-form line items and invoice | R1 (D-1107, D-510) |
| Offline sales | Same manual order path | R1 (D-1107) |
| Bundles | Deferred | V1.1 (D-417) |

### 7.2 Money flow (release 1)

1. Customer picks one offering and checks out ("Buy now", MASTER_SPEC §7); the order is created in the platform base currency (INR) in `pending_payment` (D-502, D-411).
2. Customer pays by static UPI QR or bank transfer into the **single CodeKraft bank account** and submits the transaction reference (D-501, D-511).
3. An admin confirms the payment, recording the amount actually received; any shortfall versus the invoice is a bank-charge expense on that order (D-516).
4. On `paid`, the ledger posts per order item: gross, discount, tax, gateway fee (0 for manual), bank shortfall, company cut and one allocation per partner from the ownership version in force at payment time (D-507, D-515, BR-05). Allocations are immutable (D-006).
5. The invoice PDF is issued (CK/2026-27/0001 numbering) and emailed (BR-16, D-414).
6. Partners are paid by manual bank transfer, on demand, recorded in the ledger after dual approval; the ledger shows a running balance per partner (D-511, D-1105).

### 7.3 Split formula (BR-06) — worked example in paise

| Line | Formula | Example (INR) |
|------|---------|---------------|
| Gross | offering price × qty | 1 000 000 (₹10,000.00) |
| − Discount | coupon or sale price | −100 000 |
| − Tax | only if product tax-enabled and GSTIN set | 0 (no GSTIN at launch, D-1501) |
| − Gateway charges | 0 for manual provider | 0 |
| − Bank shortfall | invoice − received (D-516) | −2 500 |
| = Distributable | | 897 500 |
| − Company cut (e.g. 10 % = 1000 bps) | taken first, may be 0 (D-508) | −89 750 |
| = Partner pool | | 807 750 |
| Partner A 70 % | 7000 bps | 565 425 |
| Partner B 30 % | 3000 bps | 242 325 |

Rounding: allocations use largest-remainder rounding in minor units so the partner lines sum exactly to the distributable amount (MASTER_SPEC §7 "Split rounding"; formula in `docs/03-SRS.md` FR-FIN-02). If the customer pays more than the amount due, the excess is recorded as `customer_credit_minor` on the payment and is never allocated (MASTER_SPEC §7 "Overpayment"). Every entry also stores the INR equivalent at the payment-date FX rate (D-515). A product may be 100 % one partner (BR-07). Expenses recorded against a product reduce the partner pool by the same split unless marked company-only (D-514, docs/04 §7.2).

### 7.4 Refunds and chargebacks

Refunds are never self-service; the customer clicks "Request refund" on the order page, which opens a query thread (source `order`) — the site publishes no email address (D-808), although the contact details on the invoice remain usable (MASTER_SPEC §7 "Refund request channel") — an admin decides, only manual (UPI/bank) payments are refundable, and refundability is per product (BR-09, D-415, D-505). A refund revokes access, issues a credit note and posts proportional reversal entries (baseline §7). Chargebacks (gateway era) revoke access and flag the customer (D-416). The "gateway payments are non-refundable" rule is a legal-wording risk abroad (R-502).

### 7.5 Tax

Prices are tax-exclusive. Tax is charged only on tax-enabled products, at the admin-configured rate, and only once a GSTIN is entered, which switches the invoice to a CGST/SGST/IGST breakdown without code changes (BR-08, D-519, D-1501). No foreign tax is collected in release 1 (D-1504).

## 8. Release-1 operating model (admin in the loop)

Because release 1 takes payments manually (R-401), the founders are part of every order. The table fixes who does what so the platform's queues, notifications and widgets are built around real duties rather than abstract roles.

| Business process | Trigger | Founder action (default owner) | Platform support | Target turnaround (proposed) |
|------------------|---------|--------------------------------|------------------|------------------------------|
| Order-to-cash | Customer submits UPI/bank reference | CFO checks bank statement, confirms with amount received or marks failed | "Payments awaiting confirmation" widget, in-app alert, one-screen confirm with shortfall calc (D-516) | 24 h |
| Delivery — SaaS/hosted | Order becomes Paid | CEO creates account by hand, records credentials/notes | Provisioning task queue, customer email on done (D-601) | 48 h |
| Delivery — license | Order becomes Paid | CEO enters key | Key entry on order, masked display with reveal in the dashboard; email and in-app notification carry a dashboard link, never the key (D-603, MASTER_SPEC §7 "License key delivery") | 48 h |
| Delivery — product + service | Order becomes Paid | CEO works checklist steps | Checklist per order, customer progress view (D-608) | Per offering |
| Delivery — download / custom | Order becomes Paid | None / mark done | Automatic entitlement; instructions shown (A-601) | Immediate |
| Publish a product | Either founder submits | The other founder reviews and approves | Approvals inbox, payload diff (D-1102) | 48 h |
| Change a split | Either founder proposes | Every other active admin approves (requester excluded) | `ownership.change` request, effective-dated (BR-05) | 48 h |
| Lead handling | Inquiry, CTA, chatbot | Whoever claims from the pool; CEO by default | Shared pool, pipeline, follow-up dates, overdue digest (D-703–D-706) | First contact 48 h |
| Customer support | Query or escalation | Whoever claims | Thread reply, email + in-app to customer (D-702) | 24 h |
| Subscription renewal | Reminder → customer pays | CFO confirms renewal payment | Same confirm screen; period rolls forward (D-521) | 24 h |
| Refund | Customer requests from the order page (query, source `order`) | CFO proposes, CEO approves | `refund.issue` request, credit note, revocation (BR-09, MASTER_SPEC §7) | 7 days |
| Partner payout | On demand | CFO transfers by bank, records payout; CEO approves | `payout.record` request (rejected if larger than the partner's balance), running balances, statements (D-511, D-513) | Monthly (proposed) |
| Project invoice | Client engagement milestone | CEO or CFO creates manual PROJECT order; the other founder approves the line splits | Free-form lines each carrying a `split_snapshot`, `project_order.split` approval before invoicing/payment, same invoice numbering and ledger (D-1107, MASTER_SPEC §7) | Same day + approval |
| Expense entry | Cost incurred | CFO records against product | Expense form, profit report (D-514) | Weekly |
| Content update | Marketing need | CEO edits in admin | CMS-lite, revalidation (D-1106) | Self-serve |
| AI/system health | Cap hit, cron failure, FX stale | Either | System widget, in-app alerts (D-708) | Same day |

The "operations queue" widget group (D-1101) is the single place these duties surface; no duty depends on email to an admin (D-707), except the daily overdue-follow-up digest (R-701).

## 9. Founder inputs and external dependencies

Items the platform cannot supply itself. Each blocks the feature listed if missing at launch.

| # | Input | Needed for | Owner | Blocks if missing |
|---|-------|------------|-------|-------------------|
| 1 | UPI VPA for the CodeKraft account | UPI QR at checkout (D-501) | CFO | All UPI payments |
| 2 | Bank account name, number, IFSC (SWIFT optional) | Bank-transfer instructions (D-402) | CFO | Bank payments |
| 3 | Seller details for invoices (name "CodeKraft", address, contact numbers per D-406) | Invoice PDF (D-414) | CFO | Invoice issuance |
| 4 | Tax rate; GSTIN when registered | Tax lines; GST invoice format (D-504, D-1501) | CFO | Tax-enabled products |
| 5 | Initial products: content, media, prices, delivery config, splits | Catalog beyond seed data (D-018) | CEO | Real sales |
| 6 | Landing copy, services text, case studies, testimonials, client logos | Public site credibility (D-117, D-1106) | CEO | Brand objective OBJ-3 |
| 7 | Legal page text (privacy, terms, refund, license) | Legal compliance (D-807, D-1504) | Both | Launch |
| 8 | Logo direction, palette and font approval | Design system (D-906) | Both | UI build |
| 9 | Domain name, purchased and DNS-verified (Resend, Cloudflare) | URLs, admin subdomain, customer email (D-1502; Resend sends only from a verified domain) | CEO | Launch — a release-1 entry criterion (MASTER_SPEC §7 "Domain before launch", docs/13 E-06); hosting may stay on Vercel |
| 10 | Provider accounts: Vercel, Neon/Supabase, Cloudflare (R2, Turnstile), Resend, Umami, Sentry, Anthropic | Hosting, storage, email, analytics, errors, chatbot (D-1401–D-1403, ADR-08) | CEO | Respective feature |
| 11 | Google OAuth client | Google sign-in (D-1201) | CEO | Google login |
| 12 | Razorpay/Stripe/PayPal KYC (needs entity or individual) | V1.1 gateways (D-501, R-102) | CFO | V1.1 |
| 13 | SMS provider | Phone OTP flag (D-1603) | CFO | V1.1 |
| 14 | Purchased hosting | Migration off Vercel free tier (D-1606; the domain itself is input #9, needed at launch) | CEO | V1.1 |

## 10. Constraints

| ID | Constraint | Impact | Source |
|----|------------|--------|--------|
| C-01 | 3–6 days for all documentation and UI design, then build, then 1 day of full testing | Extremely aggressive vs. scope; founder accepted the risk; implementation is sequenced for earliest usable increment | D-119, R-103, D-1602 |
| C-02 | Manual payments only in release 1 | Every order needs admin confirmation; subscriptions renew manually; international buyers effectively blocked until gateways | D-402, D-501, R-401 |
| C-03 | No legal entity | Gateway KYC and GST registration cannot start; blocks V1.1 gateway go-live, not design | R-102 |
| C-04 | Free tiers only at launch: Vercel, Neon/Supabase Postgres, Cloudflare R2, Resend, Umami, Sentry | Cold starts, 10 GB storage, 3k emails/month; Vercel Hobby forbids commercial use (interim risk accepted) | D-1401–D-1403, R-1401, R-1402, D-1606 |
| C-05 | Free notification channels only | Email + in-app for customers; WhatsApp and SMS deferred; license keys are revealed in the dashboard and the email carries a link, not the key (no SMS) | D-1002, D-1604, R-1001, MASTER_SPEC §7 |
| C-06 | Phone OTP needs a paid SMS provider | Built behind a feature flag, off at launch | D-1603, R-1201 |
| C-07 | No existing brand assets | Design-system doc proposes logo, palette and fonts for approval | D-906 |
| C-08 | Content must be produced from raw data | Case studies, testimonials and logos are admin-entered post-launch; seeds are examples only | D-117, D-018 |
| C-09 | No KPIs | Success criteria in §11 are proposals | D-118 |
| C-10 | Two admins; every active admin other than the requester must approve critical actions | If one founder is unavailable, publish, refunds, payouts and split changes stall; the admin-users screen warns when fewer than two active admins exist | BR-13, MASTER_SPEC §7 "Approver set", docs/04 §13 |

## 11. Success criteria (PROPOSED — no KPIs were given, D-118)

The founders defined no KPIs. The criteria below are **proposals** for the founders to accept, change or reject; they are measurable from data the platform already records (`analytics_events`, orders, leads, ledger — D-1302) and need no extra tooling.

### 9.1 Launch readiness (gate to go live)

| ID | Proposed criterion | Measured by |
|----|--------------------|-------------|
| SC-L1 | All release-1 user and admin journeys (baseline §9, §10) pass automated e2e tests in CI with zero manual intervention | CI status (D-1607) |
| SC-L2 | Every public page scores Core Web Vitals "good" on a mid-range mobile profile: LCP < 2.5 s, INP < 200 ms, CLS < 0.1 | Lighthouse in CI (D-1303) |
| SC-L3 | WCAG 2.1 AA: zero critical/serious axe violations on public, account and admin pages | axe in CI (D-907) |
| SC-L4 | Ledger invariant tests pass: Σ allocations + company cut + deductions = gross for every seeded and generated order | Property tests (docs/04 §13) |
| SC-L5 | Both founders complete one real end-to-end purchase (UPI) and one project invoice, with correct invoice numbering and partner balances, during the final manual check | Founder sign-off (D-1607) |
| SC-L6 | All five delivery types fulfilled at least once on staging (SaaS manual, download, license, service checklist, custom) | Staging test log |

### 9.2 First 90 days after launch

| ID | Proposed criterion | Measured by |
|----|--------------------|-------------|
| SC-90-1 | ≥ 10 qualified leads (pipeline status ≥ Qualified) | `leads.status` |
| SC-90-2 | ≥ 3 paid product orders and ≥ 1 project invoice | `orders.status = paid` |
| SC-90-3 | 100 % of submitted payments confirmed or failed by an admin within 24 h | `payments.customer_submitted_at → confirmed_at` |
| SC-90-4 | 100 % of paid orders fulfilled within 48 h (delivery type SaaS/license/custom) | `orders.paid_at → fulfilled_at` |
| SC-90-5 | Zero ledger adjustments needed to correct allocation errors | `ledger_entries.entry_type = adjustment` |
| SC-90-6 | Chatbot answers ≥ 60 % of AI conversations without escalation; AI spend under the configured caps every day | `conversations`, `chat_usage_daily` |
| SC-90-7 | Landing → product-view rate ≥ 25 %; product-view → checkout-start ≥ 5 % | `analytics_events` funnel (D-1302) |
| SC-90-8 | Razorpay live via the payment abstraction with no change to order or ledger code | Code review (A-402) |

## 12. Scope by release (baseline §17)

| Capability | Release 1 | V1.1 | V2 |
|------------|-----------|------|----|
| Story-chapter landing with WebGL 3D hero, static fallback | ✔ (D-801, D-1605) | | |
| Theme 1 Dark cinematic / Theme 2 Light editorial | Theme 1 live; Theme 2 token CSS ships as part of the token contract with the toggle hidden behind `theme_light_editorial` | Theme 2 enabled: toggle, posters/imagery, QA on every screen (D-1602, MASTER_SPEC §7) | |
| Catalog, product pages, product blogs, case studies, services, legal pages | ✔ | | |
| Auth: email + password (verified), Google | ✔ (D-1201) | Phone OTP flag on (D-1603) | |
| Checkout: single-offering "Buy now", manual UPI QR + bank transfer, admin confirmation | ✔ (D-501, MASTER_SPEC §7) | Razorpay → Stripe → PayPal (D-501) | |
| Coupons, sale prices, custom quotes | ✔ (A-401, D-408, D-520) | Bundles (D-417) | |
| Delivery: SaaS/hosted manual, download, license, product + service, custom | ✔ | | Automated provisioning, license API (D-1608) |
| Subscriptions: manual renewal, reminders, 7-day grace, suspend | ✔ (BR-14) | | Automated recurring billing, proration |
| Invoices, credit notes, GST switch | ✔ (D-414, D-1501) | | Foreign tax |
| Ledger, splits, company cut, expenses, payouts, reports, statements | ✔ (D-511–D-517) | | Automated payouts, accounting export |
| Project invoicing via manual orders | ✔ (D-1107) | | |
| Dual-approval workflows (9 request types incl. `project_order.split`), audit log | ✔ (BR-13, D-1104) | | |
| Widget admin dashboard (18–20 widgets) | ✔ (D-120, docs/04 §7.6) | | |
| Leads pipeline, queries, hybrid AI chatbot with caps | ✔ (D-701–D-708) | WhatsApp channel if cost accepted (D-1604) | |
| Customer dashboard, wishlist | ✔ (D-1001, D-311) | | |
| Admin content editing (CMS-lite) | ✔ (D-1106) | | |
| Privacy-friendly analytics + built-in events | ✔ (D-1301) | | |
| Hosting | Vercel free tier with the purchased domain already live (D-1606, MASTER_SPEC §7 "Domain before launch") | Purchased host (D-1606) | |
| Automated CI test suites | ✔ (D-1607) | | |
| External vendors, employee MIS/SSO, video transcoding | | | ✔ (D-1608) |

## 13. Business risks

From `discovery/00-DECISION-LOG.md` section D and baseline §18. Status as approved by the founder.

| ID | Risk | Business impact | Status / mitigation |
|----|------|-----------------|---------------------|
| R-101 | No objective ranking (D-106) | Landing and MVP optimise for nothing in particular | Accepted (D-1601) |
| R-102 | No legal entity | Gateway KYC, GST, international tax blocked | Open, outside platform; manual payments meanwhile |
| R-103 / R-501 / R-801 | Full commerce + ledger + project invoicing + AI bot + widget dashboard + cinematic landing in a days-long window | Delivery slip or quality loss | Accepted (D-1602, D-1605); implementation sequenced for earliest usable increment |
| R-401 | Manual payments only | India-first in practice; admin on every order; manual renewals | Accepted (D-402, D-501); gateways ~1 week post-launch |
| R-105 / R-403 | Worldwide digital sales trigger foreign tax rules; manual tax config | Invoice correctness | Mitigated: no foreign tax in R1, buyer responsible (D-1504); low volume |
| R-502 | "Gateway payments non-refundable" vs card-network rules | Disputes when gateways ship | Open; legal pages must state it |
| R-1401 | Vercel Hobby forbids commercial use | ToS exposure during interim | Accepted for interim (D-1606); Pro or purchased host in V1.1 |
| R-1402 | Free-tier Postgres and 10 GB R2 vs self-hosted video | Storage exhaustion | Embed-first video (A-1402) |
| R-1001 | WhatsApp has no free automated channel | No WhatsApp notifications; keys revealed in the dashboard, email carries the link | Deferred (D-1604) |
| R-1201 | Phone OTP needs paid SMS | No phone login at launch | Flagged off (D-1603) |
| R-201 | Chatbot behind login removes anonymous chatbot→lead funnel | Visitor lead capture depends on forms and CTAs | Accepted (D-205) |
| R-701 | Overdue follow-ups "emailed" (D-706) vs in-app-only admin alerts (D-707) | Admin may miss follow-ups | Treated as a daily reminder digest email (docs/04 §7.5) |
| R-901 | Four brand personalities selected | Incoherent design | Resolved premium-first in design-system doc |
| R-008 | Post-purchase support ownership (SaaS uptime, source questions) undefined | Customer dissatisfaction | Queries pipeline + shared pool (D-705); operational SLA proposed in SC-90-4 |
| C-10 (new) | Every other active admin required for every critical action | Operational stall when one founder is away | Approval requests never expire; pending age shown on system widget (docs/04 §13) |

## 14. Business assumptions

Confirmed by baseline approval (baseline §19). Business-relevant subset:

| ID | Assumption |
|----|------------|
| A-201 | One identity table with RBAC so partners, employees and customers can be added without schema change |
| A-301 | Product ≠ Offering; a single-price product has exactly one offering |
| A-402 | Payment layer is provider-agnostic; manual provider first |
| A-501 | Manual-renewal subscriptions with 7-day grace |
| A-502 | Project revenue uses the same order/invoice/ledger model (order type PROJECT) |
| A-1101 | One generic ApprovalRequest mechanism backs every dual-approval action |
| A-1401 | Host logs, Sentry-class errors, uptime ping, daily DB backups with 7-day retention |
| A-1501 | No cookie banner: privacy-friendly analytics and strictly necessary cookies only |

## 15. Glossary

All terms are defined once in `MASTER_SPEC.md` §3 (Product, Offering, Project, Order, Payment, Entitlement, Subscription, Partner, Ownership, Allocation, Ledger entry, Payout, Lead, Query, Conversation, Approval request, roles, Theme 1/Theme 2). This document adds only:

| Term | Meaning |
|------|---------|
| Company cut | The percentage (bps) of distributable revenue retained by CodeKraft before partner allocation; may be 0 (D-508) |
| Bank shortfall | Invoice amount minus amount actually received on a manual payment; recorded as a bank-charge expense on the order (D-516) |
| Distributable | Gross − discount − tax − gateway charges − bank shortfall (BR-06) |
| Financial year | Indian FY, April–March; drives invoice numbering CK/2026-27/0001 (BR-16) |
| bps | Basis points; 10000 bps = 100 %. All percentages are stored as integer bps (docs/05 §4) |

## 16. Open inconsistencies

All items found while writing this document have since been resolved in `MASTER_SPEC.md` §7; the resolutions are applied above.

| # | Resolution |
|---|------------|
| 1 | Resolved: overdue follow-ups are an admin daily digest email (R-701 → `docs/03` FR-NOTIF-04); §8 and §13 use that reading. |
| 2 | Resolved: license keys are revealed only inside the dashboard; email and in-app notification carry a dashboard link; no SMS (MASTER_SPEC §7 "License key delivery"). §8, C-05, R-1001 updated. |
| 3 | Resolved: the approver set is every active `super_admin`/`admin` except the requester; the admin-users screen warns when fewer than two active admins exist (MASTER_SPEC §7 "Approver set"). C-10 updated. |
| 4 | Resolved: anonymisation is immediate on self-delete, no grace window (MASTER_SPEC §7 "Anonymisation timing"). |
| 5 | Resolved: the theme toggle is visible only when `theme_light_editorial` is on; Theme 2 token CSS still ships in release 1 (MASTER_SPEC §7). §12 updated. |

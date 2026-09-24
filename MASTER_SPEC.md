# CODEKRAFT — MASTER SPECIFICATION

**Version:** 1.0 · **Date:** 2026-09-24 · **Status:** Canonical
**Upstream:** `discovery/01-REQUIREMENTS-BASELINE.md` (approved) ← `discovery/00-DECISION-LOG.md` ← `CODECRAFT_INITIAL_SPEC.md`

This file is the single entry point for every engineer and AI agent working on CodeKraft. It states what is being built, links every downstream document, and fixes the terminology and IDs every other document must use. When two documents disagree, this file and the baseline win; the disagreement is a bug to be fixed, not a choice to be made.

---

## 1. One-paragraph definition

CodeKraft is a premium software-studio website and company-owned digital-product marketplace for a two-founder team. Visitors experience a cinematic story landing, browse services and case studies, and submit project inquiries. Registered customers buy CodeKraft's own products (SaaS, hosted, downloadable, licensed, product-plus-service) through per-product configured offerings, pay in release 1 by manually confirmed UPI or bank transfer, and receive delivery through a dashboard. A separate admin application gives the founders catalog, order and payment confirmation, delivery, leads and queries, content editing, a hybrid AI chatbot's escalations, a customizable widget dashboard, and a partner revenue ledger with immutable, dual-approved splits, project invoicing, expenses, payouts and audit.

## 2. Document map

| # | Document | Purpose | Depends on |
|---|----------|---------|------------|
| — | `discovery/01-REQUIREMENTS-BASELINE.md` | Approved requirements, rules, scope, risks, assumptions | Decision log |
| 01 | `docs/01-BRD.md` | Business requirements, objectives, stakeholders, success criteria | Baseline |
| 02 | `docs/02-PRD.md` | Product requirements: features, user stories, acceptance criteria per feature | BRD |
| 03 | `docs/03-SRS.md` | Software requirements: functional (FR) and non-functional (NFR) requirements with IDs | PRD |
| 04 | `docs/04-SOLUTION-ARCHITECTURE.md` | Architecture comparison, selected stack, module map, integration boundaries | SRS |
| 05 | `docs/05-DATABASE-DESIGN.md` | Entities, tables, columns, constraints, indexes, ledger design, migrations | Architecture |
| 06 | `docs/06-API-SPECIFICATION.md` | Server actions and route handlers, request/response contracts, errors, auth | DB, Architecture |
| 07 | `docs/07-UX-UI-SPECIFICATION.md` | Every screen: purpose, layout, states, interactions, data dependencies | PRD, API |
| 08 | `docs/08-DESIGN-SYSTEM.md` | Tokens, components, both themes, motion system, accessibility | UX |
| 09 | `docs/09-SECURITY-DESIGN.md` | Threat model, auth, RBAC, approvals, file security, audit | Architecture, DB |
| 10 | `docs/10-QA-TEST-STRATEGY.md` | Test pyramid, CI gates, fixtures, critical-path e2e, finance invariants | SRS, API |
| 11 | `docs/11-SEO-PERFORMANCE.md` | SEO implementation, CWV budgets, media strategy | Architecture, UX |
| 12 | `docs/12-DEVOPS-DEPLOYMENT.md` | Environments, CI/CD, hosting, backups, monitoring, secrets, migration to purchased host | Architecture |
| 13 | `docs/13-ROADMAP.md` | Release 1, V1.1, V2 with dependencies | Baseline |
| — | `diagrams/*.md` | Mermaid diagrams: system, DB, user/admin flows, payment, revenue, delivery | DB, Architecture |
| — | `ui/*` | Sitemap, screen inventory, theme specs | UX, Design system |
| — | `implementation/IMPLEMENTATION-MASTER-PLAN.md` + `PHASE-xx.md` | Dependency-aware phases for parallel AI-agent build | Everything above |
| — | `prompts/ANTIGRAVITY-ORCHESTRATOR.md`, `prompts/CLAUDE-CODE-ORCHESTRATOR.md` | Orchestrator prompts for the implementing environment | Implementation plan |

## 3. Canonical terminology

| Term | Meaning | Never call it |
|------|---------|---------------|
| CodeKraft | The brand and company | CodeCraft |
| Product | A ready-made item listed in the marketplace | Project, listing, item |
| Offering | One purchasable plan of a product (price, model, delivery) | Tier, SKU, variant, plan (in code) |
| Project | Client engagement to build something; appears as case study and as manual project order | Product |
| Order | A purchase intent with items, payments, status; type PRODUCT or PROJECT | Cart, transaction |
| Payment | One attempt to pay an order via a method, with confirmation state | Transaction |
| Entitlement | A customer's right to access one offering, created on Paid | License, access, subscription (except the subscription sub-record) |
| Subscription | The recurring sub-record on an entitlement | Plan |
| Partner | An admin user with a share in product revenue | Vendor, seller, owner |
| Ownership | The effective-dated company cut + partner split for a product | Revenue share (in code) |
| Allocation | The immutable per-order-item snapshot of money owed to each party | Split |
| Ledger entry | An immutable journal line in the finance ledger | Transaction |
| Payout | A recorded transfer of money to a partner | Settlement, withdrawal |
| Lead | A sales opportunity in the pipeline | Inquiry (that is the source form) |
| Query | A support thread between a customer (or visitor) and admins | Ticket, conversation (that is chatbot) |
| Conversation | A chatbot session with messages | Chat, query |
| Approval request | A pending critical action needing approval by all admins | Workflow |
| Super Admin / Admin / Customer / Visitor | Roles per baseline §3 | Owner, user (ambiguous) |
| Theme 1 / Theme 2 | Dark cinematic / Light editorial | Dark mode / light mode (they are full design systems, not a mode) |

## 4. Non-negotiable design rules (all documents)

1. **Ledger immutability.** No UPDATE or DELETE on `ledger_entries`, `allocations`, `payments` after confirmation, `invoices`, `credit_notes`. Corrections are new entries (BR-17).
2. **Product ≠ Offering.** Prices, purchase models and delivery live on offerings. A product with one price has exactly one offering (A-301).
3. **Entitlement is the delivery pivot.** All delivery types resolve to an entitlement whose `delivery_type` selects behaviour (A-602).
4. **Payment provider abstraction.** Order and ledger code never reference a provider. Release 1 has `ManualProvider` only (A-402).
5. **Approval requests are generic.** One mechanism for all dual-approval actions (A-1101). The requester is never counted as an approver.
6. **Themes are tokens.** Components consume CSS variables under `[data-theme="dark-cinematic"]` and `[data-theme="light-editorial"]`; no component branches on theme name (D-011).
7. **No hardcoded catalog.** Example products exist only as seed data (D-018).
8. **Money is integer minor units** (paise, cents) with a currency code; never floats. FX rate stored on every entry (D-515).
9. **Every admin mutation writes an audit log row** in the same transaction (D-1104). Read-only Server Actions (widget data loaders, list queries) are exempt.
10. **Public pages are server-rendered** for SEO; admin and account pages may be client-heavy (A-1301).
11. **Feature flags** gate: phone OTP login, WhatsApp channel, gateway providers, Theme 2, automated provisioning, 3D hero kill switch, bundles, vendor marketplace (D-1603, D-1604, D-501, D-1602, D-1605, D-417, D-1608).

## 5. Scope summary

- **Release 1:** baseline §17 in full, minus Theme 2. Includes 3D hero, hybrid AI chatbot, widget dashboard, project invoicing, expenses, coupons, custom quotes, automated CI test suites.
- **V1.1:** Theme 2, Razorpay then Stripe/PayPal, phone OTP (flag on), WhatsApp (if cost accepted), purchased hosting and domain, bundles.
- **V2:** external vendors, employee MIS/SSO, automated payouts and accounting export, automated SaaS provisioning and license API, proration, automated recurring billing, foreign tax, video transcoding.

## 6. Requirement ID scheme

- `BR-nn` business rules (baseline §2), `D-nnnn` decisions, `A-nnnn` assumptions, `R-nnnn` risks, `X-nnn` rejections — all defined in `discovery/`.
- `FR-<area>-nn` functional requirements and `NFR-<area>-nn` non-functional requirements — defined in `docs/03-SRS.md`; areas: AUTH, CAT (catalog), COM (commerce), PAY, DEL (delivery), FIN (finance), LEAD, CHAT, CONT (content), ADM (admin), DASH (customer dashboard), NOTIF, SEO, PERF, SEC, A11Y, OPS.
- `US-nn` user stories in `docs/02-PRD.md`.
- `T-<table>` tables in `docs/05-DATABASE-DESIGN.md`; `API-<area>-nn` endpoints in `docs/06-API-SPECIFICATION.md`; `SCR-<app>-nn` screens in `docs/07-UX-UI-SPECIFICATION.md`; `P<n>.<m>` tasks in `implementation/`.

Every downstream artefact cites the IDs it implements.

## 7. Open items carried into engineering

| ID | Item | Where resolved |
|----|------|----------------|
| R-101/103/501/801 | Scope vs timeline — accepted; sequence for earliest usable increment | `implementation/IMPLEMENTATION-MASTER-PLAN.md` |
| R-901 | Brand personality resolution: premium-first | `docs/08-DESIGN-SYSTEM.md` |
| R-701 | Overdue-follow-up reminder emails to admins (digest) despite in-app-only alerts | `docs/03-SRS.md` FR-NOTIF |
| R-1401 | Vercel free-tier commercial use — interim only | `docs/12-DEVOPS-DEPLOYMENT.md` |
| R-502 | Refund wording for gateway payments | Legal page copy, `docs/02-PRD.md` |
| F-303 | Catalog size assumed < 50 | `docs/04-SOLUTION-ARCHITECTURE.md` (search) |
| A-1201 | Admin on subdomain | `docs/04`, `docs/09`, `docs/12` |
| A-1401 | Monitoring and backups | `docs/12-DEVOPS-DEPLOYMENT.md` |
| Cart | Discovery never asked about a multi-item cart. Design decision: **single-offering checkout ("Buy now")** in release 1; order model supports multiple items so a cart can be added without schema change. | `docs/02-PRD.md`, `docs/05` |
| AI provider | Selected in architecture per spec §12 | `docs/04-SOLUTION-ARCHITECTURE.md` §9 |
| Refund request channel | D-505 says "customer emails admin" but the site publishes no email (D-808). Resolution: the order page offers "Request refund" which opens a query thread (source `order`); email remains possible via the invoice contact details (D-406). | `docs/06` API-COM, `ui/screens/user` |
| License key channel | D-406 says email or SMS; SMS is not a release-1 channel (D-1002). Resolution: email + in-app + dashboard reveal. | `docs/06`, `docs/07` |
| Tax before GST registration | BR-08: a product's `tax_enabled` flag has effect only when a GSTIN is configured in settings; until then tax rate is treated as 0 and invoices carry no tax lines (D-1501). | `docs/03` FR-COM, `docs/06` |
| Manual entitlement grants | `entitlements.order_item_id` is nullable for admin grants (D-1108); no synthetic orders. | `docs/05` T-entitlements |
| Payment immutability | Confirmed payments allow exactly one later transition, confirmed → refunded. | `docs/05` §12 |
| Approver set | BR-13 "all admins" = every active user holding `super_admin` or `admin` role, except the requester. With two founders this is "the other one". A platform with a single admin cannot execute dual-approval actions; the admin-users screen warns when fewer than two active admins exist. | `docs/03` FR-ADM, `docs/06` |
| Order `failed` | An order stays `pending_payment` while the customer may retry (D-416). It becomes `failed` only when `expires_at` passes with no confirmed payment, or when an admin marks the submitted reference invalid and no retry follows before expiry. | `docs/03` state machine |
| "Real-time" | Defined as in-app polling: 10 s on admin, 30 s on customer, with focus refetch (ADR-06). | `docs/04` §7.5 |
| Anonymisation timing | On self-delete the account is anonymised immediately (BR-18); no grace window. | `docs/05` §12 |
| Theme toggle at launch | Visible only when the `theme_light_editorial` flag is on (V1.1). | `docs/07`, `docs/08` |
| Split rounding | Allocations use largest-remainder rounding in minor units so partner lines sum exactly to the distributable amount. | `docs/06` §4 |
| Overpayment | If `amount_received > amount_due`, the excess is recorded as a `customer_credit` note on the payment and shown to admins; not allocated to partners. | `docs/03` FR-PAY |
| Payout > balance | Recording a payout larger than the partner's current balance is rejected. | `docs/03` FR-FIN |
| Base currency lock | `site_settings.base_currency` becomes read-only after the first paid order. | `docs/03` FR-ADM |
| Password hashing | argon2id (Better Auth configured explicitly; its scrypt default is not used). | `docs/09` |
| License key delivery | The email and in-app notification carry a link to the dashboard; the key itself is revealed only inside the authenticated dashboard (TM-05 hardening of D-406/D-603). Founder may relax to plaintext email. | `docs/09`, `docs/07` |
| Audit atomicity | Rule 9 applies to domain mutations. Better Auth's own auth events are written by hooks immediately after the auth transaction; they are audited but not atomic with it. | `docs/09` |
| Custom quote pay link | The link requires login (BR-03) and then opens the quote and the session user must equal `custom_quotes.customer_id`, otherwise the quote is shown read-only with a "sign in as the invited customer" prompt. | `docs/06` API-COM |
| Single session | D-1203 applies to customers and admins alike. | `docs/09` |
| Manual entitlement grants | Not in the dual-approval list (D-1105). They require a mandatory reason, write an audit row, notify the other admins, and never post ledger entries or allocations. | `docs/06`, `docs/09` |
| Project order splits | Project (service) orders have no product ownership. Each project line carries a `split_snapshot` set by the creating admin; the order cannot be invoiced or paid until the split is approved by the other admins (approval type `project_order.split`, per BR-05). Ledger posting then uses the snapshot exactly like a product ownership version. | `docs/05` T-order_items, `docs/06` |
| Order `fulfilled` | An order becomes `fulfilled` when every entitlement it created is `active` and every service checklist on it is complete. Download/license/SaaS-manual entitlements become `active` on grant (manual SaaS provisioning marks `provisioning_state` separately and does not block `active`). | `docs/03` state machines |
| Subscription grace | The 7-day grace is `subscriptions.status = past_due` while `entitlements.status` stays `active`; after grace both become `suspended`. | `docs/05`, `docs/03` |
| Refund reversal scope | Reverses sale, discount, tax, company cut and partner allocations proportionally; gateway fees and bank charges are never reversed. | `docs/05` §7 |
| Reduced motion | "Animations off" (D-907) = no motion-based animation; opacity crossfades ≤ 200 ms remain for state changes. | `docs/08` §motion |
| Theme attribute on ISR pages | A ≤ 300-byte inline head script (CSP nonce) sets `data-theme` from cookie before paint; the Server Action that saves `users.theme_pref` also refreshes the cookie. | `docs/04` §7.9, `docs/06`, `docs/09` |
| Theme 2 in release 1 | Theme 2 token CSS ships in release 1 (it is part of the token contract); the V1.1 item is enabling the toggle, posters/imagery and QA across all screens. | `docs/13`, `implementation/PHASE-11` |
| "Start a project" CTA | Opens an inquiry sheet on the landing page that posts to the same lead action as `/contact`. | `docs/07` |
| Admin minimum width | Admin app is designed for ≥ 1024 px; phone/tablet get a read-mostly layout for approvals, payment confirmation and notifications only. Narrows D-012 for admin; founder may override. | `docs/07` |
| Print/PDF/email theming | Invoices, credit notes, statements and emails are always ink-on-white, independent of theme. | `docs/08` |
| Scroll behaviour | No scroll-jacking or snap; story chapters use GSAP pin-with-spacing at ≥ 1024 px, plain stacked sections below (rewords R-801). | `docs/08`, `docs/10` |
| Domain before launch (founder action) | Resend sends customer email only from a verified domain. A domain must therefore be purchased and DNS-verified before release 1 goes live, even while hosting stays on Vercel (D-1401/D-1606 revised: domain now, hosting later). Until then only founder-addressed test email works. | `docs/12`, `docs/13` E-06 |
| Admin host during interim | On `*.vercel.app` the admin app runs as a second Vercel project with its own hostname matched exactly by `ADMIN_HOST`; after the domain exists it becomes `admin.<domain>`. Vercel Hobby is single-member, so only one founder has dashboard access until Pro or the VPS. | `docs/04` §8, `docs/12` |
| Cron on free tier | Two consolidated jobs (`frequent` every 15 min, `daily`) fired by a GitHub Actions scheduler while on Vercel Hobby. | `docs/04` §4, `docs/12` |
| Blog on product page | D-121 "cards" wins over "embedded": the product page shows the blog as a card with excerpt linking to `/blog/[slug]`, avoiding duplicate content. | `docs/07`, `docs/11` |
| Slug changes | Slugs of published products/case studies/blogs may be changed; the old slug is kept in `slug_redirects` and served as 301. | `docs/05`, `docs/11` |
| Backups | 7-day retention comes from nightly encrypted `pg_dump` to R2 (Neon Free PITR is hours only). | `docs/12` |
| Auth and checkout URLs | `/auth/login`, `/auth/register`, `/auth/verify`, `/auth/reset`, `/auth/otp`; checkout at `/checkout/[offeringId]` (auth required); custom quotes at `/quote/[token]`. | `ui/sitemap.md`, `docs/06` |
| Visitor currency selector | Visitors may pick a display currency (cookie); logging in loads `users.display_currency` and saving it refreshes the cookie. Superset of D-111; founder may restrict to logged-in users. | `docs/07` |
| Chatbot "contact" menu | Resolves to "escalate to a query" (no public contact details, D-808). | `docs/07` SCR-ACC-06 |
| Renewal order expiry | A renewal order's `expires_at` equals the subscription's `grace_until`, so BR-10 and BR-14 coincide by design. | `docs/06` |
| Unlisted product demo links | A live-demo URL of an unlisted product is public once known; accepted residual risk, admins are told on the editor. | `docs/09` |
| Admin removal | An `admin.user_change` that would leave zero active `super_admin` users is rejected; one that leaves fewer than two admin-class users is allowed with a warning that dual-approval actions will stall. | `docs/03` FR-ADM-12 |
| Order `cancelled` | Only explicit cancellation by the customer (before payment submission) or an admin sets `cancelled`; expiry sets `failed`. | `docs/03` state machines |
| Turnstile outage | Public forms fail closed during a Turnstile outage (lead capture pauses); accepted residual risk. | `docs/09` TM, baseline amendments |
| Charge currency after gateways | D-502 (charge in base currency) is revisited before Stripe/PayPal (V1.1) and recurring billing (V2). | `docs/13` |
| INP measurement | Lighthouse cannot measure INP; CI uses Total Blocking Time as proxy and field INP arrives via `web-vitals` → `analytics_events`. | `docs/10`, `docs/11` |

# CodeKraft Sitemap

**Source:** A-801 (public sitemap), `docs/04-SOLUTION-ARCHITECTURE.md` §5 (route groups) and §8 (admin subdomain), `docs/07-UX-UI-SPECIFICATION.md` §2, §8.
**Domain:** configurable placeholder until launch (D-1502). Admin app at `admin.<domain>` (A-1201); the host is matched exactly against `ADMIN_HOST` (a second `*.vercel.app` project during the interim, MASTER_SPEC §7 "Admin host during interim"). Auth, checkout and quote paths per MASTER_SPEC §7 "Auth and checkout URLs": `/auth/*`, `/checkout/[offeringId]`, `/quote/[token]`. Old slugs of published products, case studies and blogs 301 to the new slug via `slug_redirects` (MASTER_SPEC §7 "Slug changes").

Render types: **SSG** static at build · **ISR** static with tag/interval revalidation (60–3600 s, invalidated on publish) · **SSR** rendered per request · **Client** SSR shell + client-side data (TanStack Query / Server Actions). "Verified" = customer with verified email (D-1201).

---

## 1. Public site — `<domain>`

| URL | Screen | Purpose | Render | SEO | Auth |
|-----|--------|---------|--------|-----|------|
| `/` | SCR-SITE-01 | Story-chapter landing: Who we are → What we build → What we sell → Proof → Talk to us; dual CTA (D-801, D-802); featured products; blog teasers | ISR (300 s, tag `content`,`catalog`) | Organization + WebSite JSON-LD, OG | Public |
| `/services` | SCR-SITE-02 | One section per service with deliverables and inquiry CTA; no prices (BR-01, D-806) | ISR (tag `content`) | Service JSON-LD list, OG | Public |
| `/products` | SCR-SITE-03 | Catalog with search, filters, sort (D-310, A-303); excludes unlisted | SSR (query params) | ItemList JSON-LD, canonical without filter params, `noindex` on filtered/paginated variants beyond page 1 | Public |
| `/products?category=<slug>` | SCR-SITE-03 | Category-filtered list (category tree rendered flat, D-303) | SSR | Canonical to `/products?category=` only | Public |
| `/products/[slug]` | SCR-SITE-04 | Product detail: media, offerings, FAQs, testimonials, changelog, presentation viewer, live demo, blog section, customisation CTA | ISR (tag `product:<id>`) | Product + Offer + FAQPage + BreadcrumbList JSON-LD; `noindex` when `is_unlisted` | Public; Buy requires Verified |
| `/projects` | SCR-SITE-05 | Case studies grid (D-803) | ISR (tag `content`) | CollectionPage, OG | Public |
| `/projects/[slug]` | SCR-SITE-06 | Case study detail: problem, solution, tech stack, results, gallery | ISR | Article + BreadcrumbList JSON-LD | Public |
| `/blog` | SCR-SITE-07 | Index of product blogs (teasers only, D-804) | ISR (tag `blog`) | Blog JSON-LD | Public |
| `/blog/[slug]` | SCR-SITE-08 | Product blog post with product card | ISR (tag `blog:<id>`) | Article/BlogPosting + BreadcrumbList | Public |
| `/contact` | SCR-SITE-09 | Inquiry form only (D-808); creates lead (`source=inquiry_form`) | SSG shell + client form | ContactPage JSON-LD (no contact points) | Public (Turnstile) |
| `/legal/privacy` | SCR-SITE-10 | Privacy policy (D-807) | ISR (tag `legal`) | WebPage; canonical | Public |
| `/legal/terms` | SCR-SITE-10 | Terms of service; Indian governing law (D-1504) | ISR | WebPage | Public |
| `/legal/refunds` | SCR-SITE-10 | Refund & cancellation policy (BR-09, R-502 wording) | ISR | WebPage | Public |
| `/legal/license` | SCR-SITE-10 | Product license terms | ISR | WebPage | Public |
| `/sitemap.xml` | — | Generated: all published products (not unlisted), case studies, blogs, static pages | SSR (cached) | — | Public |
| `/robots.txt` | — | Allow site; disallow `/account`, `/auth`, `/api`; sitemap reference; admin host disallows all | SSG | — | Public |
| `/api/og/*` | — | OG image generation for products, case studies, blogs | Route handler | — | Public |
| `404` / `error` | SCR-SITE-11 | Not found, route error, offline fallback | SSG | `noindex` | Public |

## 2. Auth — `<domain>/auth/*`

| URL | Screen | Purpose | Render | SEO | Auth |
|-----|--------|---------|--------|-----|------|
| `/auth/login` | SCR-AUTH-01 | Email + password, Google; link to phone OTP if flag on; `?returnTo=` | SSR + client | `noindex` | Public (redirects signed-in users) |
| `/auth/register` | SCR-AUTH-02 | Email + password or Google; sends verification link | SSR + client | `noindex` | Public |
| `/auth/verify?token=` | SCR-AUTH-03 | Consumes verification token; resend option | SSR | `noindex` | Public (token) |
| `/auth/reset` | SCR-AUTH-04 | Request reset link | SSR + client | `noindex` | Public |
| `/auth/reset?token=` | SCR-AUTH-04 | Set new password | SSR + client | `noindex` | Public (token) |
| `/auth/otp` | SCR-AUTH-05 | Phone number → OTP login; 404 unless flag `phone_otp` (D-1603) | SSR + client | `noindex` | Public |
| `/api/auth/[...all]` | — | Better Auth handler (OAuth callbacks, sessions) | Route handler | — | — |

## 3. Account — `<domain>/account/*`, `/checkout/[offeringId]`, `/quote/[token]` (Customer role; 60-min idle, single session, D-1203)

| URL | Screen | Purpose | Render | SEO | Auth |
|-----|--------|---------|--------|-----|------|
| `/account` | SCR-ACC-01 | Overview: active entitlements, pending orders, renewals due, open queries, unread notifications | Client | `noindex` | Customer |
| `/account/purchases` | SCR-ACC-02 | Entitlement list with status, delivery type, access period | Client | `noindex` | Customer |
| `/account/purchases/[entitlementId]` | SCR-ACC-03 | Per-delivery-type detail: downloads (cap), license key, SaaS credentials/instructions, service checklist, subscription renew/cancel | Client | `noindex` | Customer (owner) |
| `/checkout/[offeringId]` | SCR-ACC-10 | Single-offering checkout in the `(account)` group (minimal account shell): billing details, coupon, payment method; creates the order and hands over to the order page for UPI QR / bank instructions and the reference; `?renewal=<subscriptionId>` for renewals | Client | `noindex` | Verified customer |
| `/account/orders/[orderId]` | SCR-ACC-11 | Order status timeline; submit/edit payment reference; retry failed payment (D-416); instructions after Paid | Client | `noindex` | Customer (owner) |
| `/quote/[token]` | SCR-ACC-12 | Custom quote view + accept (D-520); login required to view (BR-03), read-only for any customer other than `custom_quotes.customer_id`, who alone can accept (MASTER_SPEC §7 "Custom quote pay link", docs/06 API-COM-10) | Client | `noindex` | Customer; accept: invited customer, verified |
| `/account/invoices` | SCR-ACC-04 | Invoices (PDF), credit notes, payment history incl. pending UPI/bank submissions | Client | `noindex` | Customer |
| `/account/queries` | SCR-ACC-05 | Query list + new query | Client | `noindex` | Customer |
| `/account/queries/[queryId]` | SCR-ACC-05 | Query thread with admin replies | Client | `noindex` | Customer (owner) |
| `/account/chat` | SCR-ACC-06 | Hybrid chatbot: menus + AI; escalate to query (D-701, D-702) | Client (SSE via `/api/chat`) | `noindex` | Customer |
| `/account/wishlist` | SCR-ACC-07 | Saved products (D-311) | Client | `noindex` | Customer |
| `/account/notifications` | SCR-ACC-08 | Persistent notification inbox | Client | `noindex` | Customer |
| `/account/settings` | SCR-ACC-09 | Profile · Settings (currency, theme, reduce motion) · Security (password, sessions) · Delete account (D-1003) | Client | `noindex` | Customer |
| `/api/files/download/[entitlementId]/[mediaId]` | — | Issues 5-min signed GET, logs download, enforces cap (BR-15) | Route handler | — | Customer (owner) |
| `/api/chat` | — | Streaming chatbot endpoint with caps (D-708) | Route handler | — | Customer |

## 4. Admin — `admin.<domain>/*` (Admin / Super Admin; 30-min idle; optional TOTP; designed for ≥ 1024 px — below that only `/login`, `/approvals`, `/orders` payment confirmation and `/notifications` render a read-mostly layout, every other route shows the "Open on a laptop" notice, MASTER_SPEC §7)

| URL | Screen | Purpose | Render | Auth |
|-----|--------|---------|--------|------|
| `/login` | SCR-ADM-01 | Admin email + password | SSR + client | Public |
| `/login/totp` | SCR-ADM-01 | TOTP code when enabled (D-1202) | SSR + client | Pending admin session |
| `/dashboard` | SCR-ADM-02 | Per-admin widget grid + widget library (D-120) | Client | Admin |
| `/approvals` | SCR-ADM-05 | Approval requests: pending for me, requested by me, history (A-1101) | Client | Admin |
| `/notifications` | SCR-ADM-33 | Persistent admin inbox (D-707) | Client | Admin |
| `/products` | SCR-ADM-03 | Catalog table with status, flags, offerings count | Client | Admin (`catalog.read`) |
| `/products/new` | SCR-ADM-04 | Create product (Basics tab first) | Client | Admin (`catalog.write`) |
| `/products/[id]?tab=basics|content|media|offerings|delivery|ownership|seo|blog|versions|testimonials|faqs|publish` | SCR-ADM-04 | Product editor tabs | Client | Admin (`catalog.write`) |
| `/categories` | SCR-ADM-03 | Two-level categories and tags (D-303) | Client | Admin |
| `/coupons` | SCR-ADM-32 | Coupon CRUD (A-401) | Client | Admin (`orders.manual.write`) |
| `/orders` | SCR-ADM-06 | Orders table; queue "Awaiting confirmation" | Client | Admin (`orders.read`) |
| `/orders/[id]` | SCR-ADM-07 | Order detail: confirm payment (received amount, shortfall or overpayment credit), fulfil, entitlements, service checklist, refund; project orders blocked until `project_order.split` is approved | Client | Admin (`orders.read`; `payments.confirm`, `refunds.propose`, `delivery.tasks.write`, `entitlements.admin` per action) |
| `/orders/new` | SCR-ADM-08 | Manual/project order + invoice (D-1107); project lines carry a `split_snapshot` that needs `project_order.split` approval before invoice/payment | Client | Admin (`orders.manual.write`) |
| `/quotes`, `/quotes/[id]` | SCR-ADM-09 | Custom quotes: create, send, track (D-520) | Client | Admin |
| `/customers`, `/customers/[id]` | SCR-ADM-10/11 | Customer list and record: notes/tags, suspend, grant/revoke, reset link (D-1108) | Client | Admin (`customers.read`; `customers.notes.write`, `customers.suspend`, `customers.reset_link`, `entitlements.admin` per action) |
| `/entitlements` | SCR-ADM-12 | All entitlements with status filters | Client | Admin |
| `/delivery-tasks` | SCR-ADM-12 | Provision / revoke-external tasks (D-607) | Client | Admin |
| `/leads`, `/leads/board`, `/leads/[id]` | SCR-ADM-13/14 | Lead table, kanban pipeline, lead detail with notes, follow-ups, assignment (D-703–D-706) | Client | Admin (`leads.read`, `leads.write`, `leads.assign`; Admin-role sees assigned + pool) |
| `/queries`, `/queries/[id]` | SCR-ADM-15 | Query inbox and thread reply (D-702) | Client | Admin |
| `/chatbot?tab=conversations|usage|prompts` | SCR-ADM-16 | Transcripts, usage vs caps, prompt versions | Client | Admin (`chat.transcripts.read`; prompts `chat.prompts.write`) |
| `/finance/ledger` | SCR-ADM-17 | Immutable journal browser (BR-17) | Client | Admin (`finance.ledger.read`) |
| `/finance/allocations` | SCR-ADM-18 | Per-order-item allocation snapshots | Client | Admin (`finance.ledger.read`) |
| `/finance/partners` | SCR-ADM-19 | Partner running balances (D-511) | Client | Admin (own share if Admin-role, D-512) |
| `/finance/payouts` | SCR-ADM-19 | Record/list payouts (dual-approved; a payout larger than the balance is rejected) | Client | Admin (`finance.payout.record`) |
| `/finance/expenses` | SCR-ADM-20 | Expenses against products (D-514) | Client | Admin (`finance.expense.write`) |
| `/finance/adjustments` | SCR-ADM-21 | Adjusting entries (dual-approved, D-517) | Client | Admin (`finance.adjustment.propose`) |
| `/finance/reports` | SCR-ADM-22 | Revenue by product/partner/period, tax, refunds, outstanding payouts (D-513) | Client | Admin (`finance.reports.read`) |
| `/finance/statements` | SCR-ADM-22 | Partner statements PDF/CSV (always ink-on-white) | Client | Admin (`finance.statements.export`) |
| `/content/landing` | SCR-ADM-23 | Landing chapter editor + featured products | Client | Admin (`content.write`) |
| `/content/services` | SCR-ADM-24 | Services list editor | Client | Admin |
| `/content/case-studies` | SCR-ADM-25 | Case study CRUD | Client | Admin |
| `/content/testimonials`, `/content/logos` | SCR-ADM-26 | Site testimonials and client logos | Client | Admin |
| `/content/faqs` | SCR-ADM-27 | Site/chatbot FAQs | Client | Admin |
| `/content/legal` | SCR-ADM-28 | Legal page versions | Client | Super Admin |
| `/settings/general|currencies|tax|payment-methods|theme|ai|notifications|flags|retention` | SCR-ADM-29 | Platform settings | Client | Super Admin |
| `/audit` | SCR-ADM-30 | Audit log filter/export (D-1104) | Client | Admin (`audit.read`) |
| `/admin-users` | SCR-ADM-31 | Admin users, roles, partner records (dual-approved) | Client | Super Admin |
| `/api/cron/*`, `/api/webhooks/*` | — | Jobs and provider webhooks (no UI) | Route handler | Secret / signature |

## 5. Redirect and guard rules

- Signed-in customer visiting `/auth/login` or `/auth/register` → `/account`.
- Visitor clicking Buy / Wishlist / Chat → `/auth/login?returnTo=<path>`; after login return to `returnTo` (same-origin only).
- Unverified customer reaching `/checkout/*` → interstitial "Verify your email" (SCR-AUTH-03 resend state) — cannot proceed (D-1201).
- `/quote/[token]`: unknown token → 404; signed-out → `/auth/login?returnTo=/quote/<token>`; signed in as a different user → read-only with "Sign in as the invited customer" (MASTER_SPEC §7 "Custom quote pay link").
- Old slug of a published product / case study / blog → 301 to the new slug (`slug_redirects`).
- Suspended customer (`users.status='suspended'`) → signed out with `/auth/login?reason=suspended`.
- `admin.<domain>` with no admin role → `403` (SCR-SITE-11 variant) after login; `<domain>/admin/*` → 404.
- Unlisted product: reachable by slug, `noindex`, excluded from lists, search, sitemap and landing.
- Coming-soon product: listed, no Buy button, "Notify me" adds to wishlist.
- Archived/unpublished product: `/products/[slug]` → 404 for public; customers with an entitlement can still open it from `/account/purchases/[id]` (product snapshot).

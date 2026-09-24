# 02 — PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Product:** CodeKraft · **Version:** 1.0 · **Date:** 2026-09-24 · **Status:** Draft for founder review
**Implements:** `docs/01-BRD.md`, `discovery/01-REQUIREMENTS-BASELINE.md`, `MASTER_SPEC.md` §3–§7.
**Feeds:** `docs/03-SRS.md` (FR/NFR IDs), `docs/07-UX-UI-SPECIFICATION.md` (screens), `docs/10-QA-TEST-STRATEGY.md` (acceptance tests).
**Conventions:** user stories are `US-nn`; priority is **R1** (release 1), **V1.1** or **V2** per baseline §17; every story cites the decision (D-), rule (BR-) or assumption (A-) it implements. Acceptance criteria are Given/When/Then and are the source of e2e tests. Money is integer minor units. Terminology per `MASTER_SPEC.md` §3.

---

## 1. Personas

| Persona | Who | Goals | Frustrations to avoid | Roles / sources |
|---------|-----|-------|-----------------------|-----------------|
| **Visitor** | Anyone landing on the site: prospective client, curious buyer, search engine | Understand what CodeKraft builds and sells; submit an inquiry; browse products; read a case study | Scroll-jacking that fights the device; being forced to log in to read; hidden contact route | Public site, catalog, inquiry form, theme toggle (baseline §3, D-204, D-808) |
| **Customer** | Registered buyer (startup founder, SMB owner, professional, agency) | Buy one offering quickly, pay by UPI or bank, get access, download, renew, get help | Not knowing whether a manual payment was received; losing download access without warning; no invoice | Everything Visitor has + purchase, dashboard, chatbot, wishlist, currency (D-1001, D-205) |
| **Super Admin — CEO** | Founder; Partner; owns catalog, brand, leads | Publish products, edit landing content, work the lead pipeline, approve CFO's finance actions | Being the bottleneck on every order; missing a follow-up | Full admin app subject to dual approval (D-202, D-1103) |
| **Super Admin — CFO** | Founder; Partner; owns money | Confirm payments, record shortfalls, issue invoices, record payouts and expenses, run reports and statements, approve CEO's catalog actions | Any mutable ledger; unexplained partner balances; manual FX maths | Full admin app; ledger, payouts, reports (D-511–D-517) |
| **Admin (future partner)** | Partner onboarded within 1–2 years | See own products, own share, assigned leads | Seeing other partners' revenue | Scoped admin app (D-512, D-114); onboarded via `admin.user_change` approval (D-1105) |
| **Staff (future)** | Employees via MIS/SSO | Operational tasks | — | RBAC-defined, not seeded (D-201); V2 (D-1608) |

## 2. Product principles (from MASTER_SPEC §4)

1. Product ≠ Offering; every price lives on an offering (A-301).
2. Entitlement is the delivery pivot for every delivery type (A-602).
3. Order and ledger code never know the payment provider (A-402).
4. Ledger, allocations, confirmed payments, invoices and credit notes are immutable (BR-17).
5. One generic approval request mechanism; requester never approves (A-1101, BR-13).
6. Themes are token sets, not code branches (D-011).
7. Every admin mutation writes an audit row in the same transaction (D-1104).
8. Public pages are server-rendered (A-1301).

## 3. Checkout decision: single-offering "Buy now" (MASTER_SPEC §7, ADR-12)

Discovery never asked about a multi-item cart. Release 1 therefore has **no cart**: a customer buys exactly one offering per order via a "Buy now" button on the offering. The `orders`/`order_items` schema (T-orders, T-order_items) supports multiple items so that a cart, and bundles in V1.1 (D-417), can be added without schema change. Manual orders created by admins (D-1107) may already contain several line items. Consequences: no "add to cart" affordance anywhere on the site; wishlist (D-311) is the only "save for later" mechanism; a coupon applies to the single item; quantity is always 1 for product orders.

## 4. Feature list by area

| Area | Feature | Priority | Key decisions |
|------|---------|----------|---------------|
| Site | Story-chapter landing (Who we are → What we build → What we sell → Proof → Talk to us), dual CTA | R1 | D-801, D-802 |
| Site | WebGL 3D hero, lazy-loaded, static fallback, off on mobile/reduced-motion | R1 | D-904, D-907, D-1605 |
| Site | Services page (one section per service) | R1 | D-302, D-806 |
| Site | Case-study grid + detail pages | R1 | D-803 |
| Site | Product blog pages `/blog/[slug]` + index; teasers on landing | R1 | D-121, D-804 |
| Site | Contact page = inquiry form only | R1 | D-808 |
| Site | Legal pages: privacy, terms, refunds, license | R1 | D-807 |
| Site | Theme 1 Dark cinematic; admin default + visible toggle | R1 | D-902, D-905 |
| Site | Theme 2 Light editorial (token CSS ships in R1 as part of the token contract; toggle, posters/imagery and QA enabled in V1.1) | V1.1 | D-903, D-1602, MASTER_SPEC §7 |
| Auth | Email + password with verification link; Google; password reset | R1 | D-1201 |
| Auth | Phone OTP login (feature flag) | V1.1 | D-1603 |
| Auth | Admin optional TOTP; admin subdomain; idle timeouts; single session | R1 | D-1202, D-1203, A-1201 |
| Catalog | Browse, filter, sort, full-text search (products only) | R1 | D-310, A-303, A-304 |
| Catalog | Product page: content, media, PDF viewer, demo video, live demo link, FAQs, testimonials, version + changelog, offerings | R1 | D-309, D-312, D-313, D-805 |
| Catalog | Featured, unlisted, coming-soon flags | R1 | D-314 |
| Catalog | Display currency (INR/USD/EUR/GBP/CAD) via FX; visitors pick it via cookie, customers via `users.display_currency` | R1 | D-502, D-518, D-111, MASTER_SPEC §7 |
| Catalog | Wishlist | R1 | D-311 |
| Catalog | "Request customisation / Talk to us" CTA → lead | R1 | D-315 |
| Checkout | Single-offering "Buy now"; checkout details; enabled methods per offering | R1 | MASTER_SPEC §7, D-410, D-110 |
| Checkout | Static UPI QR with reference submission; bank transfer details | R1 | D-501, D-402 |
| Checkout | Order expiry 7 days (order → `failed`); no duplicate one-time purchase; retry after a failed attempt | R1 | BR-10, D-416, MASTER_SPEC §7 |
| Checkout | Coupons (percent/fixed, expiry, usage limit, product restriction, first purchase) | R1 | A-401, D-409 |
| Checkout | Sale price with strike-through | R1 | D-408 |
| Checkout | Custom quotes (private offer + pay link) | R1 | D-520 |
| Checkout | Gateway providers Razorpay → Stripe → PayPal | V1.1 | D-501 |
| Checkout | Bundles | V1.1 | D-417 |
| Payments | Admin confirmation with amount received, shortfall, and overpayment recorded as `customer_credit_minor` | R1 | D-516, MASTER_SPEC §7 |
| Payments | Invoice PDF per paid order; credit note on refund; GST switch | R1 | D-414, D-1501 |
| Payments | Refund request from the order page (query, source `order`); admin-executed refunds (dual approval); chargeback flagging | R1 | BR-09, D-416, MASTER_SPEC §7 |
| Delivery | SaaS/hosted manual provisioning; download with signed links and cap; license key entry; service checklist; custom instructions | R1 | D-601–D-608 |
| Delivery | Access period, update policy, release files per version | R1 | D-604, D-605 |
| Delivery | Revocation (auto for platform assets, task for external) | R1 | D-607 |
| Delivery | Automated provisioning adapter, license validation API | V2 | D-1608 |
| Subscriptions | Manual renewal: reminder, grace 7 days, suspend, cancel at period end | R1 | BR-14, D-1004 |
| Subscriptions | Automated recurring billing, proration | V2 | D-1608 |
| Dashboard | Profile, settings, security, notifications, purchases & access, invoices & payments, queries, wishlist, self-delete | R1 | D-1001, D-1003 |
| Queries | Support threads from form, chatbot, order, dashboard, and admin-created (`email`, `manual`); admin replies in thread | R1 | D-702 |
| Chatbot | Hybrid menus + AI grounded on site content; login required; daily caps; escalation | R1 | D-701, D-708, D-205 |
| Leads | Sources, pipeline New→Lost, shared pool, assignment, notes, follow-ups, overdue | R1 | D-703–D-706 |
| Admin catalog | Product CRUD, offerings, media, delivery config, ownership split, submit → approve → schedule/publish, archive/delete | R1 | D-303–D-315, A-302, BR-11 |
| Approvals | Generic approval inbox for 9 request types (incl. `project_order.split`) | R1 | A-1101, D-1105, MASTER_SPEC §7 |
| Manual orders | Project invoices and offline sales with free-form lines; project lines carry a `split_snapshot` approved via `project_order.split` | R1 | D-1107, D-510, MASTER_SPEC §7 |
| Finance | Ledger, allocations, partner balances, payouts, expenses, adjustments, reports, statements PDF/CSV | R1 | D-511–D-517 |
| Finance | Automated payouts, accounting export | V2 | D-1608 |
| Content | Landing chapters, services, case studies, testimonials, logos, FAQs, legal pages, product blogs | R1 | D-1106 |
| Widget dashboard | 18–20 widgets, per-admin layout | R1 | D-120, D-1101 |
| Notifications | Customer email + in-app; admin in-app inbox; overdue digest | R1 | D-1002, D-707, R-701 |
| Notifications | WhatsApp channel | V1.1 | D-1604 |
| Settings | Base currency, tax rate, GSTIN, UPI/bank details, payment methods, default theme, AI caps/model, retention, feature flags | R1 | D-502, D-504, D-1501, D-708, D-905 |
| Customers | Notes/tags, suspend, manual grant/revoke (mandatory reason, other admins notified, no ledger), reset/one-time login link | R1 | D-1108, MASTER_SPEC §7 |
| Audit | Every admin action and auth event; filter; export | R1 | D-1104 |
| Analytics | Umami + built-in events feeding widgets | R1 | D-1301, D-1302 |

## 5. User stories

### 5.1 Public site

**US-01 · Experience the story landing** — R1 — D-801, D-802, D-1106
As a Visitor, I want a five-chapter scroll story so that I understand who CodeKraft is, what it builds, what it sells and how to start.
- Given I open `/` on desktop, When I scroll, Then chapters Who we are → What we build → What we sell → Proof → Talk to us appear in order with admin-authored copy, media and CTAs (T-landing_chapters).
- Given the hero, When rendered, Then "Start a project" opens the inquiry form and "Explore products" links to `/products`.
- Given the "What we sell" chapter, When rendered, Then it shows admin-chosen featured products (T-featured_products) and product-blog teasers.

**US-02 · See the 3D hero or its fallback** — R1 — D-904, D-907, D-1605
As a Visitor on a capable device, I want a cinematic 3D hero; on a phone or with reduced motion I want a static image instead.
- Given a desktop browser without `prefers-reduced-motion`, When the hero enters the viewport, Then the WebGL scene lazy-loads after first paint and LCP stays < 2.5 s.
- Given a mobile viewport or `prefers-reduced-motion: reduce` or WebGL unavailable, When `/` loads, Then the static poster renders and no 3D bundle is downloaded.

**US-03 · Read services and start a project** — R1 — BR-01, D-302, D-806
As a Visitor, I want one services page with a section per service and a CTA, so that I can inquire without seeing prices.
- Given `/services`, When rendered, Then every published service (T-services) shows title, summary, deliverables and a CTA; no price appears anywhere.
- Given I click a service CTA, When I submit the inquiry form, Then a lead is created with `source = inquiry_form` and `service_interest` set (T-leads).

**US-04 · Browse case studies** — R1 — D-803
As a Visitor, I want a case-study grid and detail pages so that I can judge CodeKraft's proof of work.
- Given `/projects`, When rendered, Then published case studies appear as cards; Given `/projects/[slug]`, Then problem, solution, tech stack, results and images render server-side with JSON-LD Article.

**US-05 · Submit an inquiry without logging in** — R1 — BR-03, D-808, D-1204
As a Visitor, I want to send an inquiry from the contact page or a chapter CTA.
- Given the inquiry form, When I submit valid name, email and message with an invisible captcha pass, Then a lead is created in `new`, I see a confirmation, and admins get an in-app notification.
- Given the captcha fails or the per-IP rate limit is exceeded, When I submit, Then the form shows an error and no lead is created.
- Given the contact page, When rendered, Then no public email, phone, WhatsApp or social link is shown.

**US-06 · Read product blogs** — R1 — D-121, D-804
As a Visitor, I want product blogs at `/blog/[slug]` and an index at `/blog`.
- Given a product with a published blog (T-product_blogs), When I open `/products/[slug]`, Then the blog renders as a card below all product details; When I open `/blog/[slug]`, Then the full article renders with its own metadata and canonical URL.

**US-07 · Read legal pages and switch theme** — R1 (Theme 2: V1.1) — D-807, D-905, D-1602
As a Visitor, I want privacy, terms, refund and license pages, and a theme toggle.
- Given `/legal/{privacy|terms|refunds|license}`, When rendered, Then the latest published version of the page (T-legal_pages) is shown.
- Given the `theme_light_editorial` flag is off, When I look for the theme toggle, Then it is hidden or shows Theme 1 only; Given the flag is on, When I toggle, Then the choice persists per device and, when logged in, per account (`users.theme_pref`).

### 5.2 Authentication and sessions

**US-08 · Register with email and verify** — R1 — D-1201, BR-03
As a Visitor, I want to create an account with email and password and verify it before buying.
- Given a valid email and password, When I register, Then an account is created with `email_verified = false` and a verification link is emailed.
- Given an unverified account, When I click "Buy now", Then checkout is blocked with a "verify your email" prompt and a resend option.
- Given the verification link is used, When it is valid and unexpired, Then `email_verified = true` and I am signed in.

**US-09 · Sign in with Google** — R1 — D-1201
As a Visitor, I want one-click Google sign-in that is pre-verified.
- Given Google returns a verified email, When the account does not exist, Then it is created with `email_verified = true`; When it exists, Then the Google account is linked and I am signed in.

**US-10 · Reset password and manage sessions** — R1 — D-1201, D-1203
As a Customer, I want a reset link and a single active session.
- Given I request a reset, When the email exists, Then a single-use link expiring in 60 minutes (proposed) is sent; the response is identical when it does not exist.
- Given I log in on device B, When device A is still logged in, Then device A's session is deleted (T-sessions) and its next request redirects to login.
- Given 60 minutes of inactivity, When I act, Then I am asked to log in again.

**US-11 · Phone OTP login (flagged)** — V1.1 — D-1603, R-1201
As a Customer, I want to log in with a phone OTP once SMS is budgeted.
- Given `phone_otp` is off, When I open `/auth/otp`, Then it is not offered; Given it is on and an SMS provider is configured, When I request an OTP, Then a 6-digit code valid for 5 minutes (proposed) is sent, rate-limited per phone and IP.

**US-12 · Admin login with optional TOTP** — R1 — D-1202, D-1203, A-1201
As a Super Admin, I want to log in on the admin host (`admin.<domain>`; during the interim a second `*.vercel.app` hostname matched exactly by `ADMIN_HOST`) with optional authenticator 2FA.
- Given TOTP is enabled on my account (T-two_factor), When I enter a correct password, Then I must enter a valid TOTP or backup code before any admin page loads.
- Given `admin.<domain>`, When a user without an admin role logs in, Then they see 403 and an audit row is written.
- Given 30 minutes idle, When I act, Then I must re-authenticate.

### 5.3 Catalog and discovery

**US-13 · Browse, filter, sort and search products** — R1 — D-310, A-303, A-304
As a Visitor, I want to find products by category, price, purchase model, delivery type, tech stack, industry and audience.
- Given `/products`, When I apply filters, Then only `published`, non-unlisted products matching all filters appear, sorted by newest / price asc / price desc / most popular / featured.
- Given a search term, When I search, Then results come from `products.search_vector` (T-products) and cover products only.

**US-14 · View a product page** — R1 — D-309, D-312, D-313, D-805, A-1301
As a Visitor, I want a rich product page with media, content, FAQs, testimonials and version history.
- Given a published product, When I open `/products/[slug]`, Then it renders server-side with description, features, benefits, audience, use cases, industry, tech stack, requirements, FAQs, curated testimonials, images, gallery, embedded or uploaded video, inline PDF presentation, optional "Try live demo" (new tab), current version and changelog (T-product_versions), and JSON-LD Product.
- Given an `is_coming_soon` product, When rendered, Then no "Buy now" appears; Given `is_unlisted`, Then it is reachable by URL but absent from listings, search and sitemap.
- Given any product page, When rendered, Then no partner or owner name is shown (BR-02).

**US-15 · See offerings and prices in my currency** — R1 — A-301, D-502, D-518, D-408
As a Customer, I want each offering's price in my display currency with any sale price shown.
- Given an offering with a base-currency price, When my display currency has no explicit row in T-offering_prices, Then the price converts via the latest T-fx_rates row and is labelled "approx."; When an explicit row exists, Then it is shown as-is.
- Given `compare_at_minor` is set, When rendered, Then the original price is struck through beside the sale price.
- Given checkout, When the order is created, Then it is charged in the base currency regardless of display currency.
- Given I am a Visitor, When I pick a display currency, Then it is stored in a cookie; When I log in, Then `users.display_currency` is loaded, and saving it refreshes the cookie (MASTER_SPEC §7 "Visitor currency selector").

**US-16 · Save products to a wishlist** — R1 — D-311
As a Customer, I want to save products for later.
- Given I am logged in, When I click the wishlist icon, Then a row is upserted in T-wishlists and the dashboard Wishlist section lists it; Given I am a Visitor, When I click, Then I am prompted to log in.

**US-17 · Request customisation from a product page** — R1 — D-315, D-704
As a Visitor, I want to ask for a customised version of a product.
- Given a product page, When I submit "Request customisation / Talk to us", Then a lead is created with `source = product_cta` and `product_id` set, and admins are notified in-app.

### 5.4 Checkout and payment (manual UPI / bank)

**US-18 · Buy now** — R1 — MASTER_SPEC §7, ADR-12, D-204, BR-03
As a Customer, I want to buy one offering without a cart.
- Given I am logged in and verified, When I click "Buy now" on an offering with `purchase_model ≠ custom_quote`, Then an order of type `product` with exactly one item at quantity 1 is created in `pending_payment` with `expires_at = now + 7 days` and I land on checkout.
- Given I am a Visitor, When I click "Buy now", Then I am sent to login and returned to the same offering afterwards.

**US-19 · Enter checkout details** — R1 — D-410
As a Customer, I want to give billing details once and have them remembered.
- Given checkout, When I submit, Then full name, email and country are required; company, billing address and GST number are optional; values are stored in `orders.billing_snapshot` and defaulted from T-customer_profiles next time.

**US-20 · Choose a payment method enabled for the offering** — R1 — D-110, D-402
As a Customer, I want to see only the methods the admin enabled for this offering.
- Given an offering with methods {manual_upi, manual_bank} (T-offering_payment_methods), When I reach payment, Then only those methods are shown; a gateway method whose feature flag is off is never shown.

**US-21 · Pay by static UPI QR and submit the reference** — R1 — D-501, D-411
As a Customer, I want a QR with the exact amount and a place to submit my UTR.
- Given I choose UPI, When the payment page loads, Then a QR encodes `upi://pay?pa=<vpa>&pn=CodeKraft&am=<amount>&cu=INR&tn=<order_no>` from `site_settings.upi_vpa`, and a payment row is `initiated` (T-payments).
- Given I enter a transaction reference, When I submit, Then the payment becomes `submitted` with `customer_reference` and `customer_submitted_at`, admins get an in-app "payment awaiting confirmation" notification, and I see "awaiting confirmation" on the order page.

**US-22 · Pay by bank transfer** — R1 — D-501, D-402
As a Customer, I want the bank details and the same reference flow.
- Given I choose bank transfer, When the payment page loads, Then account name, number, IFSC (and SWIFT if configured) from `site_settings.bank_details` are shown with the order number as the required narration; the rest matches US-21.

**US-23 · Order expiry, duplicates and retry** — R1 — BR-10, D-412, D-413, D-416
As a Customer, I want clear rules on unpaid orders.
- Given an order in `pending_payment` when `expires_at` passes with no confirmed payment (including after an admin marked my reference invalid and I did not retry), When the expiry cron runs, Then the order becomes `failed` with reason "expired" and I am emailed; `cancelled` is reserved for a cancel by me or an admin (MASTER_SPEC §7 "Order failed").
- Given I already hold a `paid` order for a `one_time` offering, When I click "Buy now" on it again, Then I am told I already own it and linked to my dashboard (T-user_offering_purchases).
- Given a payment marked `failed` by an admin, When I open the order page before expiry, Then I can retry with a new payment attempt on the same order.

**US-24 · Apply a coupon** — R1 — A-401, D-409
As a Customer, I want to apply a coupon code at checkout.
- Given an active coupon within `starts_at..ends_at`, under `max_redemptions`, valid for this product and (if `first_purchase_only`) my first paid order, When I apply it, Then `discount_minor` is recomputed (percent = bps of subtotal; fixed = minor units in order currency) and the total updates.
- Given the coupon is invalid for any reason, When I apply it, Then a specific reason is shown and the order is unchanged.
- Given the coupon expires or hits its limit between apply and admin confirmation, When the admin confirms, Then the discount already locked on the order stands (redemption recorded at order creation, T-coupon_redemptions).

**US-25 · Accept and pay a custom quote** — R1 — D-520
As a Customer, I want to pay a negotiated private offer via a link.
- Given a quote in `sent` with a valid token and unexpired `expires_at` (T-custom_quotes), When I open `/quote/[token]` while logged in as the addressed customer (`custom_quotes.customer_id`), Then I see the title, description and price and can accept; on accept an order is created with `custom_quote_id` and the quote becomes `accepted`.
- Given the link is opened logged out, When loaded, Then I am asked to sign in (BR-03); Given it is opened by a different account, Then the quote is shown read-only with a "sign in as the invited customer" prompt and no order is created; Given it has expired, Then it shows as expired (MASTER_SPEC §7 "Custom quote pay link").

**US-26 · Receive an invoice** — R1 — BR-16, D-414, D-1501
As a Customer, I want a PDF invoice for every paid order.
- Given an order becomes `paid`, When the invoice is issued, Then it is numbered CK/<FY>/<seq> gaplessly per Indian financial year (T-invoice_sequences), in the name "CodeKraft", showing my GST number if given, with CGST/SGST/IGST breakdown only when `site_settings.gstin` is set; the PDF is stored in R2, emailed and downloadable from the dashboard.
- Given a `tax_enabled` product and no GSTIN in settings, When the order is priced and invoiced, Then tax is treated as 0 and the invoice carries no tax lines (BR-08, MASTER_SPEC §7 "Tax before GST registration").

### 5.5 Delivery

**US-27 · Receive SaaS / hosted access** — R1 — D-601, A-602
As a Customer, I want my account credentials after manual provisioning.
- Given a `paid` order with `delivery_type ∈ {saas, hosted}`, When the entitlement is created, Then it is `active` with `provisioning_state = pending` and a `provision` task is opened for admins (T-delivery_tasks); When the admin marks provisioning done with notes, Then I receive an email and the dashboard shows the instructions and access details.

**US-28 · Download a purchased file** — R1 — BR-15, D-602, D-606
As a Customer, I want secure downloads counted against a cap.
- Given an `active` entitlement with `downloads_used < download_cap` (or cap null), When I click download, Then a 5-minute presigned R2 link tied to my user is issued, a T-downloads row is written and `downloads_used` increments.
- Given the cap is reached, When I click download, Then I see "download limit reached — contact support" with a one-click query creation; no link is issued.
- Given the entitlement is `expired`, `suspended` or `revoked`, When I open the dashboard, Then download buttons are hidden.

**US-29 · Receive a license key** — R1 — D-603, D-406, D-1002
As a Customer, I want my key in the dashboard and by email.
- Given a `license` entitlement, When the admin enters the key, Then it is stored encrypted (`license_key_enc`), shown masked with a reveal control in the dashboard, and the email plus in-app notification carry a link to the dashboard — the key itself is never placed in the email (no SMS; founder may relax to plaintext email) (MASTER_SPEC §7 "License key delivery").

**US-30 · Track a product + service checklist** — R1 — D-608
As a Customer, I want to see service progress.
- Given a `service` entitlement with `service_steps` on the offering, When the admin ticks a step, Then T-service_progress records it and my dashboard shows n/m done; When all steps are done, Then the order becomes `fulfilled` automatically.

**US-31 · Custom delivery instructions** — R1 — A-601
As a Customer, I want post-purchase instructions for custom deliveries.
- Given a `custom` entitlement, When the order is `paid`, Then the offering's `instructions_json` (fallback product-level text) appears on the order page and in the confirmation email; the order becomes `fulfilled` when the admin marks it.

**US-32 · Access period and updates** — R1 — D-604, D-605
As a Customer, I want to know when access ends and which versions I may download.
- Given `access_ends_at` is set, When it passes, Then the entitlement becomes `expired` by cron and downloads hide; Given `update_policy = all_free`, When a new T-release_files row is released, Then it is downloadable; Given `during_access`, Then only files released before `access_ends_at`; Given `major_paid`, Then only files whose major version equals the purchased version.

**US-33 · Revocation on refund or chargeback** — R1 — D-607, BR-09, D-416
As an Admin, I want revocation to be automatic where the platform controls the asset.
- Given a refund is applied, When the entitlement is a download or license, Then it becomes `revoked` immediately and keys are hidden; When it is an external SaaS/hosted account, Then a `revoke_external` task is created and an email reminder sent to admins until it is done.

### 5.6 Subscriptions (manual renewal)

**US-34 · Be reminded and renew** — R1 — BR-14, D-1004, D-521
As a Customer, I want a reminder and a way to pay the renewal.
- Given a subscription with `current_period_end` in 7 days (proposed), When the cron runs, Then a reminder email + in-app notification is sent once (`reminder_sent_at`) and the dashboard shows the due date.
- Given I click "Renew", When the renewal order is created, Then it uses the same offering, the enabled methods and the manual flow of US-21/US-22, with `expires_at` equal to the subscription's `grace_until` (MASTER_SPEC §7 "Renewal order expiry"); When the admin confirms, Then `current_period_start/end` roll forward by one interval and status returns to `active`.

**US-35 · Grace and suspension** — R1 — BR-14, D-521
As a Customer, I want 7 days of grace before losing access.
- Given `current_period_end` passes unpaid, When the cron runs, Then subscription status becomes `past_due`, `grace_until = period_end + 7 days`, and the entitlement stays `active`; Given `grace_until` passes unpaid, Then status becomes `suspended`, the entitlement becomes `suspended`, and downloads/access hide until a renewal is confirmed.

**US-36 · Cancel at period end** — R1 — BR-14
As a Customer, I want to cancel without losing the paid period.
- Given an `active` subscription, When I cancel from the dashboard, Then `cancel_at_period_end = true`, no further reminders are sent, and at `current_period_end` the status becomes `cancelled` and the entitlement `expired`; no proration or refund is offered.

### 5.7 Customer dashboard

**US-37 · See purchases and access** — R1 — D-1001
As a Customer, I want one place for orders, entitlements, downloads, keys, subscription status, service progress and instructions.
- Given `/account`, When loaded, Then each order shows status, payment status and next action (submit reference / awaiting confirmation / download / renew), polling every 30 s for changes.

**US-38 · See invoices and payment history** — R1 — D-1001, D-414
- Given `/account/invoices`, When loaded, Then every invoice and credit note is downloadable and every payment attempt shows method, reference, amount, status and confirmation time.

**US-39 · Manage settings, security and notifications** — R1 — D-111, D-905, D-1203
- Given `/account/settings`, When I change display currency or theme, Then prices and theme update immediately and persist; Given `/account/security`, When I change my password, Then all other sessions end; Given `/account/notifications`, When loaded, Then unread in-app notifications are listed with mark-as-read.

**US-40 · Delete my account** — R1 — BR-18, D-1003
- Given I confirm deletion, When submitted, Then my session ends, `users.status = deleted`, `deleted_at` and `anonymized_at` are set, and personal fields are anonymised immediately in the same transaction (no grace window) while orders, invoices, ledger and audit rows are retained 7 years (BR-18, MASTER_SPEC §7 "Anonymisation timing"); Given I have an `active` subscription, When I try to delete, Then I am warned that access ends immediately.

### 5.8 Queries (support)

**US-41 · Open a query** — R1 — D-702, D-1002
As a Customer, I want to ask for help about an order or product and see replies.
- Given the dashboard or an order page, When I submit a query, Then a T-queries row is `open` with source `dashboard` or `order`, admins are notified in-app, and the thread appears under Queries & Conversations.
- Given a `paid` order, When I click "Request refund" and give a reason, Then a query with source `order` flagged as a refund request is opened (at most one open refund query per order; a second click shows the existing thread); the refund itself is never self-service (BR-09, MASTER_SPEC §7 "Refund request channel").

**US-42 · Reply in thread** — R1 — D-702, D-705
As an Admin, I want to claim and answer queries.
- Given an unassigned query, When I claim it, Then `assigned_to` is me; When I reply, Then the customer gets an email + in-app notification and the status becomes `waiting_customer`; When the customer replies, Then it returns to `open`; When I resolve, Then it becomes `resolved` and auto-closes after 7 days (proposed) without a customer reply.

### 5.9 Chatbot (hybrid)

**US-43 · Use quick-reply menus** — R1 — D-701, D-205
As a Customer, I want menu shortcuts for order status, downloads and contact.
- Given I am logged in, When I open the chatbot, Then menus "Order status", "My downloads", "Contact support" answer from my own data without calling the LLM; Given I am a Visitor, When I open the chatbot, Then I see a login prompt and a link to the inquiry form.

**US-44 · Ask a free-text question** — R1 — D-701, docs/04 §9
- Given I type a question, When the bot answers, Then the answer streams and is grounded only on T-knowledge_chunks (products, offerings, services, FAQs, legal, case studies); When the question is outside site content, Then the bot says so and offers escalation or menus.

**US-45 · Respect daily caps** — R1 — D-708
- Given the per-user daily cap or platform daily cap (`site_settings.ai_daily_*`) is reached (T-chat_usage_daily), When I send a free-text message, Then the bot replies from menus only and explains the limit; admins are notified once per day when the platform cap is hit.

**US-46 · Escalate to a human** — R1 — D-702, D-704
- Given a conversation, When I choose "Talk to a human" or the bot cannot answer, Then a query is created with `source = chatbot` and `conversation_id`, the transcript is attached, and admins are notified; Given the bot detects project intent, When I confirm, Then a lead with `source = chatbot` is created.

### 5.10 Leads pipeline

**US-47 · Work the shared pool** — R1 — D-705, D-704
As a Super Admin, I want new leads in one pool that anyone can claim or assign.
- Given a new lead from any source, When it arrives, Then it is unassigned, visible to all admins, and highlighted as new; When I claim or assign it, Then `assigned_to` is set and a T-lead_activities row is written.

**US-48 · Move a lead through the pipeline** — R1 — D-703
- Given a lead, When I change status, Then only transitions New → Contacted → Qualified → Proposal → Won | Lost (and any → Lost) are allowed; Won requires optionally linking `won_order_id`; Lost requires `lost_reason`.

**US-49 · Notes and follow-ups** — R1 — D-706, R-701
- Given a lead, When I set `next_follow_up_at` and a note, Then it appears in my Overdue follow-ups widget once the date passes, and a daily digest email lists all overdue leads assigned to me.

**US-50 · Create a lead manually** — R1 — D-704
- Given the admin leads screen, When I add a lead by hand, Then `source = manual` and all pipeline features apply.

### 5.11 Admin catalog and approvals

**US-51 · Create a product with offerings** — R1 — A-301, D-303, D-304, D-110, D-601–D-608
As a Super Admin, I want to author a product and one or more offerings.
- Given the product form, When I save, Then the product is `draft` with slug, category (≤ 2 levels), tags, content blocks, flags and SEO fields; When I add an offering, Then purchase model, billing interval (subscription only), trial days, license type, delivery type and its config, service steps, prices per enabled currency (base mandatory), compare-at price, enabled payment methods, access months, update policy, download cap and instructions are captured (T-offerings, T-offering_prices, T-offering_payment_methods).

**US-52 · Upload media** — R1 — D-309, D-805, A-1202
- Given the media panel, When I upload an image, video file, PDF or attachment, Then type and size are validated, a presigned PUT to R2 is issued, and a T-media + T-product_media row is recorded; When I paste a YouTube/Vimeo URL, Then a `video_embed` row is created.

**US-53 · Set ownership and split** — R1 — BR-05, BR-06, BR-07, D-508, D-509
- Given a product, When I propose company cut and partner shares summing to 10000 bps, Then a T-product_ownerships row is `pending` and an `ownership.change` approval request is created; When every other active admin approves, Then it becomes `active` with `effective_from = now` and the previous version `superseded`; sales before `effective_from` keep their allocations.

**US-54 · Submit for publish and approve** — R1 — BR-12, D-1102, A-302, D-307
- Given a `draft` product with ≥ 1 active offering, a base price and an active ownership, When I submit, Then the status is `pending_approval` and a `product.publish` request is created; When the other admin approves, Then the product becomes `published` (or `scheduled` if `publish_at` is in the future, then `published` by cron) and `revalidateTag` runs; When I try to approve my own request, Then it is refused.

**US-55 · Unpublish, archive or delete** — R1 — BR-11, D-308, D-1105
- Given a published product, When I unpublish, Then it is `unpublished` immediately (not approval-gated); When I request archive, Then a `product.archive` approval is required; When I request delete on a product with zero orders, Then a `product.delete` approval is required and, once applied, the product and its offerings are removed; When it has orders, Then delete is unavailable and archive is offered.

**US-56 · Work the approvals inbox** — R1 — A-1101, BR-13, D-1105
- Given `/admin/approvals`, When loaded, Then pending requests of all nine types (`product.publish`, `ownership.change`, `ledger.adjustment`, `refund.issue`, `payout.record`, `product.archive`, `product.delete`, `admin.user_change`, `project_order.split`) show type, requester, payload diff and age; When I approve or reject with a comment, Then a T-approval_decisions row is written, and on the final required approval the module's apply runs in one transaction and the request becomes `applied` (or `error` text is stored and status remains `approved` for retry).

### 5.12 Orders, payments and manual orders

**US-57 · Confirm a manual payment** — R1 — D-501, D-516, D-411
As the CFO, I want to confirm a submitted payment and record what actually arrived.
- Given a `submitted` payment, When I confirm with `amount_received_minor`, Then `bank_shortfall_minor = max(0, amount_due − amount_received)` and any excess is stored as `customer_credit_minor` (shown to admins, never allocated to partners), the payment becomes `confirmed` and immutable (its only later transition is `confirmed → refunded`), the order becomes `paid`, the invoice is issued, entitlements are created, ledger entries and allocations post, and the customer is emailed — all in one transaction.
- Given the reference does not match my bank statement, When I mark it `failed` with a reason, Then the customer is notified and may retry; the order stays `pending_payment` and becomes `failed` only when `expires_at` passes without a confirmed payment (MASTER_SPEC §7 "Order failed").

**US-58 · Fulfil an order** — R1 — D-601, D-603, D-608
- Given a `paid` order, When every entitlement's delivery is complete (provisioning done, key entered, checklist complete, or custom marked done; downloads are complete on creation), Then the order becomes `fulfilled` and `fulfilled_at` is set.

**US-59 · Create a manual order or project invoice** — R1 — D-1107, D-510, A-502
As a Super Admin, I want to invoice a client project or record an offline sale through the same model.
- Given the manual order form, When I choose type `project`, Then I enter client name/email/company (or pick a customer), free-form line items with amounts, optional product link per line for split purposes, and tax; and each project line carries a `split_snapshot` (company cut + partner shares) that I set, which creates a `project_order.split` approval request; Given the other admins have approved the split, When I record the payment received, Then the order follows the same `paid` path with invoice numbering from the same sequence and ledger allocation from the snapshot exactly like a product ownership version; Given the split is not yet approved, Then the order cannot be invoiced or paid (MASTER_SPEC §7 "Project order splits").

**US-60 · Issue a refund** — R1 — BR-09, D-505, D-415, D-1105
- Given a `paid` order whose product is `is_refundable` and whose payment provider is manual, When I request a full or partial refund with a reason, Then a `refund.issue` approval is created; When approved and applied, Then a T-refunds row, a credit note, proportional `refund_*` ledger entries (sale, discount, tax, company cut, partner allocations; gateway fees and bank charges are never reversed) and entitlement revocation are written, `payments.amount_refunded_minor` is updated, the payment flips `confirmed → refunded` when fully refunded (the only permitted post-confirmation transition), and the order becomes `refunded` or `partially_refunded`.
- Given the product is not refundable or the payment was by gateway, When I try, Then the action is unavailable with the reason shown.

### 5.13 Finance: ledger, payouts, expenses, reports

**US-61 · View the ledger and partner balances** — R1 — D-511, D-515, BR-17
As the CFO, I want an append-only journal with running balances.
- Given `/admin/finance/ledger`, When loaded, Then entries are listed newest first with type, order, party, amount, currency, FX rate and INR equivalent, filterable by partner, product, type and period; no edit or delete control exists.
- Given `/admin/finance/partners`, When loaded, Then each partner's balance = Σ allocations − Σ refund reversals − Σ payouts − Σ expense share, per currency and in INR.

**US-62 · Record a payout** — R1 — D-511, D-1105
- Given a partner with a positive balance, When I record a payout (date, amount, reference, note) not exceeding that balance, Then a `payout.record` approval is created; Given the amount exceeds the current balance, Then it is rejected (MASTER_SPEC §7 "Payout > balance"); When approved, Then a T-payouts row and a `payout` ledger entry post and the balance reduces.

**US-63 · Record an expense** — R1 — D-514
- Given the expense form, When I save category, description, amount, date, optional product and receipt, Then an `expense` entry posts; When `shared_by_split` is true and a product is linked, Then the expense reduces each partner's balance by the product's active split; otherwise it is company-only.

**US-64 · Post a ledger adjustment** — R1 — BR-17, D-517
- Given a correction is needed, When I propose an adjustment (party, amount, memo), Then a `ledger.adjustment` approval is created; When approved, Then an `adjustment` entry posts referencing the request; the original entry is never modified.

**US-65 · Run reports and statements** — R1 — D-513
- Given `/admin/finance/reports`, When I choose a period, Then I get revenue by product, by partner, by period, tax collected, refunds and outstanding payouts, in INR with transaction-currency detail; When I export a partner statement, Then a PDF and a CSV are generated for the period.

### 5.14 Content editing

**US-66 · Edit site content without a developer** — R1 — D-1106
As a Super Admin, I want to edit landing chapters, services, case studies, testimonials, client logos, FAQs and legal pages.
- Given any content screen, When I save, Then the change is audited and the public page revalidates within 60 s; When I publish a legal page, Then its `version` increments and `published_at` is set.

**US-67 · Write a product blog** — R1 — D-121, D-804
- Given a product, When I create its blog with title, excerpt, cover and rich body, Then it is `draft` until published; When published, Then `/blog/[slug]` and the product page card appear and the blog index and landing teasers update.

### 5.15 Widget dashboard

**US-68 · Arrange my admin dashboard** — R1 — D-120, D-1101
As a Super Admin, I want to pick and arrange widgets from a library of 18–20.
- Given `/admin`, When I add, remove, drag or resize widgets, Then my layout persists in T-dashboard_layouts and is independent of the other admin's; When loaded, Then each widget fetches its own data and shows only data my permissions allow.
- Given widgets in groups Sales & revenue, Operations queue, Leads & queries, Traffic & engagement, Catalog & content, Customers, System/AI health, When the library opens, Then all are listed with a preview.

### 5.16 Notifications

**US-69 · Customer notifications** — R1 — D-1002, D-1604
- Given an event (payment submitted/confirmed/failed, order fulfilled, key delivered, renewal reminder, suspension, query reply, refund), When it occurs, Then an in-app notification is written and an email queued in T-email_outbox; When `whatsapp_channel` is on (V1.1), Then WhatsApp is also attempted.

**US-70 · Admin real-time inbox** — R1 — D-707, D-015
- Given a new admin-relevant event (payment awaiting confirmation, new lead, new query, approval pending, provisioning task, revoke task, AI cap hit, cron failure), When it is written, Then the admin shell shows a badge and toast within 10 s and the inbox keeps it until read; no email, SMS or push is sent except the daily overdue-follow-up digest (US-49).

### 5.17 Settings, customers, audit

**US-71 · Configure platform settings** — R1 — D-502, D-504, D-1501, D-905, D-708, docs/04 §7.9
- Given `/admin/settings`, When I edit base currency, tax rate, GSTIN, seller details, UPI VPA, bank details, enabled payment methods, default theme, AI model and caps, retention days or feature flags, Then the change is audited and takes effect without redeploy; When I set a GSTIN, Then subsequent invoices use the GST format; Given any paid order exists, When I try to change the base currency, Then the field is read-only (MASTER_SPEC §7 "Base currency lock").

**US-72 · Manage a customer** — R1 — D-1108, D-1003
- Given a customer record, When I add notes/tags, suspend, manually grant or revoke an entitlement (`granted_manually_by`, `order_item_id` null, a mandatory reason, the other admins notified in-app, no order, invoice, ledger entry or allocation), or send a reset / one-time login link, Then each action is audited and the customer is notified where applicable; a suspended customer cannot log in (MASTER_SPEC §7 "Manual entitlement grants").

**US-73 · Review the audit log** — R1 — D-1104
- Given `/admin/audit`, When I filter by actor, action, subject or period, Then matching rows show actor, timestamp, before/after JSON, IP and user agent; When I export, Then a CSV is produced; no row can be edited or deleted.

**US-74 · Invite or change an admin** — R1 — D-1105, D-512, D-114
- Given the admin users screen, When I invite a partner, remove an admin or change a role, Then an `admin.user_change` approval is created; When applied, Then T-user_roles and T-partners update; Given the change would leave fewer than two active admins, When I submit, Then the screen warns that dual-approval actions cannot be executed until a second active admin exists (MASTER_SPEC §7 "Approver set"); removing the last `super_admin` is refused.

### 5.18 Gateway and later releases

**US-75 · Pay by card / netbanking / PayPal** — V1.1 — D-501, A-402
- Given `provider_razorpay` is on and the offering enables it, When I pay, Then the gateway handles collection, the webhook confirms the payment and gateway fee, and order/ledger code is unchanged from release 1.

**US-76 · Buy a bundle** — V1.1 — D-417
- Given a bundle offering, When I buy it, Then one order with several items and one entitlement per item is created.

**US-77 · Automated provisioning and license API** — V2 — D-601, D-1608
- Given `automated_provisioning` is on for an offering, When the order is `paid`, Then the adapter provisions access and the license validation API answers key checks.

## 6. Explicitly rejected features

Not to be built or proposed again without a new decision (baseline §20).

| ID | Rejected | Decision |
|----|----------|----------|
| X-001 | Guest checkout | D-204 |
| X-002 | Anonymous chatbot | D-205 |
| X-003 | Customer 2FA | D-208 |
| X-004 | Team seats / multi-user customer accounts | D-206 |
| X-005 | Founder / team showcase | D-103 |
| X-006 | Product comparison | 3.8b |
| X-007 | Public reviews / ratings | D-312 |
| X-008 | Related-products section | 3.10d |
| X-009 | Company-level (non-product) blogs | D-804 |
| X-010 | Per-service detail pages | D-806 |
| X-011 | Public email / phone / WhatsApp / social links | D-808 |
| X-012 | Email / SMS / WhatsApp / push admin alerts | D-707 |
| X-013 | Live-chat widget with admin presence | D-702 |
| — | GA4 analytics | D-1301 |
| — | Theme 2 as a dark variant | D-903 |
| — | Multi-item cart in release 1 | MASTER_SPEC §7, ADR-12 |
| — | Self-service refunds (the order page only opens a refund *request* query) | BR-09, MASTER_SPEC §7 |
| — | Monthly AI spend cap (daily caps only) | D-708 |

## 7. Story-to-release summary

| Priority | Stories |
|----------|---------|
| R1 | US-01–US-10, US-12–US-74 (Theme 2 part of US-07 excluded) |
| V1.1 | US-11, US-07 Theme 2, US-75, US-76 |
| V2 | US-77 |

## 8. Open inconsistencies

All six items are resolved by `MASTER_SPEC.md` §7 and applied above.

| # | Resolution |
|---|------------|
| 1 | Resolved: approver set = every active `super_admin`/`admin` except the requester (MASTER_SPEC §7 "Approver set"); US-53/US-56/US-74 use it, and the admin-users screen warns below two active admins. |
| 2 | Resolved: confirmed payments allow exactly one later transition, `confirmed → refunded`, plus `amount_refunded_minor` (MASTER_SPEC §7 "Payment immutability", docs/05 §12); US-60 updated. |
| 3 | Resolved: docs/04 §7.4 no longer lists `required_approver_role`; approvers are derived at decision time (docs/05 T-approval_decisions). US-56 unchanged. |
| 4 | Resolved: R-701 is a daily overdue-follow-up digest email (MASTER_SPEC §7, docs/03 FR-NOTIF-04); US-49 stands. |
| 5 | Resolved: an order becomes `failed` only when `expires_at` passes with no confirmed payment (MASTER_SPEC §7 "Order failed"); US-23/US-57 updated. |
| 6 | Resolved: license keys are revealed only in the dashboard; email and in-app carry a link (MASTER_SPEC §7 "License key delivery"); US-29 updated. |

# 13 — ROADMAP

**Implements:** baseline §17 (scope), §18 (risks), §19 (assumptions); MASTER_SPEC §5 (scope summary), §4.11 (feature flags); D-1602, D-1603, D-1604, D-1605, D-1606, D-1607, D-1608; D-417, D-501, D-601; R-102, R-103, R-401, R-501, R-502, R-801, R-1001, R-1201, R-1401, R-1402.
**Depends on:** `docs/04-SOLUTION-ARCHITECTURE.md` §7.1 (provider interface), §7.9 (flags), §11 (portability); `docs/12-DEVOPS-DEPLOYMENT.md` (environments, launch mechanics, hosting migration); `docs/09-SECURITY-DESIGN.md` §15 (V1.1/V2 security deltas).
**Feeds:** `implementation/IMPLEMENTATION-MASTER-PLAN.md` (phase sequencing inside Release 1), `docs/02-PRD.md` (release column per user story).

Scope is fixed by the approved baseline: **Release 1 = everything discovered except Theme 2** (D-1602). This document does not add or remove scope; it orders it, states what each release depends on, and defines when a release may start and ship.

---

## 1. Release overview

| Release | Content (one line) | Tag | Hosting | Entry gate | Exit gate |
|---------|--------------------|-----|---------|------------|-----------|
| **Release 1** | Baseline §17 in full minus Theme 2: story landing with 3D hero, Theme 1, catalog + product pages + blogs, case studies, services, inquiry forms, auth (email/Google), checkout with manual UPI/bank confirmation, coupons, custom quotes, all delivery types (manual provisioning), invoices/credit notes, ledger with splits/company cut/expenses/payouts/reports, project invoicing, dual approvals, audit, widget dashboard, leads/queries, hybrid AI chatbot with caps, customer dashboard, wishlist, admin content editing, analytics, CI suites | `v1.0.0` | Vercel Hobby (D-1606) | §3.1 | §3.3 |
| **V1.1** | Theme 2 Light editorial enabled (toggle, posters/imagery, QA — its token CSS already ships in Release 1); Razorpay then Stripe/PayPal through the provider abstraction; phone OTP (flag on) once SMS is budgeted; WhatsApp if cost accepted; purchased hosting migration (the domain is bought for Release 1, E-06); bundles | `v1.1.x` (one tag per item) | Vercel → VPS during this release | §4.1 | per item |
| **V2** | External vendor marketplace; employee MIS + SSO; automated payouts + accounting export; automated SaaS provisioning + license validation API; tier-upgrade proration; automated recurring billing; foreign tax collection; self-hosted video transcoding | `v2.x` | VPS | §5.1 | per item |

## 2. What "launch" means

| Aspect | Release 1 launch (interim, D-1606) | After V1.1 hosting item (D-1401) |
|--------|-------------------------------------|----------------------------------|
| Host | Vercel Hobby, projects `codekraft` + `codekraft-staging` (docs/12 §2) | VPS + Docker + Caddy (docs/12 §9) |
| Public URL | `<domain>` — the domain is purchased and DNS-verified before launch (E-06, MASTER_SPEC §7 "Domain before launch"); `codekraft.vercel.app` is only the pre-launch hostname | `<domain>` |
| Admin URL | `admin.<domain>` (exact `ADMIN_HOST` match; `codekraft-admin.vercel.app` only before the domain exists) | `admin.<domain>` |
| Payments | manual UPI QR + bank transfer, admin-confirmed (D-501) | + Razorpay (V1.1) |
| Commercial use | accepted risk on Hobby ToS (R-1401) until the first paid order or the migration, whichever first | none |
| Email | Resend on a verified domain (docs/12 §7) | same |
| Definition of "live" | `v1.0.0` deployed by `release.yml`, smoke checklist docs/12 §9.5 green, uptime monitor on, founders' final manual check done (D-1607), `site_settings.launched_at` set (unlocks Umami script and sitemap `lastModified`) | same, plus DNS cutover complete |

## 3. Release 1

### 3.1 Entry criteria (before the first implementation phase starts)

| # | Criterion | Owner | Source |
|---|-----------|-------|--------|
| E-01 | Baseline approved; docs 01–13 written; diagrams and `ui/` present; `implementation/` phases generated | orchestrator | D-022 |
| E-02 | Accounts created and keys in the founders' password manager: GitHub org, Vercel, Neon, Cloudflare (R2 + Turnstile), Resend, Anthropic (credits + spend cap), Umami Cloud, Sentry, Google Cloud OAuth client, UptimeRobot | founder | docs/12 §2, §12 |
| E-03 | Both founders' admin emails, TOTP devices, and payout bank details (encrypted at rest) known for seed | founders | D-202, D-511 |
| E-04 | UPI VPA and bank account details for `site_settings` (D-501, D-511) | CFO | |
| E-05 | Content inputs: service copy (8 services, D-302), at least 3 case studies (D-117), legal page drafts (D-807), landing chapter copy (D-801), the five products' descriptions, media, offerings, splits | founders | D-1106 |
| E-06 | Domain purchased, on Cloudflare DNS and verified in Resend — **required**: Resend sends customer email only from a verified domain, and canonicals never change (MASTER_SPEC §7 "Domain before launch"; D-1401/D-1606 revised: domain now, hosting later) | founder | D-1502, docs/12 §7 |
| E-07 | Design system approved: logo direction, Theme 1 palette, font pairing (R-901 → premium-first) | founder | D-906 |

### 3.2 Work items, dependencies, and flags

Items are grouped by area; `Needs` lists the items that must exist first. IDs are release-local (`R1-xx`) and are what `implementation/` phases cite.

| ID | Item | Needs | Flag | Key IDs |
|----|------|-------|------|---------|
| R1-01 | Repo, tooling, CI skeleton (lint/typecheck/unit/build), Docker file, compose, env schema | — | — | D-1404, D-1607, docs/12 §3–§4 |
| R1-02 | Schema + migrations + triggers + seed (DB §1–§14) | R1-01 | — | MASTER_SPEC §4.1, §4.7 |
| R1-03 | Design tokens for both themes (Theme 2 token CSS ships as part of the token contract, MASTER_SPEC §7), Theme 1 posters/imagery, shadcn primitives, layout shells, theme toggle hidden behind the flag, ≤ 300-byte head script setting `data-theme` from cookie | R1-01 | `theme_light_editorial` (off) | D-011, D-902, D-905 |
| R1-04 | Auth: email+password with verification, Google, reset, sessions (single, idle), admin host isolation, TOTP; phone OTP UI + provider interface behind flag | R1-02, R1-03 | `phone_otp` (off) | D-1201–D-1204, A-1201 |
| R1-05 | RBAC + permissions + approval requests (nine types incl. `project_order.split`; approvers = all active admins except requester) + audit log | R1-02, R1-04 | — | A-1101, D-1104, D-1105, MASTER_SPEC §7 |
| R1-06 | Catalog: categories, products, offerings, prices, media upload (R2), FAQs, testimonials, versions/changelog, status lifecycle, scheduled publish | R1-02, R1-05 | — | A-301, A-302, D-303–D-315 |
| R1-07 | Ownership versions with dual approval | R1-05, R1-06 | — | BR-05, D-506–D-509 |
| R1-08 | Public site: story landing (2D scroll), services, products list/detail, case studies, blog, contact, legal; SEO (docs/11 Part A); ISR | R1-03, R1-06 | — | D-801–D-808, A-1301 |
| R1-09 | 3D hero (lazy, gated, poster fallback) | R1-08 | `three_hero` (on) | D-904, D-1605, docs/11 §B6 |
| R1-10 | Content CMS-lite in admin (chapters, services, case studies, testimonials, logos, FAQs, legal, product blogs) | R1-05, R1-08 | — | D-1106, D-121 |
| R1-11 | Commerce: single-offering checkout, billing details, coupons, custom quotes, order lifecycle, expiry cron | R1-04, R1-06 | — | D-410–D-413, A-401, D-520, ADR-12 |
| R1-12 | Payments: provider interface + `ManualProvider` (UPI QR, bank), customer reference submission, admin confirmation with shortfall | R1-11 | — | A-402, D-501, D-516 |
| R1-13 | Finance: ledger posting on paid, allocations, refunds/credit notes, payouts, expenses, adjustments, reports, statements, partner balances | R1-07, R1-12 | — | BR-06, BR-17, D-511–D-517 |
| R1-14 | Invoices: numbering per FY, PDF, GST-format switch on GSTIN | R1-12 | — | BR-16, D-414, D-1501 |
| R1-15 | Entitlements + delivery handlers (saas/hosted manual, download with signed links and caps, license revealed in dashboard with link-only email, service checklist, custom), manual grants (reason + notify, no ledger), revocation, subscriptions manual renewal/grace (renewal order expires at `grace_until`) | R1-12 | `automated_provisioning` (off) | A-602, D-601–D-608, D-521, MASTER_SPEC §7 |
| R1-16 | Manual/project orders and invoicing (project lines carry `split_snapshot`, approved via `project_order.split` before invoicing/payment) | R1-13, R1-14 | — | D-510, D-1107, A-502, MASTER_SPEC §7 |
| R1-17 | Customer dashboard (all D-1001 sections), wishlist, self-delete, currency/theme settings, FX | R1-15, R1-04 | — | D-1001–D-1004, D-502, D-518 |
| R1-18 | Leads + queries pipeline, inquiry forms with Turnstile, assignment, follow-ups, digest | R1-05, R1-08 | — | D-703–D-706, R-701 |
| R1-19 | Notifications: in-app polling inbox, email channel via outbox, WhatsApp channel stub behind flag | R1-05 | `whatsapp_channel` (off) | D-707, D-1002, D-1604 |
| R1-20 | Chatbot: menus, retrieval, `AnthropicProvider`, caps, escalation to query, prompt versions, transcript retention | R1-18, R1-19 | — | D-701, D-702, D-708, arch §9 |
| R1-21 | Widget dashboard: registry (20 widgets), per-admin layouts | R1-13, R1-18, R1-20 | — | D-120, D-1101 |
| R1-22 | Analytics: Umami, `analytics_events`, web-vitals ingestion, admin traffic widgets | R1-08 | — | D-1301, D-1302 |
| R1-23 | Settings screen (base currency, tax, GSTIN, payment methods, theme default, AI limits, retention, flags) | R1-05 | — | baseline §10.10 |
| R1-24 | Ops: `frequent`/`daily` cron endpoints + GitHub Actions scheduler workflow, backups workflow, health endpoint, Sentry, uptime, runbooks | R1-01, R1-02 | — | A-1401, docs/12, MASTER_SPEC §7 |
| R1-25 | Test suites: integration finance invariants, e2e critical paths, axe, Lighthouse CI, size-limit | all | — | D-1607, docs/10, docs/11 §B10 |
| R1-26 | Legal copy final (privacy incl. cookie line and AI-provider note, terms, refunds incl. gateway wording placeholder, license) | R1-10 | — | D-807, A-1501, R-502 |

Critical path (longest chain): R1-01 → R1-02 → R1-05 → R1-06 → R1-07 → R1-12 → R1-13 → R1-16 → R1-21 → R1-25. The implementation plan sequences for the **earliest usable increment** (MASTER_SPEC §7, R-101): increment A = R1-01…R1-08 (site + catalog visible), increment B = + R1-11…R1-15 (a customer can buy and be delivered), increment C = + R1-13, R1-16, R1-21 (finance and dashboard), increment D = + R1-18…R1-20, R1-22 (leads, chatbot, analytics), increment E = R1-09, R1-25, R1-26 hardening.

### 3.2a Release-1 increments (what each proves; none is a public release)

| Increment | Items | Proves | Verified by | Flags exercised |
|-----------|-------|--------|-------------|-----------------|
| A — Visible | R1-01…R1-08 | Public site renders from seeded catalog with SEO metadata, sitemap, ISR; Theme 1 tokens; auth works on both hosts | `lhci` on `/`, `/products/<slug>`; e2e "browse + register"; axe | `theme_light_editorial` off path |
| B — Sellable | + R1-11…R1-15 | A customer buys with UPI/bank, admin confirms, entitlement delivers for every delivery type, invoice PDF issued | e2e "buy → confirm → deliver → invoice" for all five seeded products; integration tests on order/payment state machines | `automated_provisioning` off path |
| C — Accountable | + R1-13, R1-16, R1-21, R1-23 | Ledger balances, refunds, payouts, expenses, project invoices; widget dashboard reads real data | finance property tests (allocation sums, immutability, gapless invoices); e2e "refund with dual approval" | — |
| D — Conversational | + R1-18…R1-20, R1-22 | Leads, queries, chatbot with caps and escalation, notifications, analytics events | e2e "inquiry → lead → follow-up digest"; chat cap test; vitals ingestion test | `whatsapp_channel` off path; `phone_otp` off path |
| E — Hardened | + R1-09, R1-24, R1-25, R1-26 | 3D hero within budgets, backups/restore, monitoring, full CI gates, legal copy | LHCI with 3D enabled on desktop profile; restore drill; SA-01…SA-18 | `three_hero` on/off |

### 3.3 Exit criteria (launch, `v1.0.0`)

| # | Criterion | Evidence |
|---|-----------|----------|
| X-01 | All required CI checks green on the tagged commit; e2e critical paths (register → buy → confirm → deliver → invoice → refund) pass | `ci.yml` run |
| X-02 | Lighthouse CI thresholds (docs/11 §B10) met on `/`, product, case study, blog on mobile emulation | `lhci` artifact |
| X-03 | Zero serious/critical axe violations; reduced-motion verified manually on `/` | `axe` job + founder check |
| X-04 | Finance invariants: property tests for allocation sums, append-only triggers, gapless invoice numbers | `integration` job |
| X-05 | Security acceptance SA-01…SA-18 (docs/09 §13) pass | test report |
| X-06 | Backup workflow ran ≥ 3 nights and one restore drill succeeded (docs/12 §5.3) | `docs/ops/restore-log.md` |
| X-07 | Production seed applied; both Super Admins can log in with TOTP; at least one product published through the dual-approval flow | audit log |
| X-08 | Uptime monitors and Sentry alerts confirmed by a test event | screenshots |
| X-09 | Founders' final manual check per D-1607 (checklist docs/12 §9.5) signed off by both | GitHub release notes |
| X-10 | Legal pages published; refund wording states manual-payment-only refunds (BR-09) and reserves gateway wording (R-502) | page review |

### 3.4 Release-1 risks

| Risk | ID | Mitigation in this plan |
|------|----|-------------------------|
| Scope vs days | R-103, R-501, R-801 (accepted) | increments A–E; anything after increment C can slip to a `v1.0.x` tag without changing scope |
| Manual payments, India-first | R-401 (accepted) | admin confirmation queue widget; Razorpay is V1.1 item 1 |
| Hobby ToS commercial use | R-1401 (accepted) | move on first paid order or migrate (§4.2) |
| 3D hero vs CWV | R-801, D-1303 | poster-first, gated, kill-switch flag; LHCI gate on `/` |
| Email without domain | MASTER_SPEC §7 "Domain before launch" | E-06 entry criterion (required) |
| Free-tier cold starts / limits | R-1402, arch §13 | ISR everywhere public; storage widget; runbook 11.7 |
| Two-admin approval stalls | BR-13 | no expiry; pending-age widget; out-of-band nudge |
| Anthropic key/spend | arch §9 | spend cap; menu fallback |
| GitHub Actions minutes during the build sprint | docs/12 §4.2 | reduced draft-PR pipeline; USD 4 fallback |

## 4. V1.1

### 4.1 Entry criteria

| # | Criterion |
|---|-----------|
| V-01 | `v1.0.0` live for ≥ 7 days with no P1 incident; error budget (docs/12 §8.1) not exhausted |
| V-02 | Legal entity or individual KYC status known (R-102) — gates gateway onboarding, not the code |
| V-03 | Founder decisions recorded: SMS provider budget (R-1201), WhatsApp cost (R-1001), VPS provider (docs/12 §9.1) |
| V-04 | Theme 2 palette/fonts approved against the design-system doc (D-903, D-906) |

### 4.2 Items, order and rationale

| Order | Item | Tag | Needs | Flag change | Why this position |
|-------|------|-----|-------|-------------|-------------------|
| 1 | **Razorpay** via `PaymentProvider` (UPI/cards/netbanking automated), webhook route, gateway fees in ledger (`gateway_fee` entry type already exists), refund wording update | `v1.1.0` | R1-12, R1-13, `webhook_events` (DB §11), KYC (R-102), R-502 copy | `provider_razorpay` off → on per product (D-110) | Highest revenue impact: removes the admin-in-the-loop step for every Indian order (R-401) and unblocks cards. Smallest code delta because the interface and ledger fee lines were built in Release 1 (A-402). Its only blocker is KYC, which the founders can start on launch day — so build while waiting, flip the flag when the account is live. D-501 explicitly places it "shortly after launch". |
| 2 | **Theme 2 Light editorial** — enable the toggle, produce Theme 2 posters/imagery, QA every screen (the token CSS already shipped in Release 1, MASTER_SPEC §7 "Theme 2 in release 1") | `v1.1.1` | R1-03 tokens, docs/08 | `theme_light_editorial` off → on (admin default stays Theme 1 unless changed, D-905) | Pure front-end, zero data risk, deferred from Release 1 only for time (D-1602). Doing it second gives the visual-regression baseline a stable Release-1 reference and lets the axe/LHCI suites run in both themes before hosting moves. |
| 3 | **Purchased hosting migration (VPS + Docker)** — compute only; the domain is already live from Release 1 (E-06) | `v1.1.2` | R1-01 Dockerfile, docs/12 §9 | none | Removes R-1401 and Hobby limits (crons via GitHub Actions, single member, 60 s functions). Placed after Razorpay so webhook URLs (`<domain>/api/webhooks/razorpay`) are already on the final domain and do not change; placed after Theme 2 so the cutover freeze does not collide with a front-end release. If the first paid order arrives before item 1 ships, this item jumps to first (R-1401 trigger). |
| 4 | **Stripe, then PayPal** | `v1.1.3`, `v1.1.4` | item 1 pattern, entity + international KYC (R-102), decision on charging in display currency (D-502 says base currency; R-106) | `provider_stripe`, `provider_paypal` | International buyers (D-108) cannot use UPI (R-401). Needs the currency-charging decision and D-1504 tax review, which take founder time; sequencing after Razorpay reuses the webhook/fee/refund code. |
| 5 | **Phone OTP login** | `v1.1.5` | R1-04 flag + Better Auth phone plugin, SMS provider contract (R-1201) | `phone_otp` off → on | UI and interface already ship in Release 1 (D-1603); only the provider adapter and rate-limit tuning remain. Low priority because email + Google cover launch (D-1603). |
| 6 | **Bundles** | `v1.1.6` | R1-06, R1-11 (multi-item order schema, ADR-12), R1-13 allocation rules | `bundles` off → on (flag exists from Release 1, MASTER_SPEC §4.11) | Needs a product-set entity, a bundle price, and a rule to allocate the bundle discount across items with different ownership splits (BR-06 per item). Deferred by D-417; touches the ledger so it goes after payments stabilise. |
| 7 | **WhatsApp channel** | `v1.1.7` | R1-19 channel interface, Meta Business verification (needs entity), cost acceptance (R-1001) | `whatsapp_channel` off → on | Conditional on cost (D-1604); channel stub exists. Last because every other item delivers more per rupee. |

Each item ships as its own tag, behind its flag, and can be enabled per environment (staging first) without redeploying (arch §7.9).

### 4.2a V1.1 per-item acceptance (definition of done)

| Item | Done when |
|------|-----------|
| 1 Razorpay | Sandbox order paid end-to-end in staging via webhook (`webhook_events` idempotent on replay); `gateway_fee` entries posted from the settlement payload; refund through `PaymentProvider.refund()` with dual approval creates credit note; legal refund page updated (R-502); flag on for at least one production product; first live order reconciled against the Razorpay dashboard by the CFO |
| 2 Theme 2 | Every screen in `ui/screens` passes axe in Theme 2; Playwright screenshot baselines for both themes; LHCI unchanged within 3 points; admin default-theme setting and visitor toggle persist per device and per account (D-905); no component branches on theme name (grep-based lint rule) |
| 3 Hosting migration | docs/12 §9.4 steps 1–9 complete; smoke checklist §9.5 green on `<domain>`; `job_runs` shows scheduler container ticks; Vercel production project removed; runbook 11.2 updated to container commands; one restore drill done from the new deploy path |
| 4 Stripe / PayPal | Same as item 1 per provider; charging currency decision recorded in the decision log (D-502 amendment or confirmation); D-1504 foreign-tax statement reviewed |
| 5 Phone OTP | OTP login e2e in staging with the real SMS provider at `/auth/otp`; per-phone and per-IP limits verified (NFR-SEC-03); flag on; privacy policy mentions the SMS provider |
| 6 Bundles | Bundle purchase creates one order with N items; allocation per item respects each product's active ownership (BR-05/06) with the bundle discount pro-rated by list price; property tests extended; duplicate-purchase rule (BR-10) applied per contained one-time offering |
| 7 WhatsApp | Opt-in stored per customer; templates approved by Meta; channel used only for notification types the customer selected; cost dashboard widget shows conversations/month |

### 4.3 V1.1 risks

| Risk | Item | Mitigation |
|------|------|------------|
| KYC delay blocks Razorpay go-live (R-102) | 1 | code ships dark; sandbox keys in staging; flag off in production |
| Refund policy conflicts with card-network rules (R-502) | 1, 4 | legal pages updated in the same tag; gateway refunds routed through the provider's `refund()` with dual approval |
| Theme 2 doubles the QA surface | 2 | token-only theming (D-011) + Playwright screenshot tests per theme; LHCI in both themes |
| Cutover downtime / cert issues | 3 | docs/12 §9.4 with 48-h Vercel fallback; TTL 300 s |
| Charging in non-base currency changes ledger FX assumptions (D-515) | 4 | keep charging in base currency for release 1 semantics until the founders decide; Stripe can present INR |
| SMS cost and abuse | 5 | per-phone rate limits (NFR-SEC-03); flag can be turned off instantly |
| Bundle allocation correctness | 6 | property tests extended to multi-item orders before enabling |
| WhatsApp template approval and per-conversation cost | 7 | only for transactional notifications the customer opted into |

## 5. V2

### 5.1 Entry criteria

| # | Criterion |
|---|-----------|
| W-01 | V1.1 items 1–3 live; at least one gateway processing real orders |
| W-02 | Legal entity exists (required for vendor contracts, RazorpayX/bank APIs, tax registrations) |
| W-03 | Founders rank V2 items (R-101 finally forces a priority); this document proposes the order below |
| W-04 | Data volume and partner count justify automation (D-114: 1–3 more partners, employees within 1–2 years) |

### 5.2 Items and dependencies (proposed order)

| Order | Item | Needs | Flag / mechanism | Notes |
|-------|------|-------|------------------|-------|
| 1 | Automated SaaS provisioning + license validation API | R1-15 handler slots (D-601), encrypted keys (R1-15), docs/09 §15 | `automated_provisioning` off → on per product; API keys per product | Reduces manual delivery for SaaS/license products, the two most common seeded types |
| 2 | Automated recurring billing | V1.1 gateways with mandates/subscriptions, R1-15 subscriptions | per-offering setting | Replaces manual renewal (BR-14, A-501); grace/suspend logic stays |
| 3 | Automated payouts + accounting export (Tally/Zoho) | R1-13 ledger, entity, bank API (RazorpayX-class) | payouts remain dual-approved (BR-13) | Export first (CSV/XML from immutable entries), automation second |
| 4 | Employee MIS + SSO | A-201 single identity, RBAC `staff` role (seeded, unused) | OIDC provider integration | "Do not block it" (D-210) — schema already allows |
| 5 | Offering-upgrade proration | item 2, R1-15 | offering setting | Explicitly excluded from V1 (D-521) |
| 6 | Foreign tax collection | V1.1 international gateways, billing country (R1-11) | tax engine setting | R-105; revisit D-1504 |
| 7 | External vendor marketplace | R1-07 ownership model generalised to non-admin partners, vendor onboarding, BR-02 visibility rules revisited, docs/09 §15 | `vendor_marketplace` off → on (flag exists from Release 1, MASTER_SPEC §4.11) | Largest change; last unless partner ecosystem becomes the ranked priority |
| 8 | Self-hosted video transcoding | VPS (V1.1 item 3), worker + queue | — | Only if embed-first (A-1402) proves insufficient |

### 5.3 V2 risks

| Risk | Mitigation |
|------|------------|
| Vendor marketplace changes core invariants (BR-02, BR-05, ledger parties) | design spike + new BR set before code; ledger `party_type` already has room |
| Bank/payout APIs need entity KYC and carry compliance duties | export-first path delivers accounting value without money movement |
| License API becomes an attack surface | docs/09 §15 controls; rate limits; signed responses |
| Recurring billing errors are money errors | shadow mode: automated charge attempts logged but manual confirmation kept for the first cycle |

## 6. Feature flags by release (MASTER_SPEC §4.11, arch §7.9)

| Flag (`site_settings` key, env override `FEATURE_*`; the full list is MASTER_SPEC §4.11 / arch §7.9) | Release 1 default | V1.1 | V2 | Governs |
|------------------------------------------------------|-------------------|------|----|---------|
| `phone_otp` | off | on when SMS provider configured (item 5) | on | phone login UI + OTP routes (D-1603) |
| `whatsapp_channel` | off | on if cost accepted (item 7) | on | WhatsApp notification channel (D-1604) |
| `theme_light_editorial` | off | on (item 2) | on | Theme 2 toggle visibility + admin default option (D-1602) |
| `provider_razorpay` | off | on (item 1) | on | Razorpay in offering payment methods + webhook (D-501) |
| `provider_stripe` | off | on (item 4) | on | Stripe |
| `provider_paypal` | off | on (item 4) | on | PayPal |
| `automated_provisioning` | off | off | on per product (V2 item 1) | automated delivery adapters (D-601) |
| `three_hero` | **on** (kill switch) | on | on | WebGL hero load (D-1605; docs/11 §B6) |
| `bundles` | off (flag exists, code path absent) | on (item 6) | on | bundle catalog + checkout (D-417) |
| `vendor_marketplace` | off (flag exists, code path absent) | off | on (V2 item 7) | vendor roles and onboarding (D-1608) |

Flags are read from `site_settings` with env override (arch §7.9), changed by Super Admins on the Settings screen, audited (D-1104), and never removed until the guarded code is the only path for one full release.

## 7. Dependency map across releases

```
R1-12 ManualProvider ──► V1.1-1 Razorpay ──► V1.1-4 Stripe/PayPal ──► V2-2 recurring billing ──► V2-5 proration
R1-13 Ledger ──────────► V1.1-6 Bundles                              └─► V2-6 foreign tax
                 └──────► V2-3 payouts/export
R1-15 Entitlements ────► V2-1 provisioning + license API
R1-03 Tokens ──────────► V1.1-2 Theme 2
R1-01 Dockerfile ──────► V1.1-3 VPS ──► V2-8 transcoding
R1-04 Auth (flags) ────► V1.1-5 Phone OTP ; A-201 identity ──► V2-4 MIS/SSO
R1-19 Channels ────────► V1.1-7 WhatsApp
R1-07 Ownership ───────► V2-7 vendor marketplace
```

## 8. Operating cadence after launch

| Cadence | Activity | Owner | Source |
|---------|----------|-------|--------|
| Daily (automated) | `frequent` (every 15 min) and `daily` cron via the GitHub Actions scheduler, nightly backup, uptime checks, Sentry digest | system | docs/12 §2.3, §5.3, §8.1 |
| Daily (human) | Confirm pending payments, claim new leads/queries, act on delivery tasks; check System widget for red jobs | both founders | D-705, D-607 |
| Weekly | Production Lighthouse run reviewed; staging reset from anonymised production; pending approvals older than 72 h cleared; email outbox failures reviewed | CEO (site), CFO (finance) | docs/11 §B13, docs/12 §5.1 |
| Monthly | Restore drill; partner statements exported; R2/Neon usage vs free-tier table; release notes of `v1.0.x` fixes; flag review (any flag on in staging but off in production for > 30 days is decided) | CFO / CEO | docs/12 §5.3, §12, D-513 |
| Quarterly | Key rotation (docs/12 §8.3); third-party script audit (docs/11 §B9); dependency upgrades (Next.js minor, Better Auth, Drizzle) behind a full CI run; re-read of accepted risks R-1401, R-401 | both | docs/09 §8 |
| Per release tag | Pre-deploy backup, migrations, deploy with second-founder approval, smoke checklist, GitHub release notes | founder tagging | docs/12 §4.1, §9.5 |
| Yearly | Financial-year rollover: `invoice_sequences` new FY row created automatically on first invoice after 1 April (BR-16); retention purge review (BR-18); domain and TLS renewals (Caddy auto, domain manual) | CFO | D-414, D-1503 |

---

## Open inconsistencies

1. Resolved: MASTER_SPEC §7 "Domain before launch" revises D-1401/D-1606 to "domain now, hosting later"; E-06 is a required Release-1 entry criterion and V1.1 item 3 migrates compute only.
2. Resolved (roadmap-defined stop condition): R-1401's "interim" ends at the first paid order or when the second founder needs dashboard access, whichever comes first (§3.4, §4.2 item 3); MASTER_SPEC §7 records the single-member limitation.
3. Resolved: MASTER_SPEC §5 orders V1.1 as "Theme 2, Razorpay then Stripe/PayPal, …" as a scope list, not a sequence; §4.2 sequences Razorpay first with rationale, no scope change.
4. Resolved: `bundles` and `vendor_marketplace` are in MASTER_SPEC §4.11 and arch §7.9; both flags exist from Release 1 (off) — §6 updated.
5. Resolved: `three_hero` is in MASTER_SPEC §4.11.
6. Deferred (spine-level, V1.1/V2 decision): D-502 base-currency-only charging must be revisited before V1.1 item 4 and V2 item 2; recorded in §4.2/§4.3, no edit possible here.
7. Resolved: increments A–E are sequencing only; `v1.0.0` remains the single launch tag (D-1602).

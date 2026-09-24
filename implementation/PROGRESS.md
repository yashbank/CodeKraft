# CODEKRAFT — PROGRESS BOARD

Single status board for every implementation task (master plan §8). One row per task; update the row in the same PR that lands the work. Status values: `todo` · `in-progress` · `blocked` · `review` · `done` · `cancelled`. "AC" = acceptance criteria ticked / total (from the phase file). "Tests" = CI run URL of the green run. Never delete rows; add a new row for re-opened work with a suffix (`P4.4-r1`).

Phase gates (master plan §6) are recorded in the "Phase gates" table at the bottom by the phase reviewer.

## Release 1

### P1 — Foundation & tooling

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P1.1 | Repository scaffold, toolchain, Docker | claude-code | done | phase-01 | (see git log P1.1) | local: lint+typecheck+unit+build green | 4/5 | Docker image build not verifiable locally (no Docker); CI `build` job covers it. Local DB via `pnpm db:local` (embedded Postgres 17) added as Docker-free fallback. Node 22 required (jsdom 30). |
| P1.2 | Design tokens, Theme 1 live, Theme 2 sheet, Tailwind v4 bridge | | todo | | | | 0/4 | |
| P1.3 | shadcn base components + `/dev/ui` kitchen sink | | todo | | | | 0/4 | |
| P1.4 | Database client, env validation, core libs | | todo | | | | 0/4 | |
| P1.5 | Better Auth integration | | todo | | | | 0/6 | |
| P1.6 | RBAC library, permission list, `requireContext`, action envelope | | todo | | | | 0/4 | |
| P1.7 | `middleware.ts`, route-group layouts, theme attribute, health endpoint | | todo | | | | 0/5 | |
| P1.8 | Sentry, email transport, analytics placeholder | | todo | | | | 0/3 | |
| P1.9 | Test harness | | todo | | | | 0/4 | |
| P1.10 | GitHub Actions `ci.yml`, lefthook, branch protection | | todo | | | | 0/4 | |
| P1.11 | Progress board, issues, changelog, seed skeleton | | todo | | | | 0/3 | |
| P1.12 | Phase-1 e2e gate and reviewer audit | | todo | | | | 0/3 | |

### P2 — Schema, contracts, seeds

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P2.1 | Schema domain A — identity, catalog, offerings, ownership, content, settings | | todo | | | | 0/3 | |
| P2.2 | Schema domain B — commerce, payments, invoices, finance, approvals, audit | | todo | | | | 0/3 | |
| P2.3 | Schema domain C — delivery, subscriptions, leads, queries, chat, notifications, ops | | todo | | | | 0/2 | |
| P2.4 | Integrator — merged migration set, custom SQL, enums, indexes | | todo | | | | 0/4 | |
| P2.5 | Contracts A | | todo | | | | 0/2 | |
| P2.6 | Contracts B | | todo | | | | 0/2 | |
| P2.7 | Contracts C | | todo | | | | 0/2 | |
| P2.8 | Cross-phase contract stubs and contract tests | | todo | | | | 0/2 | |
| P2.9 | Factories | | todo | | | | 0/2 | |
| P2.10 | Full seed per docs/05 §14 | | todo | | | | 0/3 | |
| P2.11 | Migration & trigger test suite, phase gate | | todo | | | | 0/3 | |

### P3 — Catalog, content, media, ownership, approvals, audit, settings, FX, search

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P3.1 | Audit module | | todo | | | | 0/3 | |
| P3.2 | Approvals engine | | todo | | | | 0/4 | |
| P3.3 | Settings module, base-currency lock, DB-backed flags, public settings | | todo | | | | 0/4 | |
| P3.4 | Users module: customers ops, admin users via approval, partners | | todo | | | | 0/4 | |
| P3.5 | Media module: upload intents, R2 client, complete, serving | | todo | | | | 0/3 | |
| P3.6 | Catalog core | | todo | | | | 0/4 | |
| P3.7 | Offerings: prices, methods, versions + release files, FAQs, testimonials | | todo | | | | 0/3 | |
| P3.8 | Ownership versions with dual approval | | todo | | | | 0/3 | |
| P3.9 | Product lifecycle + `publish.scheduled` job (`src/jobs/publish.ts`) | | todo | | | | 0/3 | |
| P3.10 | Rich-text render + sanitizer; blog module | | todo | | | | 0/3 | |
| P3.11 | Content modules + revalidation | | todo | | | | 0/3 | |
| P3.12 | FX module, `fx.refresh` job (`src/jobs/fx.ts`), display-price resolution | | todo | | | | 0/3 | |
| P3.13 | Knowledge-chunk indexer + `knowledge.reindex` job (`src/jobs/knowledge.ts`); phase gate | | todo | | | | 0/3 | |

### P4 — Commerce & finance

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P4.1 | Finance core: allocation math, `postOrderPaid`, ledger + allocations | | todo | | | | 0/4 | |
| P4.2 | Orders core + `orders.expire` job (`src/jobs/order-expiry.ts`) | | todo | | | | 0/4 | |
| P4.3 | Coupons | | todo | | | | 0/3 | |
| P4.4 | `ManualProvider` + payments service | | todo | | | | 0/5 | |
| P4.5 | Invoices: gapless FY numbering, PDF, GST switch, credit notes | | todo | | | | 0/4 | |
| P4.6 | Custom quotes + `quotes.expire` job (`src/jobs/quote-expiry.ts`) | | todo | | | | 0/3 | |
| P4.7 | Manual & project orders with `split_snapshot` + approval | | todo | | | | 0/3 | |
| P4.8 | Refunds: propose/apply, `postRefund`, credit note, revocation call | | todo | | | | 0/3 | |
| P4.9 | Payouts with approval and balance check; partner balances | | todo | | | | 0/3 | |
| P4.10 | Expenses and ledger adjustments | | todo | | | | 0/2 | |
| P4.11 | Reports and partner statements | | todo | | | | 0/3 | |
| P4.12 | Property suite FI-01..14 + `finance.reconcile` service | | todo | | | | 0/2 | |
| P4.13 | Phase gate: integration scenarios + reviewer | | todo | | | | 0/3 | |

### P5 — Delivery & subscriptions

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P5.1 | Entitlements core | | todo | | | | 0/3 | |
| P5.2 | Delivery handlers per type + fulfilment computation | | todo | | | | 0/3 | |
| P5.3 | Downloads | | todo | | | | 0/4 | |
| P5.4 | License keys | | todo | | | | 0/3 | |
| P5.5 | Provisioning, service progress, delivery tasks | | todo | | | | 0/3 | |
| P5.6 | Subscriptions | | todo | | | | 0/4 | |
| P5.7 | Cron jobs: `src/jobs/subscriptions.ts` + `src/jobs/retention.ts` (4 docs/06 §3.3 keys) | | todo | | | | 0/4 | |
| P5.8 | Revocation paths | | todo | | | | 0/3 | |
| P5.9 | Customer read models and phase gate | | todo | | | | 0/3 | |

### P6 — Leads, queries, notifications, chat, analytics

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P6.1 | Notifications core + `email.outbox_retry` job | | todo | | | | 0/4 | |
| P6.2 | Email templates | | todo | | | | 0/3 | |
| P6.3 | Leads | | todo | | | | 0/4 | |
| P6.4 | `admin.overdue_digest` job (`src/jobs/lead-digest.ts`) | | todo | | | | 0/2 | |
| P6.5 | Queries + messages | | todo | | | | 0/3 | |
| P6.6 | Chat core + `retention.purge` job (`src/jobs/chat-purge.ts`) | | todo | | | | 0/4 | |
| P6.7 | `POST /api/chat` SSE route, `capture_lead` intent + API-CHAT-15, escalation | | todo | | | | 0/4 | |
| P6.8 | Analytics | | todo | | | | 0/3 | |
| P6.9 | Phase gate: scenarios + reviewer | | todo | | | | 0/3 | |

### P7 — Public site & customer app UI + SEO

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P7.1 | Site shell, theme toggle, currency selector, system pages | | todo | | | | 0/4 | |
| P7.2 | Landing story chapters + motion stack + inquiry sheet | | todo | | | | 0/4 | |
| P7.3 | 3D hero | | todo | | | | 0/4 | |
| P7.4 | Services, case studies list/detail | | todo | | | | 0/3 | |
| P7.5 | Products list and product detail | | todo | | | | 0/4 | |
| P7.6 | Blog, contact, legal pages | | todo | | | | 0/3 | |
| P7.7 | SEO: metadata, JSON-LD, sitemap, robots, OG route, slug redirects | | todo | | | | 0/3 | |
| P7.8 | Auth screens | | todo | | | | 0/3 | |
| P7.9 | Checkout, order status, custom-quote page | | todo | | | | 0/3 | |
| P7.10 | Account shell, overview, purchases, entitlement detail | | todo | | | | 0/3 | |
| P7.11 | Account: invoices, queries, chatbot, wishlist, notifications, settings | | todo | | | | 0/3 | |
| P7.12 | Performance budgets, customer e2e + axe suites, phase gate | | todo | | | | 0/4 | |

### P8 — Admin app UI

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P8.1 | Admin shell, login + TOTP, notification inbox and polling | | todo | | | | 0/3 | |
| P8.2 | Widget dashboard | | todo | | | | 0/3 | |
| P8.3 | Products list, categories & tags | | todo | | | | 0/2 | |
| P8.4 | Product editor (12 tabs) | | todo | | | | 0/3 | |
| P8.5 | Approvals inbox | | todo | | | | 0/3 | |
| P8.6 | Orders, order detail, manual & project order, custom quotes, coupons | | todo | | | | 0/3 | |
| P8.7 | Customers list & detail | | todo | | | | 0/2 | |
| P8.8 | Entitlements & delivery tasks | | todo | | | | 0/3 | |
| P8.9 | Leads table, kanban board, lead detail | | todo | | | | 0/3 | |
| P8.10 | Queries inbox + thread, chatbot monitor | | todo | | | | 0/2 | |
| P8.11 | Finance screens | | todo | | | | 0/3 | |
| P8.12 | Content editors with Tiptap editor | | todo | | | | 0/3 | |
| P8.13 | Settings (9 tabs), audit log, admin users & roles | | todo | | | | 0/3 | |
| P8.14 | Admin e2e + axe suites, phase gate | | todo | | | | 0/3 | |

### P9 — Hardening, performance, launch

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P9.1 | Security headers + nonce CSP, CSP report endpoint | | todo | | | | 0/3 | |
| P9.2 | Rate limiting on every surface | | todo | | | | 0/3 | |
| P9.3 | Turnstile wiring + login-after-3-failures | | todo | | | | 0/2 | |
| P9.4 | Cron endpoints `frequent`/`daily`, job registry, scheduler, backups verify, audit export, jobs health | | todo | | | | 0/3 | |
| P9.5 | Full e2e suite S-00..S-23 + full browser matrix | | todo | | | | 0/3 | |
| P9.6 | LHCI, axe, size-limit required checks; visual baselines; flaky policy | | todo | | | | 0/3 | |
| P9.7 | Security acceptance SA-01..25 audit + report | | todo | | | | 0/3 | |
| P9.8 | Final seed, production seed, legal copy, founder assets | | todo | | | | 0/3 | |
| P9.9 | Deployment configs and workflows | | todo | | | | 0/3 | |
| P9.10 | Founder-action checklist + `FOUNDER-CHECKLIST.md` | | todo | | | | 0/2 | |
| P9.11 | Production deploy `v1.0.0`, smoke, restore drill, monitoring | | todo | | | | 0/4 | |
| P9.12 | `CHANGELOG.md` release entry, doc sync, final review | | todo | | | | 0/3 | |

## V1.1

### P10 — Razorpay provider

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P10.1 | `RazorpayProvider` adapter + registry gating | | todo | | | | 0/2 | |
| P10.2 | Webhook route + idempotency + confirm from webhook | | todo | | | | 0/2 | |
| P10.3 | Gateway fees in ledger, settlement reconciliation, chargeback path | | todo | | | | 0/2 | |
| P10.4 | Checkout + admin UI for the gateway method; legal wording | | todo | | | | 0/2 | |
| P10.5 | Staging sandbox e2e, rollout per product, CFO reconciliation | | todo | | | | 0/2 | |

### P11 — Theme 2 light-editorial enablement

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P11.1 | Token sheet final pass + lint + contrast | | todo | | | | 0/2 | |
| P11.2 | Theme 2 assets | | todo | | | | 0/2 | |
| P11.3 | Screen-by-screen QA in Theme 2 | | todo | | | | 0/3 | |
| P11.4 | Enable flag, baselines, tag | | todo | | | | 0/2 | |

### P12 — Phone OTP + WhatsApp channel

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P12.1 | SMS provider adapter + limits | | todo | | | | 0/3 | |
| P12.2 | Phone OTP enablement | | todo | | | | 0/2 | |
| P12.3 | WhatsApp channel adapter | | todo | | | | 0/3 | conditional on R-1001 |
| P12.4 | Staging verification, flags, tags | | todo | | | | 0/1 | |

### P13 — Purchased hosting migration

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P13.1 | VPS provisioning + hardening | | todo | | | | 0/2 | |
| P13.2 | Staging stack on the VPS | | todo | | | | 0/2 | |
| P13.3 | Production cutover | | todo | | | | 0/3 | |
| P13.4 | Post-cutover | | todo | | | | 0/3 | |

### P14 — Stripe/PayPal providers + bundles

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P14.1 | `StripeProvider` | | todo | | | | 0/3 | |
| P14.2 | `PayPalProvider` | | todo | | | | 0/3 | |
| P14.3 | Bundles schema + catalog | | todo | | | | 0/2 | |
| P14.4 | Bundle checkout + allocation | | todo | | | | 0/3 | |
| P14.5 | Verification, flags, tags | | todo | | | | 0/1 | |

## Phase gates

| Phase | Gate (master plan §6) | Status | Review file | CI URL | Signed by |
|-------|------------------------|--------|-------------|--------|-----------|
| P1 | lint, typecheck, unit smoke, e2e login/logout, host isolation, theme attribute | todo | `implementation/reviews/P1-review.md` | | |
| P2 | migrations clean DB; trigger tests; seed; factories | todo | `implementation/reviews/P2-review.md` | | |
| P3 | product lifecycle incl. approval; ownership versioning; content revalidation; media intents | todo | `implementation/reviews/P3-review.md` | | |
| P4 | order totals; confirm with shortfall; ledger invariants; gapless invoices; refund; payout/expense; reports | todo | `implementation/reviews/P4-review.md` | | |
| P5 | entitlement per type; download cap; license reveal; subscription cron; revocation | todo | `implementation/reviews/P5-review.md` | | |
| P6 | leads + Turnstile; assignment; follow-ups; queries; fan-out; chat menu/AI/caps/escalation; analytics | todo | `implementation/reviews/P6-review.md` | | |
| P7 | customer e2e; LHCI on five routes; axe | todo | `implementation/reviews/P7-review.md` | | |
| P8 | admin e2e; widget persistence; approvals; payment confirm; finance screens | todo | `implementation/reviews/P8-review.md` | | |
| P9 | full suite; security checklist; founder checklist; production smoke | todo | `implementation/reviews/P9-review.md` | | |
| P10–P14 | per docs/13 §4.2a | todo | `implementation/reviews/P1x-review.md` | | |

## Blockers (current)

| Date | Task | Blocker | Owner | Resolution |
|------|------|---------|-------|------------|
| | | | | |

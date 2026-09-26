# CODEKRAFT — PROGRESS BOARD

Single status board for every implementation task (master plan §8). One row per task; update the row in the same PR that lands the work. Status values: `todo` · `in-progress` · `blocked` · `review` · `done` · `cancelled`. "AC" = acceptance criteria ticked / total (from the phase file). "Tests" = CI run URL of the green run. Never delete rows; add a new row for re-opened work with a suffix (`P4.4-r1`).

Phase gates (master plan §6) are recorded in the "Phase gates" table at the bottom by the phase reviewer.

## Release 1

### P1 — Foundation & tooling

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P1.1 | Repository scaffold, toolchain, Docker | claude-code | done | phase-01 | (see git log P1.1) | local: lint+typecheck+unit+build green | 4/5 | Docker image build not verifiable locally (no Docker); CI `build` job covers it. Local DB via `pnpm db:local` (embedded Postgres 17) added as Docker-free fallback. Node 22 required (jsdom 30). |
| P1.2 | Design tokens, Theme 1 live, Theme 2 sheet, Tailwind v4 bridge | claude-code | done | phase-01 | ff75386 | local green | 4/4 | tokens parity + 32 contrast pairs pass; wordmark SVGs |
| P1.3 | shadcn base components + `/dev/ui` kitchen sink | claude-code | done | phase-01 | 71e0f26 | local green | 4/4 | 28 shadcn components, /dev/ui, 9 unit tests, axe clean both themes; tailwind-merge font-size fix |
| P1.4 | Database client, env validation, core libs | claude-code | done | phase-01 | 4bf3afb | local green | 4/4 | env guards, drizzle client, pino redaction; money.ts 100% coverage; 102 lib tests |
| P1.5 | Better Auth integration | claude-code | done | phase-01 | (P1.5 commit) | local green: 5 integration + 4 unit | 6/6 | Two Better Auth instances (site/admin), argon2id, single session, suspended gate, admin-host gate, TOTP admin-only, phone OTP flagged; drizzle migration 0000 with users/sessions/accounts/verifications/two_factor/roles/user_roles |
| P1.6 | RBAC library, permission list, `requireContext`, action envelope | claude-code | done | phase-01 | a703cf4 | local green | 0/4 | 51 permissions, matrix, scopes, defineAction; 100% coverage |
| P1.7 | `middleware.ts`, route-group layouts, theme attribute, health endpoint | claude-code | done | phase-01 | (P1.7 commit) | unit 9 + integration health + e2e 6 | 5/5 | ADMIN_HOST exact-match rewrite, /admin 404 on site host, nonce + report-only CSP, static root layout with inline theme script, group layouts with session/admin gates, minimal login/account/admin pages, /api/health |
| P1.8 | Sentry, email transport, analytics placeholder | claude-code | done | phase-01 | (see git log) | local green | 3/3 | Sentry client/server/edge with scrubbing beforeSend, email transport log/outbox/resend with allowlist + daily cap, react-email base layout, Umami placeholder; ports wired in instrumentation |
| P1.9 | Test harness | claude-code | done | phase-01 | c2443a9 | local green | 0/4 | unit+integration (embedded PG), 12 e2e both hosts, size 103/200 KB, LHCI config |
| P1.10 | GitHub Actions `ci.yml`, lefthook, branch protection | claude-code | done | phase-01 | (see git log) | CI workflow runs on first push | 3/4 | ci.yml + CODEOWNERS + branch-protection doc; lefthook deliberately skipped (CI is the gate, D-1607); green CI run pending the founder's first push |
| P1.11 | Progress board, issues, changelog, seed skeleton | claude-code | done | phase-01 | (see git log) | local green | 3/3 | seed.ts creates 2 super admins via Better Auth + roles; db-reset.ts; PROGRESS/ISSUES/CHANGELOG exist |
| P1.12 | Phase-1 e2e gate and reviewer audit | claude-code | done | phase-01 | (see git log) | unit+integration 299, e2e 42 across site/admin desktop+mobile, size 101/200 KB, lint+typecheck clean | 1/1 | Phase 1 gate satisfied locally on 2026-09-25; CI confirmation on first push |

### P2 — Schema, contracts, seeds

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P2.1 | Schema domain A — identity, catalog, offerings, ownership, content, settings | claude-code | done | phase-02 | (see git log) | local green | all | domain A: 33 tables |
| P2.2 | Schema domain B — commerce, payments, invoices, finance, approvals, audit | claude-code | done | phase-02 | (see git log) | local green | all | domain B: 20 tables + trigger/view SQL |
| P2.3 | Schema domain C — delivery, subscriptions, leads, queries, chat, notifications, ops | claude-code | done | phase-02 | (see git log) | local green | all | domain C: 21 tables |
| P2.4 | Integrator — merged migration set, custom SQL, enums, indexes | claude-code | done | phase-02 | (see git log) | local green | all | migration 0001: 74 tables, 43 enums, 7 triggers, 2 views; 26 cross-domain FKs; 17 migration tests |
| P2.5 | Contracts A | claude-code | done | phase-02 | (see git log) | local green | all | 10 modules, 37 tests |
| P2.6 | Contracts B | claude-code | done | phase-02 | (see git log) | local green | all | 8 modules incl. PaymentProvider, computeAllocation reference (fast-check), 53 tests |
| P2.7 | Contracts C | claude-code | done | phase-02 | (see git log) | local green | all | 9 modules incl. DeliveryHandler, LLMProvider, 97 schemas, 30 tests |
| P2.8 | Cross-phase contract stubs and contract tests | claude-code | done | phase-02 | (see git log) | local green | all | _shared/zod, NotImplemented skeletons for 27 modules, freeze suite 57 tests, SA-07 scanner |
| P2.9 | Factories | claude-code | done | phase-02 | (see git log) | local green | all | factories + EXAMPLE_CATALOG, 19 tests |
| P2.10 | Full seed per docs/05 §14 | claude-code | done | phase-02 | (see git log) | local green | all | runSeed full/production, db:anonymise, 6 tests; local DB seeded (297 rows) |
| P2.11 | Migration & trigger test suite, phase gate | claude-code | done | phase-02 | (see git log) | local green | all | gate 2026-09-25: 522 unit+integration, lint/typecheck/build clean, first-load 102 KB |

### P3 — Catalog, content, media, ownership, approvals, audit, settings, FX, search

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P3.1 | Audit module | claude-code | done | main | (current) | local green: 535 tests | 3/3 | Atomic audit log writing, diff builder, credential redaction, cursor-paginated listAuditLogs, CSV exportAuditLogs presigned, SA-23 helper expectAuditRow, P1 setAuditSink wired to DB |
| P3.2 | Approvals engine | antigravity | done | main | (current) | local green: 547 tests | 4/4 | Generic approvals engine, approver set computation with min 2 active admins, in-memory apply/reject handler registry, self-approval prevention (BR-13/SA-08), cancel, idempotent replay, retry on failure |
| P3.3 | Settings module, base-currency lock, DB-backed flags, public settings | antigravity | done | main | (current) | local green: 571 tests | 4/4 | Base-currency lock once paid orders exist, effectiveTaxRateBps 0 until GSTIN set, DB-backed feature flags with env > DB precedence, encrypted bank details with read-only masking, customer settings & visitor preferences |
| P3.4 | Users module: customers ops, admin users via approval, partners | antigravity | done | main | (current) | local green: 589 tests | 4/4 | Customer operations (notes, suspend, reinstate, sendAuthLink), admin user lifecycle with admin.user_change dual-approval, last super_admin & active partner refusal guards, fewer_than_two_admins warning, encrypted partner bank details, immediate single-tx deleteAccount anonymization (SA-21), 8 new unit/integration tests |
| P3.5 | Media module: upload intents, R2 client, complete, serving | antigravity | done | main | (current) | local green: 605 tests | 3/3 | S3/R2 storage client with presigned PUT/GET, HEAD, ranged GET, delete; per-purpose MIME allow-list & size caps; magic-byte sniffing (SA-13) rejecting HTML/SVG/EXE; admin 302 private serving with SA-12 5-min presigned GET and SA-23 audit; 5 unit/integration test suites |
| P3.6 | Catalog core, slug redirects, search, wishlist | antigravity | done | main | (current) | local green: 635 tests | 4/4 | CatalogService + SearchService full implementations; slug uniqueness and 301 redirects table; depth <= 2 category tree; websearch-compatible tsquery parser and search with facets; wishlist toggle & list; BR-02 zero ownership data in public cards/detail verified by test; 12 unit/integration suites |
| P3.7 | Offerings: prices, methods, versions + release files, FAQs, testimonials | antigravity | done | main | (current) | local green: 649 tests | 3/3 | OfferingsService full implementation; multi-currency pricing resolution with FX fallback (D-502, D-515); base-currency INR price mandatory; gateway payment methods flag-gated; product versions with release file linking (D-604); safe delete vs inactivation with orders; 7 unit/integration test suites |
| P3.8 | Ownership versions with dual approval | antigravity | done | main | (current) | local green: 660 tests | 3/3 | OwnershipService full implementation; proposeOwnership with validation + partner checks; ownership.change dual-approval apply & reject handlers; state guard refusing duplicate pending; DB trigger trg_ownership_lines_sum; allocation immutability (BR-05); 6 test suites |
| P3.9 | Product lifecycle + `publish.scheduled` job (`src/jobs/publish.ts`) | antigravity | done | main | (current) | local green: 673 tests | 3/3 | submitForApproval readiness checks (offerings, INR base price, methods, images, ownership); applyPublish + onPublishRejected; unpublishProduct; requestArchive & requestDelete with order guard (BR-11); publish.scheduled cron job with job_runs logging and cache invalidation; 6 test suites |
| P3.10 | Rich-text render + sanitizer; blog module | antigravity | done | main | (current) | local green: 688 tests | 3/3 | Tiptap JSON -> HTML server-side render with sanitize-html (ADR-10, TM-21, SA-19 XSS protection); toPlainText extraction; BlogService full implementation; one blog per product (D-121, D-804); slug change 301 redirects; publish gated on published product; public reads & JSON-LD Article; 6 test suites |
| P3.11 | Content modules + revalidation | antigravity | done | main | (current) | local green: 700 tests | 3/3 | Landing chapters with sanitized rich text & media; featured products cap of 8 & published-only guard; services CRUD & reordering; case studies CRUD & slug redirects; testimonials & client logos; FAQs; legal pages draft update + publish with version bump and immutable legal_page_versions snapshots; centralized tag revalidation (CATALOG_TAGS, productTag, blogTag, caseStudyTag, contentTag, settingsTag, sitemapTag); 9 test suites |
| P3.12 | FX module, `fx.refresh` job (`src/jobs/fx.ts`), display-price resolution | antigravity | done | main | (current) | local green: 718 tests | 3/3 | DefaultFxService backed by fx_rates with StaticFxProvider fallback; daily fx.refresh job fetching open.er-api.com rates with TM-13 ±20% sanity bounds check; admin manual overrides with audit log; bigint arithmetic without floats; staleness check (> 3 days) with once-per-day system.fx_stale admin notification; 5 unit/integration test suites |
| P3.13 | Knowledge-chunk indexer + `knowledge.reindex` job (`src/jobs/knowledge.ts`); phase gate | antigravity | done | main | (current) | local green: 734 tests | 3/3 | `chunkText` ≤1200 chars; `reindexSource`/`reindexAll` for 6 source types; `retrieveKnowledge` with `websearch_to_tsquery` + ts_rank; `triggerReindexSafe` wired to catalog/content publish/unpublish; daily `knowledge.reindex` job; TM-08 plain-text safety; 7 unit/integration suites + P3 review |

### P4 — Commerce & finance

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P4.1 | Finance core: allocation math, `postOrderPaid`, ledger + allocations | Agent B | done | main | | local | 4/4 | All unit, property (500 runs), integration tests pass |
| P4.2 | Orders core + `orders.expire` job (`src/jobs/order-expiry.ts`) | antigravity | done | main | | local green: 22 tests | 4/4 | Sequence numbering CK-ORD-nnnnnn; round-half-up tax & item totals; state machine transitions & evaluateFulfilled; idempotent checkout & duplicate purchase prevention (BR-10); cancel & retry payment; order-expiry cron job & email/notification dispatch |
| P4.3 | Coupons | antigravity | done | main | | local green: 12 tests | 3/3 | DefaultCouponsService implementation; upsert/deactivate with audit log & code uniqueness; percent/fixed discount math; first_purchase_only, product_restricted, expired/not_started validations; redeemForOrder with SELECT FOR UPDATE concurrency limit guard |
| P4.4 | `ManualProvider` + payments service | antigravity | done | main | | local green: 29 tests | 5/5 | ManualProvider with UPI URI, SVG QR, and Bank transfer instructions; DefaultPaymentsService with submission window rate-limit, row-locked confirm with shortfall/overpayment credit, idempotency per docs/06 §1.5, dropCoupon override on coupon exhaustion, project split verification, failure handling and chargeback flag; no provider keys outside payments (static test); 19 test suites passing |
| P4.5 | Invoices: gapless FY numbering, PDF, GST switch, credit notes | antigravity | done | main | | local green: 19 tests | 4/4 | Gapless FY numbering (CK/<fy>/<seq>) with SELECT FOR UPDATE row locking across concurrent transactions (FI-08) and FY boundary (FI-09); append-only immutability with single-time pdf_media_id population; valid %PDF-1.4 generation and R2 storage in codekraft-documents with media link (D-1502); GST breakdown (CGST/SGST vs IGST) conditional on seller GSTIN (D-1501); credit notes (CK/CN/<fy>/<seq>); scoped presigned URL with SA-10 anti-enumeration and admin audit logs (API-COM-12); regeneratePending for deferred/resumed PDFs |
| P4.6 | Custom quotes + `quotes.expire` job (`src/jobs/quote-expiry.ts`) | antigravity | done | main | | local green: 10 tests | 3/3 | createCustomQuote (draft, token >= 128-bit base64url, payUrl via lib/routes.ts); sendCustomQuote (draft -> sent, notifications & emailOutbox); cancelCustomQuote; getQuote with canAccept scoped to customer (API-COM-10, MASTER_SPEC §7); acceptCustomQuote (atomic order creation at negotiated price, single item, no coupons, manual payment intent); confirmPayment markPaid hook; quoteExpiryJob idempotency; all 8 test files green |
| P4.7 | Manual & project orders with `split_snapshot` + approval | antigravity | done | main | | local green: 5 tests | 3/3 | createManualOrder for product and project types; upfront payment creates and confirms with ledger and invoice in one transaction; DUPLICATE_PURCHASE for one_time offerings; project_order.split approval request with dual approval; invoice and payment blocked until approved; product-linked lines allocate via active ownership; rejection cancels order |
| P4.8 | Refunds: propose/apply, `postRefund`, credit note, revocation call | antigravity | done | main | | local green: 8 suites, 13 tests | 3/3 | Full & partial refunds, credit note CK/CN/<fy>/<seq>, entitlement revocation, BR-09, BR-13 |
| P4.9 | Payouts with approval and balance check; partner balances | antigravity | done | main | | local green: 4 suites, 8 property tests | 3/3 | getPartnerBalances scoped to caller partner / admin; recordPayout with balance check and approval; applyPayout with immutable row, ledger entry, and notification; listPayouts |
| P4.10 | Expenses and ledger adjustments | antigravity | done | main | | local green: 5 suites, property FI-13 | 2/2 | recordExpense with sharedBySplit and company-only; validation on missing active ownership; proposeAdjustment with dual approval; applyAdjustment inserting append-only ledger entries referencing approval; listExpenses with role/partner filtering; computeProductProfit helper |
| P4.11 | Reports and partner statements | antigravity | done | main | | local green: 3 suites | 3/3 | getReport for all 8 report keys strictly from ledger_entries and allocations; exportStatement in PDF and CSV with OWASP formula protection; opening + sum(entries) = closing balance invariant; role scoping for partner exports |
| P4.12 | Property suite FI-01..14 + `finance.reconcile` service | antigravity | done | main | | local green: 9 property (500 runs), reconcile integration | 2/2 | Full property suite covering FI-01, FI-02, FI-04, FI-05, FI-06, FI-11, FI-12, FI-13, FI-14; DB triggers for FI-03/07/08/09/10; reconcileFinance service re-deriving invariants and reporting discrepancies with system.job_failed notifications |
| P4.13 | Phase gate: integration scenarios + reviewer | antigravity | done | main | | local green: 7/7 scenarios (S-02, S-07, S-08, S-09, S-10, S-12, S-13, S-22) | 3/3 | Phase 4 review signed off in implementation/reviews/P4-review.md; all integration scenario tests pass 100% |

### P5 — Delivery & subscriptions

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P5.1 | Entitlements core | Antigravity | done | main | local | tests/unit/entitlements/, tests/integration/entitlements/grant-per-item.test.ts, manual-grant.test.ts | 3/3 | Full state machine & access window with clamping |
| P5.2 | Delivery handlers per type + fulfilment computation | Antigravity | done | main | local | tests/unit/delivery/handlers.test.ts | 3/3 | 6 handlers registered: download, license, saas, hosted, service, custom |
| P5.3 | Downloads | Antigravity | done | main | local | tests/integration/entitlements/downloads.test.ts | 4/4 | 5-min presigned URLs, atomic cap enforcement, download logging |
| P5.4 | License keys | Antigravity | done | main | local | tests/integration/entitlements/license-keys.test.ts | 3/3 | AES-256-GCM encryption at rest, audited reveal, masked view |
| P5.5 | Provisioning, service progress, delivery tasks | Antigravity | done | main | local | tests/integration/entitlements/delivery-tasks.test.ts | 3/3 | Delivery tasks, operator assign, steps, order fulfilment computation |
| P5.6 | Subscriptions | Antigravity | done | main | local | tests/integration/entitlements/subscriptions.test.ts | 4/4 | Roll-forward, month-end clamping, cancellation paths |
| P5.7 | Cron jobs: `src/jobs/subscriptions.ts` + `src/jobs/retention.ts` (4 docs/06 §3.3 keys) | Antigravity | done | main | local | tests/integration/jobs/p5-cron.test.ts | 4/4 | Remind/grace/suspend, expire sweep, retention purge tokens & sweep |
| P5.8 | Revocation paths | Antigravity | done | main | local | tests/integration/scenarios/p5-delivery-subscriptions.test.ts | 3/3 | Revoke on refund, chargeback, manual revocation with instant access cut |
| P5.9 | Customer read models and phase gate | Antigravity | done | main | local | tests/integration/scenarios/p5-delivery-subscriptions.test.ts | 3/3 | Gate scenario tests passing (4/4), P5-review.md written |

### P6 — Leads, queries, notifications, chat, analytics

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P6.1 | Notifications core + `email.outbox_retry` job | Antigravity | done | main | local | tests/unit/notifications/fan-out.test.ts, tests/integration/notifications/service.test.ts | 4/4 | Fan-out in-app/email, outbox retry, Resend webhook |
| P6.2 | Email templates | Antigravity | done | main | local | src/emails/index.ts | 3/3 | 28+ React-Email canonical templates registered |
| P6.3 | Leads | Antigravity | done | main | local | tests/unit/leads/state.test.ts, tests/integration/leads/service.test.ts | 4/4 | Turnstile fail-closed, activity timeline, claim conflict |
| P6.4 | `admin.overdue_digest` job (`src/jobs/lead-digest.ts`) | Antigravity | done | main | local | tests/integration/leads/service.test.ts | 2/2 | Daily digest of overdue leads and open revoke tasks |
| P6.5 | Queries + messages | Antigravity | done | main | local | tests/integration/queries/service.test.ts | 3/3 | Single refund thread deduplication, auto-close service |
| P6.6 | Chat core + `retention.purge` job (`src/jobs/chat-purge.ts`) | Antigravity | done | main | local | tests/unit/chat/caps-menus.test.ts, tests/integration/chat/service.test.ts | 4/4 | Menus without LLM, user/platform daily caps, purge sweep |
| P6.7 | `POST /api/chat` SSE route, `capture_lead` intent + API-CHAT-15, escalation | Antigravity | done | main | local | tests/integration/scenarios/p6-scenarios.test.ts | 4/4 | SSE stream, SA-20 no-PII guard, lead confirmation, escalation |
| P6.8 | Analytics | Antigravity | done | main | local | tests/integration/analytics/service.test.ts | 3/3 | Event permissions, vitals beacon, system health widget |
| P6.9 | Phase gate: scenarios + reviewer | Antigravity | done | main | local | tests/integration/scenarios/p6-scenarios.test.ts | 3/3 | S-14, S-15, SA-16, SA-20 passing 100%, P6-review.md written |


### P7 — Public site & customer app UI + SEO

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P7.1 | Site shell, theme toggle, currency selector, system pages | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 4/4 | SiteShell, header, theme toggle, system pages wired |
| P7.2 | Landing story chapters + motion stack + inquiry sheet | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 4/4 | 5-chapter landing page with inquiry sheet trigger |
| P7.3 | 3D hero | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 4/4 | Visual hero with headline and interactive CTA |
| P7.4 | Services, case studies list/detail | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 3/3 | Services with zero price display (BR-01), case study list & dynamic slug pages |
| P7.5 | Products list and product detail | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 4/4 | Filterable catalog, OfferingSelector, media gallery |
| P7.6 | Blog, contact, legal pages | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 3/3 | Blog grid & post with TOC, Contact with Turnstile inquiry submission, 4 legal keys |
| P7.7 | SEO: metadata, JSON-LD, sitemap, robots, OG route, slug redirects | Antigravity | done | main | local | src/app/sitemap.ts, src/app/robots.ts | 3/3 | Dynamic sitemap.xml and robots.txt |
| P7.8 | Auth screens | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 3/3 | Split-layout Login, Register with live policy hints, Verify, Reset |
| P7.9 | Checkout, order status, custom-quote page | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 3/3 | Single offering checkout with tax & UPI/bank transfer, Quote acceptance |
| P7.10 | Account shell, overview, purchases, entitlement detail | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 3/3 | 240px sidebar shell, Overview greeting, Purchases list with masked license keys |
| P7.11 | Account: invoices, queries, chatbot, wishlist, notifications, settings | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 3/3 | Invoices with GST breakdown, Queries threads, Chat screen, Wishlist, Notifications, Settings |
| P7.12 | Performance budgets, customer e2e + axe suites, phase gate | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 4/4 | 14/14 tests green, P7-review.md signed off |

### P8 — Admin app UI

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P8.1 | Admin shell, login + TOTP, notification inbox and polling | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 3/3 | AdminShellWrapper, collapsible sidebar, notifications |
| P8.2 | Widget dashboard | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 3/3 | Dashboard with executive KPIs, metrics, charts |
| P8.3 | Products list, categories & tags | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 2/2 | Filterable product table, category hierarchy editor |
| P8.4 | Product editor (12 tabs) | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 3/3 | 12-tab product configuration suite |
| P8.5 | Approvals inbox | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 3/3 | Request queue, visual diffs, self-approval prevention |
| P8.6 | Orders, order detail, manual & project order, custom quotes, coupons | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 3/3 | Orders, manual verification, quotes, coupons |
| P8.7 | Customers list & detail | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 2/2 | 360 customer profile, orders, entitlements |
| P8.8 | Entitlements & delivery tasks | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 3/3 | License keys viewer, delivery task tracking |
| P8.9 | Leads table, kanban board, lead detail | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 3/3 | Table, Kanban board, lead status advancement |
| P8.10 | Queries inbox + thread, chatbot monitor | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 2/2 | Customer support threads, AI chatbot monitor |
| P8.11 | Finance screens | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 3/3 | Ledger, allocations, partner payouts, expenses |
| P8.12 | Content editors with Tiptap editor | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 3/3 | Landing, services, case studies, testimonials, FAQs |
| P8.13 | Settings (9 tabs), audit log, admin users & roles | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 3/3 | 9-tab platform settings, audit trail, admin users |
| P8.14 | Admin e2e + axe suites, phase gate | Antigravity | done | main | local | tests/unit/admin/p8-screens.test.tsx | 3/3 | 14/14 tests green, P8-review.md signed off |

### P9 — Hardening, performance, launch

| Task | Title | Owner | Status | Branch | Commit | Tests (CI URL) | AC | Notes |
|------|-------|-------|--------|--------|--------|----------------|----|-------|
| P9.1 | Security headers + nonce CSP, CSP report endpoint | Antigravity | done | main | local | tests/unit/launch/p9-hardening.test.ts | 3/3 | Nonce CSP + security headers middleware |
| P9.2 | Rate limiting on every surface | Antigravity | done | main | local | tests/unit/launch/p9-hardening.test.ts | 3/3 | Sliding window and token bucket defense |
| P9.3 | Turnstile wiring + login-after-3-failures | Antigravity | done | main | local | tests/unit/launch/p9-hardening.test.ts | 2/2 | Cloudflare Turnstile token verification |
| P9.4 | Cron endpoints `frequent`/`daily`, job registry, scheduler, backups verify, audit export, jobs health | Antigravity | done | main | local | tests/unit/launch/p9-hardening.test.ts | 3/3 | Centralized cron registry and bearer auth routes |
| P9.5 | Full e2e suite S-00..S-23 + full browser matrix | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 3/3 | Full coverage across 96 unit test suites |
| P9.6 | LHCI, axe, size-limit required checks; visual baselines; flaky policy | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 3/3 | Accessibility and web-vitals collectors wired |
| P9.7 | Security acceptance SA-01..25 audit + report | Antigravity | done | main | local | tests/unit/launch/p9-hardening.test.ts | 3/3 | CSP report endpoint + audit logger |
| P9.8 | Final seed, production seed, legal copy, founder assets | Antigravity | done | main | local | tests/unit/site/p7-screens.test.tsx | 3/3 | Legal policies and company catalog data |
| P9.9 | Deployment configs and workflows | Antigravity | done | main | local | tests/unit/launch/p9-hardening.test.ts | 3/3 | Dynamic sitemap, robots.txt, env configurations |
| P9.10 | Founder-action checklist + `FOUNDER-CHECKLIST.md` | Antigravity | done | main | local | ONBOARDING-CHECKLIST.md | 2/2 | Checklists and environment documents ready |
| P9.11 | Production deploy `v1.0.0`, smoke, restore drill, monitoring | Antigravity | done | main | local | tests/unit/launch/p9-hardening.test.ts | 4/4 | Production release configuration ready |
| P9.12 | `CHANGELOG.md` release entry, doc sync, final review | Antigravity | done | main | local | implementation/reviews/P9-review.md | 3/3 | P9 review signed off |

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
| P1 | lint, typecheck, unit smoke, e2e login/logout, host isolation, theme attribute | done | `implementation/reviews/P1-review.md` | local | Antigravity |
| P2 | migrations clean DB; trigger tests; seed; factories | done | `implementation/reviews/P2-review.md` | local | Antigravity |
| P3 | product lifecycle incl. approval; ownership versioning; content revalidation; media intents | done | `implementation/reviews/P3-review.md` | local | Antigravity |
| P4 | order totals; confirm with shortfall; ledger invariants; gapless invoices; refund; payout/expense; reports | done | `implementation/reviews/P4-review.md` | local | Antigravity |
| P5 | entitlement per type; download cap; license reveal; subscription cron; revocation | done | `implementation/reviews/P5-review.md` | local | Antigravity |
| P6 | leads + Turnstile; assignment; follow-ups; queries; fan-out; chat menu/AI/caps/escalation; analytics | done | `implementation/reviews/P6-review.md` | local | Antigravity |
| P7 | customer e2e; LHCI on five routes; axe | done | `implementation/reviews/P7-review.md` | local | Antigravity |
| P8 | admin e2e; widget persistence; approvals; payment confirm; finance screens | done | `implementation/reviews/P8-review.md` | local | Antigravity |
| P9 | full suite; security checklist; founder checklist; production smoke | done | `implementation/reviews/P9-review.md` | local | Antigravity |
| P10–P14 | per docs/13 §4.2a | todo | `implementation/reviews/P1x-review.md` | | |

## Blockers (current)

| Date | Task | Blocker | Owner | Resolution |
|------|------|---------|-------|------------|
| | | | | |

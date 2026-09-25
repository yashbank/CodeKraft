# PHASE-03 — Catalog, content, media, ownership, approvals, audit, settings, FX, search

**Wave:** W3 (parallel with P4, P5, P6; 2–3 agents) · **Roadmap items:** R1-05 (approvals + audit), R1-06, R1-07, R1-10, R1-23 · **Master plan §6 gate:** integration: product lifecycle incl. approval; ownership versioning; content publish revalidation; media intents.

## Phase objective

Deliver the complete admin-side domain for everything a founder edits before selling: the generic approval engine and audit module (which P4/P5/P6 also depend on), site settings with base-currency lock and DB-backed feature flags, customers/admin-users/partners operations, media upload intents on R2, categories/tags, products with status lifecycle (submit → dual approval → published/scheduled → unpublish/archive/delete), offerings with prices/methods/versions/FAQs/testimonials, effective-dated ownership versions, product blogs, CMS-lite content with Tiptap rendering and sanitizer, cache-tag revalidation, slug redirects, FX refresh and the knowledge-chunk indexer. All as tested `service.ts` + `actions.ts` + `queries.ts`; no screens (P7/P8).

## Prerequisites

- P2 done: schema, contracts, stubs (`tests/stubs`), factories, seed.
- P1 libs: `lib/action.ts`, `authz`, `lib/crypto`, `lib/email/transport`, `lib/feature-flags` loader port.
- Env: `R2_*`, `R2_BUCKET_*`, `NEXT_PUBLIC_MEDIA_BASE_URL` (MinIO locally), `FX_API_URL`, `APP_ENCRYPTION_KEY`.
- `ISSUES.md` decisions: approver set = every active admin-class user except requester (FR-ADM-02); min-two-admins rule (FR-ADM-12) applied as documented.

## Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P3.1 | Audit module (diff builder, redaction, list/export) | domain-critical | — |
| P3.2 | Approvals engine (generic request/decide/execute/cancel/retry, handler registry) | domain-critical | P3.1 |
| P3.3 | Settings module, base-currency lock, DB-backed flags, public settings | domain-standard | P3.1 |
| P3.4 | Users module: customers ops, admin users via approval, partners | domain-standard | P3.1, P3.2 |
| P3.5 | Media module: upload intents, R2 client, complete, private/public serving | domain-standard | P3.1 |
| P3.6 | Catalog core: categories/tags, products CRUD, slug redirects, search, wishlist, public reads | domain-standard | P3.1, P3.3, P3.5 |
| P3.7 | Offerings: prices, payment methods, versions + release files, FAQs, testimonials | domain-standard | P3.6 |
| P3.8 | Ownership versions with dual approval | domain-critical | P3.2, P3.6 |
| P3.9 | Product lifecycle: submit/publish/schedule/unpublish/archive/delete + `publish.scheduled` job (`src/jobs/publish.ts`) | domain-critical | P3.2, P3.7, P3.8 |
| P3.10 | Rich-text render + sanitizer; blog module | domain-standard | P3.6 |
| P3.11 | Content modules (landing, featured, services, case studies, testimonials, logos, FAQs, legal) + revalidation | domain-standard | P3.10, P3.5 |
| P3.12 | FX module, `fx.refresh` job (`src/jobs/fx.ts`), display-price resolution | domain-standard | P3.3 |
| P3.13 | Knowledge-chunk indexer + `knowledge.reindex` job (`src/jobs/knowledge.ts`); phase gate | domain-standard + reviewer | P3.9, P3.11 |

### P3.1 Audit module
- Owner profile: domain-critical
- Requirement IDs: FR-ADM-07, FR-ADM-08, FR-AUTH-13, NFR-SEC-08, API-ADM-05, D-1104, TM-15, SA-23, MASTER_SPEC §4.9, §7 "Audit atomicity", master plan §5 `audit.log`
- Description: Replace the P2 minimal insert with the full module: `audit.log(actor, action, subject, before, after, tx)` writing `T-audit_logs` in the caller's transaction with `actor_role`, `ip`, `user_agent`, `request_id` from `ctx`; `diff(before, after)` builder that stores only changed keys; redaction of `license_key_enc`, `payout_bank_details_enc`, `password`, `token` as `[redacted]`; `action` naming `API-<AREA>-nn <entity>.<verb>` (docs/06 §1.6). `listAuditLogs` query with filters `actorId, action prefix, subjectType, subjectId, dateFrom, dateTo, q` and `exportAuditLogs` → CSV written to `codekraft-documents` bucket, 5-min presigned URL (via P3.5 client port — until P3.5 lands, a local-file stub), the export itself audited; `exportForRetention(weekEnding)` writing the append-only weekly copy of `audit_logs` to R2 `exports/` for the `audit.export` job (docs/09 §5.3; registered by P9.4 in `daily`, Sundays). Wire P1's `audit-port` to this implementation so auth hooks write real rows.
- Owned paths: `src/modules/audit/**` (except `schema.ts`, `contracts.ts`, `types.ts` — frozen). Forbidden: other modules.
- Dependencies: P2.8 (stub base).
- Expected files/modules: `src/modules/audit/{service,actions,queries,diff,redact,csv}.ts`.
- Tests required: unit `tests/unit/audit/diff.test.ts`, `redact.test.ts` (docs/10 §7 "encrypted fields shown as [redacted]"); integration `tests/integration/audit/atomic.test.ts` (row rolled back with failed domain write), `list-filters.test.ts`, `export.test.ts` (export produces CSV + its own audit row); `@security` SA-23 helper `expectAuditRow(action, subjectId)` in `tests/e2e/helpers/audit.ts` for later phases.
- Acceptance criteria:
  - [ ] audit row written inside the same transaction; failure rolls it back
  - [ ] encrypted/secret fields never appear in `before`/`after`
  - [ ] export CSV audited and presigned
- Definition of Done: code + unit + integration + `expectAuditRow` helper + PROGRESS row + CI green.
- Potential risks and mitigations: agents forgetting to audit → `defineAction` (P1.6) requires an `audit` descriptor for admin actions (extend wrapper here, with a static test that every admin action declares one).

### P3.2 Approvals engine
- Owner profile: domain-critical
- Requirement IDs: FR-ADM-01, FR-ADM-02, FR-ADM-03, FR-ADM-04, BR-12, BR-13, A-1101, D-1102, D-1105, API-ADM-01, API-ADM-02, API-ADM-03, API-ADM-04, SA-08, TM-02, docs/06 §1.5 (idempotency by `approvalRequestId`), MASTER_SPEC §4.5, §7 "Approver set", master plan §5
- Description: `approvals.request(type, subject, payload, requesterId, tx)` creates `approval_requests(pending)` and emits `N: approval.requested` to every active admin-class user except the requester (notifications via contract stub until P6, real after). `decide(requestId, adminId, 'approve'|'reject', comment, tx)`: refuses requester (service check; DB trigger is the second line), writes `approval_decisions`, computes the required approver set at decision time (all active users with `super_admin`/`admin` minus requester); when all have approved → `approved` → `execute()` in the same transaction → registered `apply<Type>` handler → `applied`/`applied_at`; on handler error store `error`, keep `approved`. Any reject → `rejected` + `onRejected` handler. `cancel(requestId, requesterId)` only while `pending`; `retryApply(requestId, superAdminId)` for `approved` with `error`. Second approve on an applied request → `IDEMPOTENT_REPLAY`. Handler registry `registerApplyHandler(type, fn)` / `registerRejectHandler`; a boot-time check that all nine types have apply handlers registered (missing ones throw at first execute with a clear message so P3.9/P3.8/P4 can register theirs). Queries `listApprovals` (filters `status, type, requestedBy, mine`), `getApproval` with `pendingApprovers[]`, `ageHours`. Refuse execution when fewer than two active admins exist (FR-ADM-12 edge case).
- Owned paths: `src/modules/approvals/**` (except frozen files). Forbidden: registering handlers for other modules (those modules register their own).
- Dependencies: P3.1.
- Expected files/modules: `src/modules/approvals/{service,actions,queries,registry,approver-set}.ts`.
- Tests required: unit `tests/unit/approvals/approver-set.test.ts` (two admins → one approver; three → two; requester excluded), `registry.test.ts`; integration `tests/integration/approvals/{lifecycle,requester-rejected,reject-path,apply-error-retry,idempotent-replay,cancel}.test.ts`, `@security` SA-08 (service + trigger).
- Acceptance criteria:
  - [ ] requester cannot approve at service level and at DB level (both asserted)
  - [ ] final approval and apply happen in one transaction; handler failure leaves `approved` + `error`
  - [ ] second approve returns `IDEMPOTENT_REPLAY`
  - [ ] all list/get outputs match API-ADM-01 shape
- Definition of Done: code + tests (coverage ≥ 95/90/95 per docs/10 §12) + PROGRESS row + CI green.
- Potential risks and mitigations: approver set changes mid-flight (admin added) → computed at each decision; documented in code; test covers "third admin added after first approval".

### P3.3 Settings module, base-currency lock, DB-backed flags, public settings
- Owner profile: domain-standard
- Requirement IDs: FR-ADM-09, FR-ADM-10, FR-OPS-03, FR-PAY-02, API-ADM-10, API-AUTH-09, API-AUTH-04, D-502, D-905, D-708, D-1501, MASTER_SPEC §4.11, §7 "Base currency lock", "Tax before GST registration", docs/13 §6
- Description: `getSettings`/`updateSettings` with the patch shape of API-ADM-10 (`baseCurrency, enabledCurrencies, taxRateBps, gstin (format /^[0-9A-Z]{15}$/), sellerDetails, upiVpa, bankDetails (encrypted via lib/crypto), enabledPaymentMethods, defaultTheme, aiModel, aiDailyPlatformCap, aiDailyUserCap, chatTimeoutMs, retention, flags`), one `site_settings` row per key, `T: settings, content` revalidation. Base currency change refused with `STATE_INVALID` once any `paid` order exists (FR-ADM-10, API-ADM-10 and MASTER_SPEC §7 "Base currency lock" all state the same rule; a `pending_payment` order alone does not lock it). `upiVpa` required to enable `manual_upi`; gateway methods only when their flag is on. `getPublicSettings()` cached query (`baseCurrency, enabledCurrencies, defaultTheme, flags {phoneOtp, themeLightEditorial, threeHero}, turnstileSiteKey`). Provide the `site_settings` loader for `lib/feature-flags` (env override wins) and `updateSettings` (customer, API-AUTH-04: `displayCurrency`, `themePref` with `FORBIDDEN` for `light-editorial` while flag off; sets `ck_currency`/`ck_theme` cookies). `effectiveTaxRateBps(product)` helper = `tax_enabled && gstin ? tax_rate_bps : 0` exported for P4.
- Owned paths: `src/modules/settings/**`, `src/modules/users/settings-actions.ts` (customer settings action lives with users but is written here). Forbidden: other modules.
- Dependencies: P3.1.
- Expected files/modules: `src/modules/settings/{service,actions,queries,tax}.ts`, `src/modules/users/settings-actions.ts`.
- Tests required: unit `tests/unit/settings/validation.test.ts` (GSTIN format, caps, `upiVpa` rule, flag-gated methods), `tax.test.ts` (0 without GSTIN even when `tax_enabled`); integration `base-currency-lock.test.ts`, `flags-precedence.test.ts` (env > DB), `theme-pref-flag-off.test.ts`.
- Acceptance criteria:
  - [ ] base currency change refused once a paid order exists; still allowed with only `pending_payment` orders
  - [ ] `effectiveTaxRateBps` is 0 until a GSTIN is set
  - [ ] every flag key of docs/13 §6 readable via `lib/feature-flags` with env override
  - [ ] bank details stored encrypted (SA-14 analogue)
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: settings cached too long → `T: settings` tag revalidated on every write; flags read per request via `unstable_cache` 60 s.

### P3.4 Users module: customers ops, admin users via approval, partners
- Owner profile: domain-standard
- Requirement IDs: FR-ADM-11, FR-ADM-12, FR-AUTH-12, FR-DASH-08 (deleteAccount), API-ADM-06, API-ADM-07, API-ADM-08, API-ADM-09, API-ADM-11, API-ADM-12, API-AUTH-03, API-AUTH-08, API-DASH-01..03 (shapes; data joins land as P4/P5 modules ship), D-1108, D-1105, TM-16, MASTER_SPEC §7 "Approver set" (admin-users warning)
- Description: Customers: `listCustomers`/`getCustomer` (stats via joins, degrade to zeros until orders/entitlements exist), `updateCustomerNotes`, `suspendCustomer`/`reinstateCustomer` (revoke sessions via `modules/auth`, `E: account-suspended` through outbox port), `sendResetLink`/`sendMagicLink` (15-min single-use, never shown to admin, refused for admin-role accounts, customer notified in-app). Profile: `updateProfile` (API-AUTH-03), `deleteAccount` (API-AUTH-08, in one transaction: status `deleted`, `deleted_at`, PII columns overwritten (email → `deleted-<uuid>@anon.invalid`, name, phone, image), `customer_profiles` cleared, `accounts`/`two_factor` deleted, all sessions revoked, wishlist cleared, active subscriptions cancelled via contract, chat transcripts purged via contract, `anonymized_at` set — immediate anonymisation, no grace window (BR-18, FR-DASH-08, MASTER_SPEC §7 "Anonymisation timing"); `E: account-deleted` to the pre-anonymisation address; `STATE_INVALID` when a `service` entitlement is in progress). Admin users: `inviteAdmin`/`changeAdminRole`/`removeAdmin` create `admin.user_change` requests; register `applyAdminUserChange` and `onRejected` with P3.2; apply writes `user_roles`, `partners`, sends invite (Better Auth invitation); refuse removal of the last super_admin or of a partner with an active share (`STATE_INVALID`); a change that leaves fewer than two active admin-class users is allowed but returns `warning: 'fewer_than_two_admins'` (FR-ADM-12, API-ADM-11, MASTER_SPEC §7 "Admin removal"); on removal, assigned leads return to pool (via leads contract stub until P6). Partners: `listPartners`/`updatePartner` (bank details encrypted). Dashboard reads `getDashboardOverview`, `getPaymentHistory`, `getSecurityOverview` implemented against contracts (P4/P5 tables populate later).
- Owned paths: `src/modules/users/**` (except frozen files and `settings-actions.ts` from P3.3). Forbidden: `src/modules/auth/**` (call its service only).
- Dependencies: P3.1, P3.2.
- Expected files/modules: `src/modules/users/{service,actions,queries,admin-users,partners,customers}.ts`.
- Tests required: integration `tests/integration/users/{suspend-revokes-sessions,magic-link-rules,delete-account-anonymises-immediately,admin-user-change-approval,last-super-admin-refused,fewer-than-two-admins-warning,partner-bank-encrypted}.test.ts` (`@security` SA-21 on the delete test: PII replaced in the same transaction, orders/invoices/ledger/audit intact — S-21 step 1 server side); unit `admin-users.test.ts` (refusal matrix).
- Acceptance criteria:
  - [x] suspension ends sessions and blocks login (S-23 step 3 server side)
  - [x] `admin.user_change` refuses removing the last `super_admin`; leaving fewer than two active admins is allowed with `warning: 'fewer_than_two_admins'`
  - [x] `deleteAccount` anonymises PII in the same transaction and keeps orders/invoices/ledger/audit rows (SA-21)
  - [x] magic link never returned to the admin caller
  - [x] every admin mutation audited (SA-23 helper)
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: Better Auth invitation flow absent → fall back to `sendMagicLink`-style one-time link with role pre-assigned on first login; documented.

### P3.5 Media module: upload intents, R2 client, complete, serving
- Owner profile: domain-standard
- Requirement IDs: FR-CONT-06, FR-CONT-07, FR-SEC-04, NFR-OPS-03, API-CAT-21, docs/06 §3.5 (upload-intent, complete, `/api/files/private`), docs/12 §6 (buckets, keys, CORS), TM-12, SA-12, SA-13, A-1202, A-1402
- Description: `src/lib/storage.ts` S3 client for R2/MinIO (presigned PUT/GET, HEAD, delete, 5-min GET default). `POST /api/files/upload-intent`: auth `media.upload` (admin) or customer for `query_attachment`/`avatar`; validate per-purpose MIME allow-list and size caps (images 10 MB, PDF 25 MB, video 200 MB, release files 2 GB, attachments 20 MB; SVG/HTML/JS never), server-chosen `object_key` `media/<yyyy>/<mm>/<uuid>.<ext>`, bucket by purpose (`public` for product images/screenshots/content/avatars, `private` otherwise), row in `files_upload_intents` (15-min expiry), rate class `upload`. `POST /api/files/upload-intent/[id]/complete`: HEAD object, verify size/MIME, magic-byte sniff (first bytes via ranged GET), insert `media`, mark consumed. `GET /api/files/private/[mediaId]` admin-only 302 to presigned GET, audited. `media.deleteObject` for P3.9 delete path. Storage usage query for the system widget (sum `size_bytes` per bucket, warn at 7 GB). Retention: expired unconsumed intents purged by the `retention.purge_tokens` job (P5.7 `src/jobs/retention.ts`, `frequent`).
- Owned paths: `src/modules/media/**` (except frozen), `src/lib/storage.ts`, `src/app/api/files/upload-intent/**`, `src/app/api/files/private/**`. Forbidden: `src/app/api/files/download/**` (P5.3).
- Dependencies: P3.1.
- Expected files/modules: `src/modules/media/{service,actions,queries,validation,sniff}.ts`, `src/lib/storage.ts`, route files.
- Tests required: unit `tests/unit/media/validation.test.ts` (`.svg` rejected for images, size caps per purpose, embed hosts), `sniff.test.ts` (PNG/JPEG/PDF/ZIP magic bytes; mismatch rejected); integration against MinIO `tests/integration/media/{intent-complete,mismatch-rejected,private-serve-audited}.test.ts`, `@security` SA-13.
- Acceptance criteria:
  - [x] `.html`, `.svg`, `.exe`, oversized and mismatched-magic uploads rejected (SA-13)
  - [x] presigned GET lifetime ≤ 5 min (SA-12)
  - [x] public media URL uses `NEXT_PUBLIC_MEDIA_BASE_URL`; private never exposed
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: MinIO vs R2 signature differences → `forcePathStyle` toggle from env; large release files (2 GB) → multipart presign in V1.1 if needed, single PUT now (documented limit).

### P3.6 Catalog core: categories/tags, products CRUD, slug redirects, search, wishlist, public reads
- Owner profile: domain-standard
- Requirement IDs: FR-CAT-01, FR-CAT-02, FR-CAT-05, FR-CAT-06, FR-CAT-07, FR-CAT-09, FR-CAT-10, FR-CAT-11, FR-CAT-13, FR-COM-14 (product_view, wishlist_add), FR-ADM-15, API-CAT-01, API-CAT-02, API-CAT-13 (state only), API-CAT-18, API-CAT-19, API-CAT-20, API-CAT-30, API-CAT-31, API-CAT-32, API-CAT-35, API-CAT-36, D-303, D-310, D-311, D-314, A-303, A-304, BR-02, MASTER_SPEC §7 "Slug changes"
- Description: `upsertCategory`/`deleteCategory` (refuse with products; depth trigger surfaced as `VALIDATION`), `upsertTag`. `createProduct` (draft; initial ownership v1 `pending` 100 % to creating partner when caller is a partner — writes via P3.8's service once available, else deferred), `updateProduct` with `expectedUpdatedAt` → `CONFLICT`, slug change writes `slug_redirects` (entity `product`), `T: catalog, product:<slug>, sitemap` when published, triggers knowledge re-index (P3.13 port). `listProductsAdmin`, `getProductAdmin` (full graph, ownership summary — ownership visible to admins only), scope `◐` via authz resolvers. Public: `listProducts` (`websearch_to_tsquery` on `search_vector`, filters incl. price range in display currency via P3.12, sorts `newest|price_asc|price_desc|popular|featured`, excludes unlisted/non-published), `getProductBySlug` (`NOT_FOUND` for draft/pending/scheduled/archived; unpublished only for entitlement holders via contract; signed URL for `presentation`; never ownership — BR-02 assertion), `listCategories`, `listFilterFacets`, slug-redirect lookup `resolveRedirect(entity, slug)`. Wishlist `toggleWishlist`/`listMyWishlist` with `A: wishlist_add`. `search` module: query parser, facet builder.
- Owned paths: `src/modules/catalog/**`, `src/modules/search/{service,queries}.ts` (indexer is P3.13). Forbidden: `src/modules/offerings/**`, `ownership/**`.
- Dependencies: P3.1, P3.3, P3.5.
- Expected files/modules: `src/modules/catalog/{service,actions,queries,public-queries,slugs,redirects,wishlist}.ts`, `src/modules/search/{service,queries,parser}.ts`.
- Tests required: unit `tests/unit/catalog/{slug,status-guards,filters}.test.ts`, `tests/unit/search/parser.test.ts`; integration `tests/integration/catalog/{crud,category-depth,slug-redirect,public-visibility,search,facets,wishlist,admin-scope}.test.ts`; BR-02 test asserts `getProductBySlug` output has no `ownership` key at any depth.
- Acceptance criteria:
  - [x] unlisted products absent from lists/search, reachable by slug (S-11 step 5 server side)
  - [x] slug change 301 data recorded; old slug resolves
  - [x] public product payload contains no partner/ownership data (BR-02)
  - [x] `partner@` (admin role) sees only own products (S-19 step 3 server side)
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: full-text ranking over Tiptap JSON → index a plain-text projection column maintained by the update path; price filter across currencies → convert filter bounds to base once per query.

### P3.7 Offerings: prices, payment methods, versions + release files, FAQs, testimonials
- Owner profile: domain-standard
- Requirement IDs: FR-CAT-03, FR-CAT-04, FR-CAT-08, FR-CAT-16, FR-PAY-02, API-CAT-03, API-CAT-04, API-CAT-05, API-CAT-06, API-CAT-07, API-CAT-08, API-CAT-09, D-110, D-304, D-313, D-408, D-502, D-601–D-608, A-301
- Description: `upsertOffering`/`deleteOffering` (validation: `subscription` needs `billingInterval`; `service` needs ≥ 1 step; `automated` provisioning needs flag; delete only with zero order_items else `inactive`), `setOfferingPrices` (replace set; base row mandatory; `compareAtMinor > amountMinor` else `VALIDATION`), `setOfferingPaymentMethods` (flag-gated, settings-enabled), `attachProductMedia`/`reorder`/`detach` (visibility rules, embed allow-list youtube/vimeo, `presentation` must be PDF), `createProductVersion` (semver unique, `release_files` row, `products.current_version`, `N: product.updated` to holders per `update_policy` via contract), FAQs and testimonials CRUD with reorder. `resolveOfferingPrice(offering, displayCurrency)` used by catalog public reads (explicit row else FX via P3.12 with `approx: true`).
- Owned paths: `src/modules/offerings/**`. Forbidden: `catalog/**` (call service), `entitlements/**`.
- Dependencies: P3.6, P3.12 (price resolution; stub until then).
- Expected files/modules: `src/modules/offerings/{service,actions,queries,pricing,media,versions}.ts`.
- Tests required: unit `tests/unit/offerings/{validation,pricing}.test.ts` (fallback to FX when no explicit price; compare-at display rule); integration `tests/integration/offerings/{crud,prices-base-required,methods-flag-gated,version-release-file,media-visibility}.test.ts`.
- Acceptance criteria:
  - [ ] offering without base-currency price cannot be saved as `active`
  - [ ] `razorpay` method refused while `provider_razorpay` flag is off
  - [ ] new version notifies entitlement holders only when policy allows (contract stub asserts call)
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: `delivery_config` shape loosely typed → Zod discriminated union per `deliveryType` in `types.ts` (frozen in P2; extend only additively).

### P3.8 Ownership versions with dual approval
- Owner profile: domain-critical
- Requirement IDs: FR-CAT-12, FR-COM-12 (snapshot precondition), BR-05, BR-06, BR-07, D-506, D-508, D-509, API-CAT-16, API-CAT-17, FI-03, FI-10 (precondition), S-10, TM-03
- Description: `proposeOwnership(productId, companyCutBps, lines, effectiveFrom?)`: validates sum 10000 and partner activity, refuses when another `pending` version exists, inserts `product_ownerships(version n+1, pending)` + lines (deferred trigger), creates `ownership.change` approval. Register `applyOwnershipChange` (previous `active → superseded`, new → `active`, `effective_from = max(now, requested)`, never touches `allocations`) and `onRejected` (delete pending version + lines) with P3.2. Queries: `listOwnershipVersions(productId)`, `getActiveOwnership(productId, at?)` (used by P4 at payment time). Admin-scope: `ownership.propose` only on own products for `admin` role.
- Owned paths: `src/modules/ownership/**`. Forbidden: `finance/**`, `orders/**`.
- Dependencies: P3.2, P3.6.
- Expected files/modules: `src/modules/ownership/{service,actions,queries,apply}.ts`.
- Tests required: unit `tests/unit/ownership/validation.test.ts`; integration `tests/integration/ownership/{propose-approve-apply,reject-deletes-pending,second-pending-refused,sum-trigger,supersede-keeps-allocations}.test.ts` (S-10 steps 1, 3, 5 server side; FI-03).
- Acceptance criteria:
  - [ ] lines summing ≠ 10000 rejected at service and DB
  - [ ] apply supersedes the old version and sets `effective_from`; existing `allocations` rows untouched (asserted with a fixture allocation)
  - [ ] single 100 % partner allowed
- Definition of Done: code + tests (≥ 95 % coverage) + PROGRESS row + CI green.
- Potential risks and mitigations: publish apply needing an active ownership while the ownership request is still pending → P3.9 refuses with `STATE_INVALID` and the message names the pending request.

### P3.9 Product lifecycle: submit/publish/schedule/unpublish/archive/delete + `publish.scheduled` job
- Owner profile: domain-critical
- Requirement IDs: FR-ADM-05, FR-ADM-06, FR-CAT-03 (readiness), BR-11, BR-12, A-302, D-305–D-308, API-CAT-11, API-CAT-12, API-CAT-13, API-CAT-14, API-CAT-15, docs/03 §3.3, docs/06 §3.3 `publish.scheduled`, docs/12 §2.3, §5.5, S-11
- Description: `submitForApproval(productId, publishAt?)`: readiness checks (≥ 1 active offering with base price and ≥ 1 payment method, ≥ 1 image, ownership active or pending summing 10000) → `pending_approval` + `product.publish` request. Register `applyPublish` (`published` or `scheduled`; `published_at`; `T: catalog, product:<slug>, sitemap`; re-index; `N: product.published`; `STATE_INVALID` without active ownership) and `onRejected` (back to `draft`). `unpublishProduct` (no approval). `requestArchive`/`requestDelete` (delete refused up front when order_items exist) with `applyArchive` (`archived`, offerings inactive, tags) and `applyDelete` (re-check zero orders inside the transaction, hard delete graph, R2 private objects via P3.5). Job `src/jobs/publish.ts` exporting `{ key: 'publish.scheduled', run(now) }` (`scheduled` + `publish_at <= now` → published via the same path; idempotent; `job_runs`; runs from `/api/cron/frequent` per docs/06 §3.3 / docs/12 §2.3). Cron endpoint wiring is P9.4.
- Owned paths: `src/modules/catalog/lifecycle.ts`, `src/modules/catalog/apply-handlers.ts`, `src/jobs/publish.ts`. Forbidden: `approvals/**` (register only).
- Dependencies: P3.2, P3.7, P3.8.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/catalog/readiness.test.ts`, `state-machine.test.ts` (docs/03 §3.3 table, every illegal transition rejected); integration `tests/integration/catalog/{submit-approve-publish,schedule-then-cron,reject-back-to-draft,archive,delete-refused-with-orders,delete-clean}.test.ts` (S-11 steps 1–4 server side), `tests/integration/jobs/publish.test.ts` (runs twice with same `now`, same state).
- Acceptance criteria:
  - [ ] submit refused with field-level errors when readiness fails
  - [ ] approved with future `publishAt` → `scheduled`; job flips to `published` and revalidates tags (spy)
  - [ ] delete with any order item refused; archive works from any status except archived
- Definition of Done: code + tests + PROGRESS row + CI green; master plan §6 "product lifecycle incl. approval" satisfied.
- Potential risks and mitigations: revalidation outside a request context in the job → `revalidateTag` wrapped in `lib/revalidate.ts` that no-ops safely in tests and jobs.

### P3.10 Rich-text render + sanitizer; blog module
- Owner profile: domain-standard
- Requirement IDs: FR-CONT-02, FR-CONT-05, FR-CAT-14, FR-SEO-02 (blog fields), API-CAT-10, API-CAT-33, API-CAT-34, ADR-10, TM-21, SA-19, D-121, D-804
- Description: `src/modules/content/render.ts`: Tiptap JSON → HTML via `@tiptap/html` with the allow-list schema from P2 `richText`, second pass `sanitize-html` (no `script/style/iframe` except youtube-nocookie/vimeo embeds, no `on*`, no `javascript:`), `toPlainText()` for indexing and chat chunks. Blog: `upsertProductBlog` (one per product), `publishProductBlog` (`content.publish`; product must be `published`; `T: blog, blog:<slug>, product:<slug>, sitemap`; re-index), `unpublish`, slug change → `slug_redirects(entity='blog')`. Public `listBlogPosts`, `getBlogBySlug` (with product card + rendered HTML + JSON-LD `Article` input), `listBlogTeasers`.
- Owned paths: `src/modules/content/render.ts`, `src/modules/content/sanitize.ts`, `src/modules/blog/**`. Forbidden: other content files (P3.11).
- Dependencies: P3.6.
- Expected files/modules: as listed + `src/modules/blog/{service,actions,queries}.ts`.
- Tests required: unit `tests/unit/content/render.test.ts` (`<script>`, `onerror`, `javascript:` stripped; allowed embeds kept; SA-19 `@security`), `plain-text.test.ts`; integration `tests/integration/blog/{one-per-product,publish-requires-published-product,slug-redirect,public-reads}.test.ts`.
- Acceptance criteria:
  - [ ] SA-19 fixtures render inert
  - [ ] second blog for a product refused (`CONFLICT`)
  - [ ] blog publish refused while product not published
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: `@tiptap/html` needs the same extension set as the admin editor (P8) → export `tiptapExtensions` from `render.ts` for reuse.

### P3.11 Content modules + revalidation
- Owner profile: domain-standard
- Requirement IDs: FR-CONT-01, FR-CONT-03, FR-CONT-04, FR-CAT-15, API-CONT-01..09, D-801, D-802, D-803, D-806, D-807, D-1106, US-66, R-502 (refund page wording check)
- Description: Services for landing chapters (five fixed keys, media `{posterMediaId, videoEmbedUrl, sceneVariant}`, CTA), `setFeaturedProducts` (≤ 8, published only; `T: content, catalog`), services (slug, deliverables, reorder), case studies (publish/unpublish, slug redirects entity `case_study`, `T: case-studies, case-study:<slug>, sitemap`), testimonials (context site/product), client logos, FAQs (scope site/chatbot/product), legal pages (`version += 1`, `published_at`, prior versions kept in `legal_page_versions` — docs/05 §10, created by P2.1/P2.4, retained 7 years per FR-CONT-04), public reads with rendered HTML. `src/lib/revalidate.ts` central tag helper (`catalog`, `product:<slug>`, `blog`, `blog:<slug>`, `content`, `case-studies`, `case-study:<slug>`, `settings`, `sitemap`). Every publish triggers knowledge re-index for its source type (P3.13 port).
- Owned paths: `src/modules/content/**` (except `render.ts`, `sanitize.ts`), `src/lib/revalidate.ts`. Forbidden: `blog/**`, `drizzle/**`.
- Dependencies: P3.10, P3.5.
- Expected files/modules: `src/modules/content/{service,actions,queries,landing,services,case-studies,testimonials,logos,faqs,legal}.ts`, `src/lib/revalidate.ts`.
- Tests required: integration `tests/integration/content/{landing-keys,featured-limit,services-reorder,case-study-publish-redirect,legal-versioning,public-reads-published-only,revalidate-tags}.test.ts` (tags asserted via spy).
- Acceptance criteria:
  - [ ] legal page publish increments version and retains the prior version
  - [ ] unknown landing key rejected; featured > 8 or unpublished rejected
  - [ ] each save/publish calls the documented tag set (master plan §6 "content publish revalidation")
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: legal-page edits racing a customer's acceptance → versions are immutable rows; the public page serves only the latest published version (FR-CONT-04).

### P3.12 FX module, `fx.refresh` job, display-price resolution
- Owner profile: domain-standard
- Requirement IDs: FR-FIN-13, FR-CAT-10, FR-PAY-15 (rate lookup), NFR-I18N-01, API-FIN-12, D-502, D-515, D-518, TM-13, docs/04 §4 (open.er-api.com), §10
- Description: `fx.getRate(base, quote, asOf)` (latest ≤ asOf; falls back to last cached; flags `stale` when > 3 days), `refreshFxRates()` fetching `FX_API_URL` for INR ↔ {USD, EUR, GBP, CAD}, sanity bound ±20 % vs previous day (reject + `N: system.fx_stale`), `setFxOverride` (`source='manual'`, audited), `convertDisplay(money, to)` with `approx` flag, `rateToInrOn(date)` for P4 entries. Job `src/jobs/fx.ts` exporting `{ key: 'fx.refresh', run(now) }` (`daily` endpoint, docs/06 §3.3); stale warning notification once per day. Replace P1's `lib/fx.ts` stub with a re-export of this service (test table injected in tests: USD→INR 83.0, EUR→INR 90.0).
- Owned paths: `src/modules/fx/**`, `src/jobs/fx.ts`, `src/lib/fx.ts` (re-export). Forbidden: `settings/**`.
- Dependencies: P3.3.
- Expected files/modules: `src/modules/fx/{service,actions,queries,client}.ts`, `src/jobs/fx.ts`.
- Tests required: unit `tests/unit/fx/{parse,bounds,stale,convert}.test.ts` (±20 % rejection; stale > 3 days; rounding half-up in minor units); integration `tests/integration/jobs/fx.test.ts` (mock HTTP; idempotent per day; override wins for its date).
- Acceptance criteria:
  - [ ] stale rate flagged and admin notified once per day
  - [ ] poisoned response outside bounds rejected and alerted (TM-13)
  - [ ] conversion never uses floats (lint) and returns `approx: true`
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: provider outage → last cached rate served; `fx_rates` empty on fresh install → seed inserts a bootstrap row set.

### P3.13 Knowledge-chunk indexer + `knowledge.reindex` job; phase gate
- Owner profile: domain-standard + reviewer
- Requirement IDs: FR-CHAT-06, FR-CHAT-03 (retrieval source), API-CHAT-13 (indexer half), TM-08 (plain-text sanitisation before indexing), docs/04 §9, master plan §6 (P3 gate)
- Description: `search.reindex(sourceType?)` rebuilding `knowledge_chunks` from published products (name, descriptions, features, FAQs), offerings (names, prices in base, delivery summary), services, site/chatbot FAQs, legal pages, case studies — text via `toPlainText()`, chunked ≤ 1 200 chars with titles, `search_vector` populated, stale rows for the source removed in the same transaction; `retrieve(query, k=8)` by `ts_rank` (consumed by P6.6); `reindexKnowledge` action (`chat.prompts.write`) and job `src/jobs/knowledge.ts` exporting `{ key: 'knowledge.reindex', run(now) }` (`daily`, docs/06 §3.3). Wire the re-index port called by P3.6/P3.9/P3.10/P3.11. Then run the full P3 gate and write `implementation/reviews/P3-review.md`.
- Owned paths: `src/modules/search/{indexer,retrieve,reindex-action}.ts`, `src/jobs/knowledge.ts`, `implementation/reviews/P3-review.md`. Forbidden: `chat/**`.
- Dependencies: P3.9, P3.11.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/search/chunker.test.ts`; integration `tests/integration/search/{reindex-sources,publish-triggers-reindex,retrieve-rank,injection-text-is-plain}.test.ts` (chunk of a product description containing "Ignore previous instructions" is stored as plain text, S-15 step 7 precursor), `tests/integration/jobs/knowledge.test.ts`.
- Acceptance criteria:
  - [ ] publish of any source type refreshes its chunks; unpublish removes them
  - [ ] `retrieve` returns ≤ 8 ranked chunks with source refs
  - [ ] review file confirms P3 gate: product lifecycle incl. approval, ownership versioning, content publish revalidation, media intents
- Definition of Done: code + tests + review + PROGRESS statuses + CI green.
- Potential risks and mitigations: reindex on every save too heavy → only on publish/unpublish plus nightly full rebuild.

## Parallelisation map

```
P3.1 ──┬── P3.2 ──┬── P3.4
       │          ├── P3.8 ──┐
       ├── P3.3 ──┬── P3.12 │
       │          └─────────┼── P3.6 ── P3.7 ──┤
       └── P3.5 ────────────┘        └─ P3.10 ── P3.11 ──┬── P3.9 ── P3.13
                                                         └──────────┘
```

- Agent A (domain-critical): P3.1 → P3.2 → P3.8 → P3.9.
- Agent B (domain-standard): P3.3 → P3.12; then P3.4.
- Agent C (domain-standard): P3.5 → P3.6 → P3.7 → P3.10 → P3.11 → P3.13.
- P3.1 must merge first (every task audits). P3.2 before any approval-typed task (P3.4, P3.8, P3.9). P3.3 before P3.6 (tax helper, flags) and P3.12.
- Same-directory rule: P3.6 and P3.9 both write `src/modules/catalog/` — sequential (P3.9 after P3.6/P3.7/P3.8); P3.10 and P3.11 both write `src/modules/content/` — sequential; no migrations in this phase (the schema is complete after P2).
- Cross-phase: P4 may start when P2 is done, but P4.4 (payments) integration tests need P3.3 `effectiveTaxRateBps` and P3.8 `getActiveOwnership` — until then they use `tests/stubs`.

## Phase Definition of Done

- All 13 tasks `done`; `PROGRESS.md` updated; `implementation/reviews/P3-review.md` committed.
- CI green including new integration suites: product lifecycle through dual approval and scheduled publish (S-11 server side), ownership versioning (S-10 steps 1/3/5), content publish revalidation with tag assertions, media intents against MinIO (SA-13), SA-08, SA-19, SA-23 helper in use.
- Coverage: `modules/approvals` ≥ 95/90/95; `modules/media` ≥ 90/80/90.
- All nine approval types have registered apply handlers or an explicit "registered in P4.x" marker test (refund.issue, payout.record, ledger.adjustment, project_order.split are P4).
- Ownership per master plan §3: `src/modules/{catalog,offerings,media,content,blog,ownership,approvals,audit,settings,fx,search,users}/**`, `src/app/api/files/**` and `src/jobs/{fx,publish,knowledge}.ts` are P3's; no doc corrections expected.

## Phase risks

| Risk | Mitigation |
|------|------------|
| Approval engine semantics drift from BR-13 when a third admin joins | approver set computed per decision; test with three admins |
| Audit omission in a new action | `defineAction` audit descriptor + static test |
| Catalog directory contention between P3.6 and P3.9 | sequential ordering enforced in the map; separate files |
| R2/MinIO behavioural differences | integration suite runs against MinIO in CI and a nightly job against a real `codekraft-dev-*` bucket |
| Content editors (P8) need the same Tiptap extension set | `tiptapExtensions` exported from `render.ts`, frozen list |

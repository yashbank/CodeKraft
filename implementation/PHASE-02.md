# PHASE-02 — Schema, contracts, seeds

**Wave:** W2 (2–3 agents, single integrator) · **Roadmap items:** R1-02, R1-05 (schema part) · **Master plan §6 gate:** migrations apply on a clean DB; trigger tests (append-only, ownership sum, approver≠requester, category depth); seed runs; factories compile.

## Phase objective

Build the entire database of `docs/05` (every `T-` table and every unprefixed table — including `slug_redirects`, `credit_note_sequences`, `legal_page_versions`, `rate_limit_buckets`, `email_outbox.priority`, `orders.split_approval_request_id` — all enums, indexes, triggers and the `partner_balances` and `customer_credits` views) as forward-only Drizzle migrations, plus the typed service contracts and Zod schemas of every module so that Phases 3–6 can run concurrently with no hidden coupling. The cross-phase contracts in master plan §5 are stubbed and unit-tested here; factories and the full seed of docs/05 §14 make every later test suite reproducible. Nothing in P2 contains business logic beyond stubs.

## Prerequisites

- P1 done (Drizzle client, env, `drizzle/0000_auth.sql`, test harness with Testcontainers, `scripts/seed.ts` skeleton with `seedRolesAndPermissions()`).
- Docs frozen: `docs/05` (all sections), `docs/06` §1.3 (validation conventions), §2 (input/output shapes), §4.1 (`PaymentProvider`), `docs/04` §7.3 (`DeliveryHandler`), §9 (`LLMProvider`), MASTER_SPEC §7 rows: "Manual entitlement grants", "Payment immutability", "Project order splits", "Subscription grace".
- No founder decision is pending for the schema: docs/05 already carries `webhook_events`, `rate_limit_buckets`, `credit_note_sequences`, `legal_page_versions`, `slug_redirects`, `email_outbox.priority`, `orders.split_approval_request_id`, the `customer_credits` view, `customer_profiles.notification_prefs` and the nullable `entitlements.order_item_id` (manual grants create no synthetic order — API-DEL-11, MASTER_SPEC §7 "Manual entitlement grants").
- Env: local Docker Postgres, `DATABASE_URL_UNPOOLED` for migrations.

## Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P2.1 | Schema domain A — identity, catalog, offerings, ownership, content, settings | domain-standard | — |
| P2.2 | Schema domain B — commerce, payments, invoices, finance, approvals, audit | domain-critical | — |
| P2.3 | Schema domain C — delivery, subscriptions, leads, queries, chat, notifications, ops | domain-standard | — |
| P2.4 | Integrator — merged migration set, custom SQL (triggers, view), enums, indexes, `drizzle-kit check` | domain-critical | P2.1, P2.2, P2.3 |
| P2.5 | Contracts A — `contracts.ts` + `types.ts` (Zod) for catalog, offerings, media, content, blog, ownership, settings, fx, search, users | domain-standard | P2.1 |
| P2.6 | Contracts B — orders, payments (+ `PaymentProvider`), coupons, quotes, invoices, finance, approvals, audit | domain-critical | P2.2 |
| P2.7 | Contracts C — entitlements (+ `DeliveryHandler`), delivery, subscriptions, leads, queries, chat (+ `LLMProvider`), notifications, analytics, dashboard-widgets | domain-standard | P2.3 |
| P2.8 | Cross-phase contract stubs and contract tests (master plan §5) | domain-critical | P2.4, P2.5, P2.6, P2.7 |
| P2.9 | Factories (`tests/factories/*`) | domain-standard | P2.4, P2.5–P2.7 |
| P2.10 | Full seed per docs/05 §14 (+ `--production`, `db:anonymise`) | domain-standard | P2.4, P2.9 |
| P2.11 | Migration & trigger test suite, phase gate | reviewer + domain-critical | P2.4, P2.10 |

### P2.1 Schema domain A — identity, catalog, offerings, ownership, content, settings
- Owner profile: domain-standard
- Requirement IDs: FR-AUTH-09, FR-CAT-01, FR-CAT-02, FR-CAT-04, FR-CAT-12, FR-CAT-13, FR-CAT-14, FR-CAT-16, FR-CONT-01, FR-CONT-04, FR-CONT-05, FR-ADM-09, D-303, D-313, D-314, D-502, D-508, D-509, D-807, A-201, T-users, T-roles, T-user_roles, T-partners, T-customer_profiles, T-categories, T-tags, T-product_tags, T-slug_redirects, T-products, T-product_versions, T-product_faqs, T-product_testimonials, T-product_media, T-media, T-product_blogs, T-offerings, T-offering_prices, T-offering_payment_methods, T-product_ownerships, T-product_ownership_lines, landing_chapters, services, case_studies, testimonials, client_logos, faqs, legal_pages, legal_page_versions, site_settings, featured_products, wishlists
- Description: Author Drizzle schema files for docs/05 §1–§4 and §10 in the owning module directories: `src/modules/users/schema.ts` (extends P1's `users` with `phone`, `phone_verified`, `status`, `display_currency`, `theme_pref`, `deleted_at`, `anonymized_at`; `roles`, `user_roles`, `permissions`, `role_permissions`, `partners`, `customer_profiles` with `notification_prefs`), `src/modules/catalog/schema.ts` (categories, tags, product_tags, slug_redirects, products with generated `search_vector` and the enum `product_status`, product_versions, product_faqs, product_testimonials, product_media, wishlists, featured_products), `src/modules/media/schema.ts` (media), `src/modules/blog/schema.ts` (product_blogs), `src/modules/offerings/schema.ts` (offerings, offering_prices, offering_payment_methods with enums `purchase_model`, `billing_interval`, `delivery_type`, `payment_method`), `src/modules/ownership/schema.ts` (product_ownerships with partial unique active index, product_ownership_lines), `src/modules/content/schema.ts` (landing_chapters, services, case_studies, testimonials, client_logos, faqs, legal_pages, legal_page_versions with `UNIQUE(legal_page_id, version)` — FR-CONT-04 retention), `src/modules/settings/schema.ts` (site_settings). Every table has `created_at`; mutable ones `updated_at`. Money columns `bigint` + `char(3)`. Hand the files to P2.4; do not run `drizzle-kit generate` yourself.
- Owned paths: `src/modules/{users,catalog,media,blog,offerings,ownership,content,settings}/schema.ts`. Forbidden: `drizzle/**` (P2.4), `*/contracts.ts`, `*/types.ts`.
- Dependencies: P1.5 (`drizzle/0000_auth.sql` column names).
- Expected files/modules: the eight `schema.ts` files above + `src/modules/_shared/enums.ts` (shared enum declarations used across domains: `currency`, `theme`).
- Tests required: `tests/unit/schema/domain-a.test.ts` — each table in docs/05 §1–§4, §10 exists with the documented column names (a fixture list transcribed from the doc), `products.search_vector` is a generated column, `product_ownerships` has the partial unique index, `categories.parent_id` self-FK.
- Acceptance criteria:
  - [ ] every column named in docs/05 §1–§4 and §10 is present with the documented type/nullability
  - [ ] no `numeric`/`float` money columns (grep test)
  - [ ] `search_vector` generated expression covers name, short_description, description text, tags, tech_stack, industry (FR-CAT-07)
- Definition of Done: schema files + unit column tests + PROGRESS row; CI green after P2.4 merges the migration.
- Potential risks and mitigations: three authors declaring the same enum → all enums that cross domains live in `_shared/enums.ts` and are added by P2.4 only; `users` overlap with P1 → alter-only in this domain.

### P2.2 Schema domain B — commerce, payments, invoices, finance, approvals, audit
- Owner profile: domain-critical
- Requirement IDs: FR-COM-01, FR-COM-05, FR-COM-07, FR-COM-09, FR-COM-11, FR-COM-12, FR-COM-13, FR-PAY-01, FR-PAY-09, FR-PAY-10, FR-PAY-13, FR-PAY-15, FR-FIN-01, FR-FIN-03, FR-FIN-04, FR-FIN-06, FR-FIN-07, FR-FIN-08, FR-FIN-09, FR-FIN-13, FR-ADM-01, FR-ADM-02, FR-ADM-07, NFR-LEGAL-01, BR-05, BR-06, BR-13, BR-16, BR-17, D-515, D-516, D-520, T-coupons, T-custom_quotes, T-orders, T-order_items, T-payments, T-refunds, T-invoices, T-ledger_entries, T-allocations, T-payouts, T-expenses, T-fx_rates, T-approval_requests, T-audit_logs, coupon_redemptions, user_offering_purchases, invoice_sequences, credit_notes, credit_note_sequences, approval_decisions
- Description: Author `src/modules/coupons/schema.ts` (coupons, coupon_redemptions), `src/modules/quotes/schema.ts` (custom_quotes), `src/modules/orders/schema.ts` (orders with `order_type`, `order_status` enums, `order_no` unique and `split_approval_request_id` FK → approval_requests (project orders, API-COM-14); order_items with `ownership_id` and `split_snapshot jsonb`; user_offering_purchases with unique `(user_id, offering_id)`; sequence `order_no_seq`), `src/modules/payments/schema.ts` (payments with `payment_status` enum incl. `refunded`, `customer_credit_minor`, `amount_refunded_minor`; refunds), `src/modules/invoices/schema.ts` (invoices, invoice_sequences, credit_notes, credit_note_sequences — gapless like invoices), `src/modules/finance/schema.ts` (ledger_entries with `entry_type` and `party_type` enums, `seq bigserial unique`; allocations; payouts; expenses; fx_rates), `src/modules/approvals/schema.ts` (approval_requests with the nine `approval_type` values including `project_order.split`; approval_decisions with `UNIQUE(request_id, decided_by)`), `src/modules/audit/schema.ts` (audit_logs). Indexes per docs/05 §13. Provide the SQL bodies (not Drizzle) for the triggers of docs/05 §12 that belong to this domain to P2.4 in `drizzle/custom/_drafts/domain-b.sql`: append-only on ledger_entries/allocations/payouts/invoices/credit_notes/audit_logs; payments frozen after `confirmed` except `confirmed → refunded` + `amount_refunded_minor`; `order_items.ownership_id` write-once-then-frozen except the confirm-time re-validation update (docs/06 §4.2); approver ≠ requester on approval_decisions; and the `partner_balances` view SQL (Σ partner_allocation − Σ refund_partner_allocation − Σ payout − Σ expense share per partner, currency, plus INR column) and the `customer_credits` view (payments with `customer_credit_minor > 0` not yet refunded/applied, docs/05 §7).
- Owned paths: `src/modules/{coupons,quotes,orders,payments,invoices,finance,approvals,audit}/schema.ts`, `drizzle/custom/_drafts/domain-b.sql`. Forbidden: `drizzle/*.sql` migrations (P2.4).
- Dependencies: P2.1 only for FK targets (users, products, offerings, partners) — reference by table name in schema; compile after P2.1 lands.
- Expected files/modules: the eight schema files + draft SQL.
- Tests required: `tests/unit/schema/domain-b.test.ts` column fixture diff; `tests/unit/schema/enums.test.ts` asserts `entry_type` has the 15 values, `approval_type` the 9, `order_status` the 7, `payment_status` the 5.
- Acceptance criteria:
  - [ ] every column in docs/05 §5, §7, §8 present, money as bigint, FX as `numeric(18,8)`
  - [ ] `invoices.order_id` unique; `invoice_sequences(fy pk, last_seq)` and `credit_note_sequences(fy pk, last_seq)`; `credit_notes.credit_no` unique; `orders.split_approval_request_id` present
  - [ ] draft trigger SQL covers all five rules of docs/05 §12 owned by this domain plus the view
- Definition of Done: schema + draft SQL + unit tests + PROGRESS row; CI green after P2.4.
- Potential risks and mitigations: payment-status trigger semantics (docs/05 vs docs/06 #10) → implement exactly MASTER_SPEC §7 "Payment immutability" (single transition) and test in P2.11 (FI-07); `partner_balances` and `customer_credits` are plain SQL views (docs/05 §7; docs/06 §3.3 and docs/12 §2.3 confirm there is no refresh job).

### P2.3 Schema domain C — delivery, subscriptions, leads, queries, chat, notifications, ops
- Owner profile: domain-standard
- Requirement IDs: FR-DEL-01, FR-DEL-04, FR-DEL-08, FR-DEL-10, FR-DEL-11, FR-DEL-12, FR-DEL-13, FR-LEAD-01, FR-LEAD-03, FR-LEAD-07, FR-CHAT-03, FR-CHAT-04, FR-CHAT-08, FR-NOTIF-01, FR-NOTIF-05, FR-ADM-14, FR-SEO-06, FR-OPS-01, FR-CONT-06, FR-SEC-01, D-607, D-608, D-1108, D-1503, T-entitlements, T-subscriptions, T-service_progress, T-downloads, T-delivery_tasks, T-release_files, T-leads, T-queries, T-conversations, T-chat_messages, lead_activities, query_messages, chat_usage_daily, knowledge_chunks, prompt_versions, notifications, email_outbox, dashboard_layouts, analytics_events, job_runs, webhook_events, files_upload_intents, rate_limit_buckets
- Description: Author `src/modules/entitlements/schema.ts` (entitlements with `order_item_id` **nullable** + partial unique index, `provisioning_state`, `license_key_enc`; release_files), `src/modules/delivery/schema.ts` (service_progress, downloads, delivery_tasks), `src/modules/subscriptions/schema.ts` (subscriptions with `subscription_status`), `src/modules/leads/schema.ts` (leads, lead_activities), `src/modules/queries/schema.ts` (queries incl. `source='email'|'manual'`, query_messages), `src/modules/chat/schema.ts` (conversations, chat_messages, chat_usage_daily, prompt_versions), `src/modules/search/schema.ts` (knowledge_chunks with GIN), `src/modules/notifications/schema.ts` (notifications, email_outbox with `priority smallint default 5` per docs/05 §11), `src/modules/dashboard-widgets/schema.ts` (dashboard_layouts), `src/modules/analytics/schema.ts` (analytics_events), `src/modules/_ops/schema.ts` (job_runs, webhook_events with `UNIQUE(provider, event_id)`, rate_limit_buckets `(key pk, count, window_start, expires_at)` per docs/05 §11), `src/modules/media/schema.ts` addition `files_upload_intents` (coordinate: P2.1 owns `media/schema.ts`; this task supplies `files_upload_intents` in `src/modules/media/schema.intents.ts`). Indexes per docs/05 §13.
- Owned paths: `src/modules/{entitlements,delivery,subscriptions,leads,queries,chat,search,notifications,dashboard-widgets,analytics,_ops}/schema.ts`, `src/modules/media/schema.intents.ts`. Forbidden: `drizzle/**`.
- Dependencies: FK targets from P2.1/P2.2 by name.
- Expected files/modules: the twelve schema files.
- Tests required: `tests/unit/schema/domain-c.test.ts` fixture diff; asserts `entitlements.order_item_id` nullable with partial unique index, `chat_usage_daily` pk `(scope, day)`, `webhook_events` unique pair.
- Acceptance criteria:
  - [ ] every column in docs/05 §6, §9, §11 present, including `webhook_events`, `rate_limit_buckets` and `email_outbox.priority`
  - [ ] `notifications` index `(user_id, read_at, created_at desc)`; `analytics_events` index `(name, created_at)`
- Definition of Done: schema + unit tests + PROGRESS row; CI green after P2.4.
- Potential risks and mitigations: enum duplication with domain A/B (`delivery_type`, `update_policy`) → import from `offerings/schema.ts` / `_shared/enums.ts`.

### P2.4 Integrator — merged migration set, custom SQL, enums, indexes
- Owner profile: domain-critical
- Requirement IDs: FR-FIN-04, FR-ADM-02, FR-CAT-02, FR-CAT-12, FR-PAY-09, FR-FIN-06, NFR-DATA-04, BR-06, BR-07, BR-13, BR-17, docs/05 §12, §13, §15, docs/12 §5.2 (expand-first), MASTER_SPEC §4.1, §4.5
- Description: Own `drizzle/**`. Merge the three domains into `drizzle/0001_core.sql` generated by `drizzle-kit generate` from `drizzle.config.ts` (schema glob `src/modules/**/schema*.ts`), review the SQL by hand, then author `drizzle/custom/0001_triggers.sql` (append-only triggers on the six tables; payments-frozen trigger with the single permitted transition; `order_items.ownership_id` frozen-after-confirm trigger; `ownership_lines_sum` deferred constraint trigger raising `ownership_lines_sum`; `category_depth` trigger; `approval_decisions` trigger `approver_is_requester`), `drizzle/custom/0002_views.sql` (`partner_balances`, `customer_credits`), `drizzle/custom/0003_grants.sql` (app role: no TRUNCATE, no DELETE on append-only tables even bypassing triggers). Write the runner `scripts/migrate.ts` (`drizzle-kit migrate` then applies `drizzle/custom/*.sql` in order, records applied custom files in `_custom_migrations`), used by `pnpm db:migrate`, CI and `Dockerfile` `migrate.js`. Ensure `drizzle-kit check` passes in CI. Enforce one migration per later task (naming `NNNN_<phase-task>_<name>.sql`).
- Owned paths: `drizzle/**`, `drizzle.config.ts`, `scripts/migrate.ts`, `src/modules/_shared/enums.ts` (final). Forbidden: module `schema.ts` files (edit requests go back to the domain author).
- Dependencies: P2.1, P2.2, P2.3.
- Expected files/modules: `drizzle/0001_core.sql`, `drizzle/meta/*`, `drizzle/custom/0001_triggers.sql`, `0002_views.sql`, `0003_grants.sql`, `scripts/migrate.ts`.
- Tests required: `tests/integration/migrations/apply-clean.test.ts` (fresh DB → all migrations + custom → `drizzle-kit check` clean, applied twice is a no-op); trigger tests are P2.11.
- Acceptance criteria:
  - [ ] `pnpm db:migrate` on an empty database succeeds and is idempotent
  - [ ] `drizzle-kit check` reports no drift
  - [ ] all six append-only tables, the payments trigger, ownership sum, category depth and approver trigger exist (`pg_trigger` query in test)
  - [ ] `partner_balances` view selects the columns docs/06 API-FIN-03 needs
- Definition of Done: migrations + runner + apply test + PROGRESS row + CI green.
- Potential risks and mitigations: generated SQL orders FKs badly across domains → single migration file, hand-reviewed; trigger SQL untested until P2.11 → integrator runs P2.11's trigger suite locally before merging.

### P2.5 Contracts A — catalog, offerings, media, content, blog, ownership, settings, fx, search, users
- Owner profile: domain-standard
- Requirement IDs: API-AUTH-02..10, API-CAT-01..21, API-CAT-30..36, API-CONT-01..09, API-ADM-06..12, API-DASH-01..03, API-FIN-12, docs/06 §1.3, §1.8, §1.10
- Description: For each module create `types.ts` (Zod input schemas and output types transcribed from the docs/06 rows, `.strict()`, shared primitives from `src/modules/_shared/zod.ts`: `slug`, `Money`, `bps`, `uuid`, `richText` allow-list schema, `listParams`) and `contracts.ts` (TypeScript interface of the module's `service` — e.g. `CatalogService.createProduct(ctx, input): Promise<...>` — plus `queries` signatures and the cache tags each mutation must revalidate). Module folders get `index.ts` re-exporting `contracts` and `types` only; `service.ts`/`actions.ts`/`queries.ts` are created as `throw new NotImplemented('P3.x')` stubs so imports compile.
- Owned paths: `src/modules/{users,catalog,offerings,media,content,blog,ownership,settings,fx,search}/{types,contracts,index,service,actions,queries}.ts`, `src/modules/_shared/zod.ts`. Forbidden: schema files, other modules.
- Dependencies: P2.1 (column names for output types).
- Expected files/modules: 10 modules × 6 files + `_shared/zod.ts`.
- Tests required: `tests/unit/contracts/zod-a.test.ts` (each input schema accepts the docs/06 example shape and rejects an unknown key / wrong type; `slug` regex; `Money` integer-only), `tests/unit/contracts/rich-text.test.ts` (allow-list rejects `script` nodes).
- Acceptance criteria:
  - [ ] every API-ID in the scope list has a Zod input schema and a contract method named after the docs/06 action
  - [ ] `pnpm typecheck` passes with the stubs
- Definition of Done: contracts + Zod tests + PROGRESS row + CI green.
- Potential risks and mitigations: transcription errors vs docs/06 → each schema file cites its API-ID in a comment and the test fixture is copied from the doc row.

### P2.6 Contracts B — orders, payments, coupons, quotes, invoices, finance, approvals, audit
- Owner profile: domain-critical
- Requirement IDs: API-COM-01..14, API-PAY-01..08, API-FIN-01..11, API-ADM-01..05, docs/06 §4.1 (`PaymentProvider`), §4.2 (posting formula), master plan §5
- Description: As P2.5 for these modules, plus the frozen interfaces: `src/modules/payments/providers/types.ts` (`PaymentProvider`, `ConfirmInput`, `PaymentResult`, `PaymentInstructions` union `UpiInstructions | BankInstructions`) verbatim from docs/06 §4.1; `src/modules/finance/contracts.ts` with `postOrderPaid(orderId, tx)`, `postRefund(refundId, tx)`, `postPayout(payoutId, tx)`, `postExpense(expenseId, tx)`, `postAdjustment(approvalRequestId, tx)` and the pure `computeAllocation(item, ownership, deductions)` signature; `src/modules/approvals/contracts.ts` with `request(type, subject, payload, requesterId, tx)`, `decide(requestId, adminId, decision, comment?, tx)`, `execute(requestId, tx)`, `registerApplyHandler(type, handler)`, `registerRejectHandler(type, handler)`; `src/modules/audit/contracts.ts` with `log(actor, action, subject, before, after, tx)` (replacing P1's port). `ApprovalType` enum with the nine values.
- Owned paths: `src/modules/{orders,payments,coupons,quotes,invoices,finance,approvals,audit}/{types,contracts,index,service,actions,queries}.ts`, `src/modules/payments/providers/types.ts`. Forbidden: schema files.
- Dependencies: P2.2.
- Expected files/modules: 8 modules × 6 files + provider types.
- Tests required: `tests/unit/contracts/zod-b.test.ts`; `tests/unit/contracts/payment-provider.test.ts` (type-level: a fake provider satisfies the interface; `confirm` must not receive ledger types — compile-time assertion with `expectTypeOf`).
- Acceptance criteria:
  - [ ] `PaymentProvider` matches docs/06 §4.1 exactly (fixture comparison of method names and parameter names)
  - [ ] finance/approvals/audit contract method names match master plan §5 exactly
- Definition of Done: contracts + tests + PROGRESS row + CI green.
- Potential risks and mitigations: later phases "improving" a §5 contract → `tests/static/contract-freeze.test.ts` (P2.8) hashes the contract files; changes need an ADR reference in the test.

### P2.7 Contracts C — entitlements, delivery, subscriptions, leads, queries, chat, notifications, analytics, dashboard-widgets
- Owner profile: domain-standard
- Requirement IDs: API-DEL-01..14, API-LEAD-01..07, API-CHAT-01..15, API-NOTIF-01..04, API-OPS-01..03, API-ADM-13..14, docs/04 §7.3 (`DeliveryHandler`), §7.6 (widget registry shape), §9 (`LLMProvider`), master plan §5
- Description: As P2.5, plus frozen interfaces: `src/modules/delivery/handlers/types.ts` (`DeliveryHandler { type; onGranted(ctx, entitlement, tx); onRevoked(ctx, entitlement, mode: 'hard'|'soft', tx); render(entitlement, viewer): EntitlementView; adminActions(entitlement): AdminAction[]; isFulfilled(entitlement): boolean }`), `src/modules/entitlements/contracts.ts` with `grantForOrder(orderId, tx)`, `revoke(entitlementId, reason, tx)`, `grantManual(input, tx)`; `src/modules/chat/providers/types.ts` (`LLMProvider { stream(system, messages, opts: { model, maxTokens, timeoutMs, tools? }): AsyncIterable<LLMEvent> }` with `LLMEvent` = `delta | tool_call | done(stopReason, usage)`); `src/modules/notifications/contracts.ts` with `emit(target: userId | 'admins', type: NotificationType, payload, channels?, tx)` and the `NotificationType` union of the 28 types listed in docs/06 §2.11; `NotificationChannel` interface; `src/modules/dashboard-widgets/contracts.ts` (`WidgetDefinition { key; title; group; defaultSize; minSize; requiredPermission; loader }` and the 20 widget keys as a const tuple).
- Owned paths: `src/modules/{entitlements,delivery,subscriptions,leads,queries,chat,notifications,analytics,dashboard-widgets}/{types,contracts,index,service,actions,queries}.ts`, `src/modules/delivery/handlers/types.ts`, `src/modules/chat/providers/types.ts`. Forbidden: schema files.
- Dependencies: P2.3.
- Expected files/modules: 9 modules × 6 files + two interface files.
- Tests required: `tests/unit/contracts/zod-c.test.ts`; `tests/unit/contracts/notification-types.test.ts` (28 types present, matches docs/06 list fixture); `tests/unit/contracts/widget-keys.test.ts` (20 keys match API-ADM-14).
- Acceptance criteria:
  - [ ] `DeliveryHandler`, `LLMProvider`, `notifications.emit`, `entitlements.grantForOrder/revoke` signatures match master plan §5 and docs/04
  - [ ] all 28 notification types and 20 widget keys enumerated
- Definition of Done: contracts + tests + PROGRESS row + CI green.
- Potential risks and mitigations: `EntitlementView` shape drift between P5 and P7 → the full shape from API-DEL-01 is a Zod output schema here and P7 consumes the inferred type.

### P2.8 Cross-phase contract stubs and contract tests
- Owner profile: domain-critical
- Requirement IDs: master plan §5, §7 "Hidden coupling between P4 and P5", docs/06 §6 "What must never change"
- Description: Implement compile-safe stubs for every master plan §5 contract that record calls (`tests/stubs/*`): `finance.postOrderPaid` etc. resolve with typed empty results; `entitlements.grantForOrder` returns `[]`; `approvals.request/decide/execute` with an in-memory registry; `notifications.emit` collects; `audit.log` writes a real `audit_logs` row (audit is the one contract implemented for real in P2 because P3.1 depends on it and every P3–P6 test asserts audit rows — the implementation is minimal: insert row inside `tx`, diff builder deferred to P3.1). Provide `tests/stubs/index.ts` with `installStubs()` used by P3–P6 integration tests so P5 never imports P4's real service (master plan §7). `tests/static/contract-freeze.test.ts` snapshots the SHA-256 of every `contracts.ts`, `providers/types.ts`, `handlers/types.ts`; changing one requires updating the snapshot with an `ADR-xx` reference in the commit.
- Owned paths: `tests/stubs/**`, `tests/static/contract-freeze.test.ts`, `src/modules/audit/service.ts` (minimal real insert). Forbidden: other `service.ts` files.
- Dependencies: P2.4, P2.5, P2.6, P2.7.
- Expected files/modules: `tests/stubs/{finance,entitlements,approvals,notifications,payment-provider,llm-provider,delivery-handler}.ts`, `tests/stubs/index.ts`, `tests/static/contract-freeze.test.ts`.
- Tests required: `tests/unit/stubs/*.test.ts` (each stub satisfies its interface and records calls), `tests/integration/audit/minimal-log.test.ts` (row written inside the caller's transaction; rolled back with it), contract-freeze snapshot.
- Acceptance criteria:
  - [ ] every §5 contract has a stub and a freeze hash
  - [ ] `audit.log` inserts within the passed `tx`
- Definition of Done: stubs + tests + PROGRESS row + CI green.
- Potential risks and mitigations: stubs diverging from real behaviour → P4/P5/P6 replace stubs with their real service in their own integration tests only for their own module.

### P2.9 Factories
- Owner profile: domain-standard
- Requirement IDs: docs/10 §3 (factories, determinism), FR-OPS-04
- Description: `tests/factories/*.ts`: `makeUser({ role, verified, status })`, `makeAdmin()`, `makePartner()`, `makeCategory()`, `makeProduct({ status })`, `makeOffering({ purchaseModel, deliveryType, prices, methods })`, `makeOwnership({ lines, companyCutBps, status })`, `makeOrder({ items, coupon })`, `makePayment({ status })`, `makeEntitlement()`, `makeSubscription()`, `makeLead()`, `makeQuery()`, `makeConversation()`, `makeCoupon()`, `makeQuote()`, `makeMedia()`, `makeInvoice()` — all typed builders with `@faker-js/faker` seeded 1207, inserting through Drizzle directly in P2 (services do not exist yet) but structured so P3–P6 can switch them to `service.ts` calls per docs/10 §3 ("every factory inserts through service.ts, not raw SQL, except immutability tests"). Each factory returns the inserted row and accepts `tx`.
- Owned paths: `tests/factories/**` (except README from P1.9). Forbidden: `src/**`.
- Dependencies: P2.4 (tables), P2.5–P2.7 (types).
- Expected files/modules: 18 factory files + `tests/factories/index.ts`.
- Tests required: `tests/integration/factories/compile-and-insert.test.ts` (every factory inserts a valid row in a rolled-back transaction; ownership factory with 9999 bps fails with `ownership_lines_sum`).
- Acceptance criteria:
  - [ ] every factory inserts successfully and is deterministic under the seed
  - [ ] factories never hardcode seed product ids (docs/10 §3)
- Definition of Done: factories + insert test + PROGRESS row + CI green.
- Potential risks and mitigations: factories bypassing triggers they should hit → integration test proves the ownership trigger fires through the factory.

### P2.10 Full seed per docs/05 §14
- Owner profile: domain-standard
- Requirement IDs: FR-OPS-04, FR-CAT-01, D-018, docs/05 §14, docs/10 §3 (test users, ownership splits, coupons), docs/12 §1 (production seed subset), §5.1 (`db:anonymise`), §5.2 (`seeded_at`)
- Description: Extend `scripts/seed.ts` (keep `seedRolesAndPermissions()` from P1.11): two Super Admin users (`ceo@codekraft.test`, `cfo@codekraft.test`, argon2id password from env `SEED_ADMIN_PASSWORD`, TOTP off) + partners; test customers `buyer@`, `unverified@`, `suspended@`, third admin `partner@codekraft.test` (role `admin`, non-production only); categories (2 levels), tags; five products with offerings/prices/methods/media placeholders/versions/faqs/testimonials — FitDesk Pro (SaaS subscription monthly, 60/40, 10 % cut), TradeFlow (license one-time, 100 % CFO), MIS Portal (hosted + 3 service steps, 50/50), Resume/Portfolio Website (download one-time, cap 3, 50/50), E-commerce Website (download + service, 50/50) — each with an `active` ownership version (approved by the other admin in seed data) and `published` status in non-production, `draft` in production; landing chapters (five keys), eight services, three case studies, testimonials, logos, site + chatbot FAQs, legal pages (placeholders, refund page states manual-payment-only + gateway placeholder), `site_settings` (base_currency INR, enabled currencies, tax_rate_bps 1800 with gstin null, seller details "CodeKraft", upi_vpa/bank_details from env, default_theme dark-cinematic, ai_model, caps 200/20, retention 12/7, all flags per docs/13 §6), coupons `WELCOME10`, `FLAT500`, `EXPIRED`, one active `prompt_versions` row, `invoice_sequences` untouched. `--production` writes only the docs/12 §1 subset and sets `site_settings.seeded_at`. `scripts/anonymise.ts` for staging resets (`pnpm db:anonymise`). All upserts keyed by natural keys; seeds are data only, never imported by `src/**`.
- Owned paths: `scripts/seed.ts`, `scripts/seed/**`, `scripts/anonymise.ts`. Forbidden: `src/**`, `drizzle/**`.
- Dependencies: P2.4, P2.9 (may reuse factory helpers via `scripts/seed/data/*`).
- Expected files/modules: `scripts/seed.ts`, `scripts/seed/data/{users,catalog,content,settings,coupons}.ts`, `scripts/anonymise.ts`.
- Tests required: `tests/integration/seed/full-seed.test.ts` (runs twice, idempotent; five products by slug; FitDesk ownership 6000/4000 bps with 1000 cut; `partner@` absent with `--production`; products `draft` with `--production`; `seeded_at` set once), `tests/integration/seed/anonymise.test.ts` (emails → `user-<id>@example.test`, keys/bank details replaced, orders intact).
- Acceptance criteria:
  - [ ] `pnpm db:reset` yields the docs/05 §14 dataset; `pnpm db:seed --production` yields the docs/12 §1 subset
  - [ ] no `src/**` file imports from `scripts/seed*`
  - [ ] seed passes all triggers (ownership sums, category depth)
- Definition of Done: seed + tests + PROGRESS row + CI green (integration job seeds).
- Potential risks and mitigations: seed becomes the hidden "catalog in code" (D-018) → grep test forbids imports; media placeholders need real objects → seed writes `media` rows pointing at `public/seed/*.png` copied to MinIO in test setup.

### P2.11 Migration & trigger test suite, phase gate
- Owner profile: reviewer + domain-critical
- Requirement IDs: FI-03, FI-07, SA-08, SA-09, FR-FIN-04, FR-ADM-02, FR-CAT-02, FR-CAT-12, FR-PAY-09, master plan §6 (P2 gate), docs/10 §13 (P0 row: migrations + all DB §12 triggers)
- Description: `tests/integration/triggers/*.test.ts` as app role: append-only (UPDATE and DELETE on ledger_entries, allocations, payouts, invoices, credit_notes, audit_logs each raise — FI-07, SA-09); payments frozen (after `confirmed`: changing `amount_received_minor` raises; `confirmed → refunded` with `amount_refunded_minor` succeeds once; second transition raises); `order_items.ownership_id` frozen after confirm; ownership sum 9999/10001 raises `ownership_lines_sum`, 10000 with one line passes (FI-03); category depth 3 raises; `approval_decisions.decided_by = requested_by` raises `approver_is_requester` (SA-08); `partner_balances` returns zero rows on empty ledger and correct sums on a hand-built fixture (FI-06 precursor); one-time purchase unique index; invoice `order_id` unique. Then run the whole P2 gate and write `implementation/reviews/P2-review.md`.
- Owned paths: `tests/integration/triggers/**`, `implementation/reviews/P2-review.md`. Forbidden: `src/**`, `drizzle/**` (findings go back to P2.4).
- Dependencies: P2.4, P2.10.
- Expected files/modules: `tests/integration/triggers/{append-only,payments-frozen,ownership-sum,category-depth,approver,partner-balances,unique-indexes}.test.ts`.
- Tests required: the files above, tagged `@security` where they cover SA-08/SA-09.
- Acceptance criteria:
  - [ ] every docs/05 §12 rule has a passing negative and positive test
  - [ ] migrations apply on a clean DB in CI; seed runs; factories compile (master plan §6)
  - [ ] review file lists ownership-map compliance (no doc corrections expected — docs/05 already carries every table, column and view built here)
- Definition of Done: trigger suite + review + PROGRESS statuses + CI green.
- Potential risks and mitigations: tests run as superuser and bypass grants → harness connects as `app` role (docker init from P1.1).

## Parallelisation map

```
P2.1 ─┐            ┌─ P2.5 ─┐
P2.2 ─┼─ P2.4 ─────┼─ P2.6 ─┼─ P2.8 ─┐
P2.3 ─┘            └─ P2.7 ─┘        ├─ P2.11
                   P2.9 ─── P2.10 ───┘
```

- P2.1, P2.2, P2.3 run concurrently: disjoint module directories; shared enums are declared once in `_shared/enums.ts` by P2.4 (authors reference them by agreed names listed in this file).
- P2.4 is the single integrator and the only writer of `drizzle/**`; nothing merges to the integration branch before P2.4.
- P2.5, P2.6, P2.7 run concurrently after their domain's schema is merged (they only need column names; they may start against the schema files before P2.4 finishes generation).
- P2.9 waits for P2.4 (tables) and can overlap with P2.5–P2.7 by importing schema tables directly.
- P2.10 after P2.9; P2.8 after all contracts; P2.11 last.
- Hidden dependency avoided: `media/schema.ts` (P2.1) vs `files_upload_intents` (P2.3) → separate file `schema.intents.ts`.

Shared enums and cross-domain types are declared exactly once; the table below is the agreement the three schema authors code against before P2.4 generates the migration (any deviation is a P2.4 merge blocker):

| Enum / shared type | Declared in | Consumers | Values (append-only after P2) |
|--------------------|-------------|-----------|-------------------------------|
| `currency` | `_shared/enums.ts` (P2.4) | every money column | `INR, USD, EUR, GBP, CAD` |
| `theme` | `_shared/enums.ts` | `users.theme_pref`, `site_settings` | `dark-cinematic, light-editorial` |
| `payment_method` | `offerings/schema.ts` (P2.1) | `offering_payment_methods`, `payments.provider` (P2.2) | `manual_upi, manual_bank, razorpay, stripe, paypal` |
| `delivery_type` | `offerings/schema.ts` (P2.1) | `offerings`, `entitlements` (P2.3) | `saas, hosted, download, license, service, custom` |
| `update_policy` | `offerings/schema.ts` (P2.1) | `entitlements` (P2.3) | `all_free, during_access, major_paid` |
| `purchase_model`, `billing_interval` | `offerings/schema.ts` (P2.1) | `subscriptions.interval` (P2.3) | per docs/05 §3 |
| `product_status` | `catalog/schema.ts` (P2.1) | catalog only | per docs/05 §2 |
| `order_type`, `order_status`, `payment_status` | `orders`/`payments` (P2.2) | finance (P2.2), entitlements (P2.3) | per docs/05 §5 |
| `entry_type`, `party_type` | `finance/schema.ts` (P2.2) | finance only | 15 / 6 values, docs/05 §7 |
| `approval_type`, `approval_status`, `decision` | `approvals/schema.ts` (P2.2) | catalog, ownership, payments, finance, users, orders | 9 types incl. `project_order.split` |
| `entitlement_status`, `provisioning_state` | `entitlements/schema.ts` (P2.3) | delivery, subscriptions | per docs/05 §6 |
| `subscription_status` | `subscriptions/schema.ts` (P2.3) | entitlements queries | per docs/05 §6 |
| `lead_source`, `lead_status`, `lead_priority`, `activity_kind` | `leads/schema.ts` (P2.3) | chat (P2.3) | per docs/05 §9 |
| `query_source`, `query_status`, `author_kind` | `queries/schema.ts` (P2.3) | chat | per docs/05 §9 incl. `email, manual` |
| `media_kind`, `media_visibility` | `media/schema.ts` (P2.1) | catalog, content, delivery | per docs/05 §2 |

Cross-phase handoff after P2 (what each W3 phase receives):
- P3 receives schema A + contracts A, the approvals/audit contracts (B) and the `search` schema (C).
- P4 receives schema B + contracts B and the stub `entitlements.grantForOrder` (C).
- P5 receives schema C + contracts C, the `orders.createOrder` (with `expiresAt`/`renewal` fields)/`markFulfilledIfComplete` contract (B) and the `PaymentProvider` result types. Order expiry is P4's (`src/jobs/order-expiry.ts`, master plan §3).
- P6 receives schema C + contracts C, `notifications.emit` consumers list (all), `search.retrieve` contract (A).

## Phase Definition of Done

- All 11 tasks `done` in `PROGRESS.md`.
- CI `integration` job: clean DB → `0000_auth`, `0001_core`, custom triggers/views/grants → seed → trigger suite green; `drizzle-kit check` clean.
- Every table and column of docs/05 exists (fixture-diff tests for domains A/B/C pass).
- Every module directory under `src/modules` has `schema.ts` (where it owns tables), `types.ts`, `contracts.ts`, stub `service.ts`/`actions.ts`/`queries.ts`; `pnpm typecheck` green.
- Master plan §5 contracts stubbed, tested and frozen (`contract-freeze` snapshot).
- Factories and full seed pass; `--production` subset verified.
- No doc corrections are expected from P2 (docs/05 already lists every table, column and view above; docs/06 API-DEL-11 creates no synthetic order; there is no materialized-view refresh job). Any drift discovered goes to `CHANGELOG.md` "Documentation corrections" per master plan §7.

## Phase risks

| Risk | Mitigation |
|------|------------|
| P2 bottleneck (master plan §7) | three schema authors + three contract authors in parallel; integrator only merges and writes SQL |
| Payment-immutability trigger semantics | docs/05 §12, docs/06 §7 #10 and MASTER_SPEC §7 agree (single transition `confirmed → refunded` + `amount_refunded_minor`); P2.11 encodes it |
| Contract transcription errors propagate to four phases | fixture-from-doc tests per API-ID; contract freeze |
| Seed drifting into "catalog in code" | import-grep test; production seed subset test |
| Enum value lists incomplete (append-only per docs/06 §6) | `enums.test.ts` counts values against the doc |

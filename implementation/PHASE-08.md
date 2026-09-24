# PHASE-08 — Admin app UI

**Wave:** W4 (parallel with P7; 3 agents: A = shell + dashboard widgets + catalog editors + approvals, B = orders/customers/entitlements/finance, C = leads/queries/chat/content/settings/audit) · **Roadmap items:** R1-10 (UI), R1-21, R1-23 (UI), plus admin halves of R1-06, R1-07, R1-12–R1-16, R1-18–R1-20 · **Master plan §6 gate:** e2e: all admin journeys in `docs/10`; widget layout persistence; approvals inbox; payment confirm; finance screens.

## Phase objective

Build every `ui/screens/admin/*` screen on `admin.<domain>` against the tested P3–P6 actions: shell with login/TOTP and persistent notification inbox (10 s polling), the widget dashboard (registry of 20 widgets, per-admin react-grid-layout persistence), products list and the 12-tab product editor, approvals inbox, orders (list, detail with payment confirmation, manual/project order, quotes, coupons), customers, entitlements and delivery tasks, leads (table, kanban, detail), queries and chatbot monitor, the six finance screens, the six content editors with a Tiptap editor, settings (nine tabs), audit log and admin users. Designed for ≥ 1024 px with a read-mostly narrow layout for approvals, payment confirmation and notifications (MASTER_SPEC §7 "Admin minimum width"). Every mutation shows the approval-gated or destructive confirmation pattern of docs/07 §4.11 and every admin step in e2e asserts an audit row (SA-23).

## Prerequisites

- P1 (admin layout, host rewrite, TOTP), P3, P4, P5, P6 all done (master plan §2: P8 depends on all four).
- Specs: `ui/screens/admin/*.md` (33 files), `ui/sitemap.md` §4, `docs/07` §2.4, §3.4, §4.8–§4.13, `docs/08` §6.7, §6.8, §6.17, `docs/04` §7.6.
- `tiptapExtensions` from P3.10; `EntitlementView`/`adminActions` from P5; widget contracts from P2.7.
- Env: same as P7 plus `NEXT_PUBLIC_ADMIN_URL`, `ADMIN_HOST`.
- Permissions: `ui/sitemap.md` §4 and docs/06 §1.2 use the same strings (`catalog.read|write`, `orders.read`, `orders.manual.write`, `payments.confirm`, `refunds.propose`, `delivery.tasks.write`, `entitlements.admin`, `customers.*`, `leads.*`, `chat.transcripts.read`, `chat.prompts.write`, `finance.ledger.read`, `finance.payout.record`, `finance.expense.write`, `finance.adjustment.propose`, `finance.reports.read`, `finance.statements.export`, `content.write`, `audit.read`, `dashboard.admin`, `settings.write`, `users.admin.manage`); only those strings may appear in P8 code, guarded by the P1.6 permission-list test.

## Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P8.1 | Admin shell, login + TOTP, notification inbox and polling | UI builder (A) | — |
| P8.2 | Widget dashboard: registry + 20 loaders (`modules/dashboard-widgets`) + grid UI + layout persistence | domain-standard + UI builder (A) | P8.1 |
| P8.3 | Products list, categories & tags | UI builder (A) | P8.1 |
| P8.4 | Product editor (12 tabs) | UI builder (A) | P8.3 |
| P8.5 | Approvals inbox | UI builder (A) | P8.1 |
| P8.6 | Orders list, order detail (confirm/fail/refund/fulfil), manual & project order, custom quotes, coupons | UI builder (B) | P8.1 |
| P8.7 | Customers list & detail | UI builder (B) | P8.1 |
| P8.8 | Entitlements & delivery tasks | UI builder (B) | P8.7 |
| P8.9 | Leads table, kanban board, lead detail | UI builder (C) | P8.1 |
| P8.10 | Queries inbox + thread, chatbot monitor | UI builder (C) | P8.1 |
| P8.11 | Finance screens (ledger, allocations, partners & payouts, expenses, adjustments, reports & statements) | UI builder (B) | P8.6 |
| P8.12 | Content editors (landing, services, case studies, testimonials & logos, FAQs, legal) with Tiptap editor | UI builder (C) | P8.9 |
| P8.13 | Settings (9 tabs), audit log, admin users & roles | UI builder (C) | P8.12 |
| P8.14 | Admin e2e + axe suites, phase gate | reviewer + domain-standard | all |

### P8.1 Admin shell, login + TOTP, notification inbox and polling
- Owner profile: UI builder (agent A)
- Requirement IDs: FR-AUTH-06, FR-AUTH-07, FR-AUTH-08, FR-NOTIF-02, FR-NOTIF-03, NFR-RT-01, NFR-PERF-04, D-707, D-1202, SCR-ADM-01, SCR-ADM-33, API-AUTH-01, API-AUTH-07, API-NOTIF-01, API-NOTIF-02, API-NOTIF-03, docs/07 §3.4, §4.4, §4.10, docs/08 §6.4, §6.14, S-18, S-19 (UI), MASTER_SPEC §7 "Admin minimum width"
- Description: `(admin)/layout.tsx` replacement: sidebar navigation per docs/07 §2.4 grouped (Dashboard, Approvals, Catalog, Commerce, Customers, Delivery, Leads, Queries, Chatbot, Finance, Content, Settings, Audit, Admin users) filtered by permissions from `getMe`; top bar with `NotificationBell` (TanStack Query polling `GET /api/notifications?since=` every 10 s, focus refetch, badge + toast on new rows, backoff on 429), user menu, "signed in elsewhere"/idle banners; narrow (< 1024 px) read-mostly layout exposing only Approvals, Payment confirmation and Notifications. `/login` (email/password, rate-limit and suspended states), `/login/totp` (code + backup code; 5 attempts then session discarded), TOTP enrolment dialog in the user menu (QR, backup codes download). `/notifications` inbox (unread/all, mark read/all, links). Shared admin primitives: `DataTable` (TanStack Table + shadcn table, server pagination/sort/filter per docs/06 §1.8, column visibility, CSV export hook), `ConfirmDialog` (destructive vs approval-gated variants per docs/07 §4.11), `StatusBadge` (docs/08 §6.8 via `status-tone`), `MoneyCell`, `AgeCell`, `PageHeader`, `FilterBar`.
- Owned paths: `src/app/(admin)/layout.tsx`, `src/app/(admin)/login/**`, `src/app/(admin)/notifications/**`, `src/components/admin/shell/**`, `src/components/admin/primitives/**`. Forbidden: `src/modules/**`, other admin routes.
- Dependencies: P1.5, P1.7, P6.1.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/components/admin/{data-table,confirm-dialog,notification-bell}.test.tsx` (polling interval 10 s; backoff on 429; keyboard); e2e `tests/e2e/admin/login-totp.spec.ts` (enrol, login with code, backup code, disable — SA-06 audited), `shell.spec.ts` (S-19: buyer rejected on admin host with audit row; `partner@` sees only permitted nav), `notifications.spec.ts` (new row visible ≤ 10 s; toast), axe both themes.
- Acceptance criteria:
  - [ ] S-18 admin steps and S-19 steps 1–2 pass through the UI
  - [ ] TOTP flow complete and audited (SA-06)
  - [ ] notification appears within 10 s without reload (NFR-RT-01)
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: polling storms with many tabs → `visibilitychange` pause; 429 backoff.

### P8.2 Widget dashboard
- Owner profile: domain-standard + UI builder (agent A)
- Requirement IDs: FR-ADM-13, FR-ADM-14, NFR-PERF-04, D-120, D-1101, SCR-ADM-02, API-ADM-13, API-ADM-14, API-OPS-03, API-PAY-07, docs/04 §7.6, docs/08 §6.17, docs/10 §7 (`dashboard-widgets`), docs/12 §8.1 (business signals)
- Description: `src/modules/dashboard-widgets/registry.ts` with the 20 widgets of API-ADM-14 (`revenue_by_period`, `revenue_by_product`, `revenue_by_partner`, `my_share`, `outstanding_payouts`, `expenses_vs_profit`, `payments_awaiting`, `publish_approvals`, `split_approvals`, `service_checklists_due`, `revocation_tasks`, `new_leads`, `pipeline_funnel`, `overdue_follow_ups`, `conversion_rate`, `open_queries`, `visits_top_products`, `chatbot_usage`, `catalog_status_counts`, `new_customers`) each `{ key, title, group, defaultSize, minSize, requiredPermission, loader }` where loaders call P4/P5/P6/P3 queries (`admin`-role scoping applied by those queries); `loadWidgetData(widgetKey, params {range, currency})` Server Action (read-only, not audited, cached 60 s per user/key/params); `getDashboardLayout`/`saveDashboardLayout` (`dashboard_layouts`, unknown key → `VALIDATION`, widgets filtered by permission). System/AI health widget group from `getSystemHealthWidget` (jobs red at 2× interval, FX age, outbox, chat usage, vitals p75, Sentry link, storage %). UI `/dashboard`: react-grid-layout (`domMax` Motion only here) with drag/resize, widget library drawer (add/remove), per-admin persistence, default layout for first login, Recharts with docs/08 §6.17 palette and text summaries for screen readers, range selector, loading skeletons, empty states, error retry.
- Owned paths: `src/modules/dashboard-widgets/**` (except frozen), `src/app/(admin)/dashboard/**`, `src/components/admin/widgets/**`. Forbidden: other modules.
- Dependencies: P8.1; P4.11, P5.5, P6.3, P6.5, P6.6, P6.8, P3.6 queries.
- Expected files/modules: registry, 20 loader files under `loaders/`, 20 widget components, `DashboardGrid.tsx`, `WidgetLibrary.tsx`.
- Tests required: unit `tests/unit/dashboard-widgets/{registry,permission-filter,layout-validation}.test.ts` (widget hidden without permission — docs/10 §7); integration `tests/integration/dashboard-widgets/loaders.test.ts` (each loader returns its typed shape on seed data; `partner@` gets scoped numbers); e2e `tests/e2e/admin/dashboard.spec.ts` (add/move/resize widget → persisted across reload and per admin; charts have text summaries), axe.
- Acceptance criteria:
  - [ ] 20 widgets registered with permissions; each loader typed and tested
  - [ ] layout persists per admin (master plan §6 "widget layout persistence")
  - [ ] loaders are not audited and are cached 60 s
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: react-grid-layout + React 19 compatibility → pinned version validated in P1.1; fallback to a fixed layout (master plan §7) is a founder decision.

### P8.3 Products list, categories & tags
- Owner profile: UI builder (agent A)
- Requirement IDs: FR-CAT-02, FR-ADM-05 (status display), FR-ADM-15, D-303, SCR-ADM-03, API-CAT-18, API-CAT-20, API-CAT-13, API-CAT-14, docs/07 §4.8, §4.12
- Description: `/products` DataTable (status, flags, offerings count, ownership summary, pending approval marker; filters `status, categoryId, partnerId, search`; sorts), row actions (edit, preview, unpublish, request archive/delete with approval-gated confirm), "New product" → editor. `/categories`: two-level tree editor (drag reorder, depth error surfaced), tags CRUD. `admin` role sees own products only.
- Owned paths: `src/app/(admin)/products/page.tsx`, `src/app/(admin)/categories/**`, `src/components/admin/catalog/{ProductsTable,CategoryTree,TagManager}.tsx`. Forbidden: editor (P8.4).
- Dependencies: P8.1; P3.6, P3.9.
- Expected files/modules: as listed.
- Tests required: e2e `tests/e2e/admin/products-list.spec.ts` (filters; S-19 step 3 scoping; archive request creates approval; depth-3 category refused with message), axe.
- Acceptance criteria:
  - [ ] `partner@` sees only own products; foreign product URL 404 (S-19 step 3)
  - [ ] archive/delete open the approval-gated confirmation and create requests
- Definition of Done: code + e2e + PROGRESS row + CI green.
- Potential risks and mitigations: none beyond table performance (catalog < 50 products).

### P8.4 Product editor (12 tabs)
- Owner profile: UI builder (agent A)
- Requirement IDs: FR-CAT-01, FR-CAT-03, FR-CAT-04, FR-CAT-08, FR-CAT-11, FR-CAT-12, FR-CAT-16, FR-CONT-05, FR-CONT-06, FR-CONT-07, FR-ADM-05, FR-SEO-02, D-304–D-315, D-121, D-509, SCR-ADM-04, API-CAT-01..12, API-CAT-16, API-CAT-21, docs/06 §3.5, docs/07 §4.7, §4.9, §4.14, docs/11 §A7 (content rules), S-10 steps 1/5, S-11 steps 1–3 (UI), MASTER_SPEC §7 "Unlisted product demo links"
- Description: `/products/new` and `/products/[id]?tab=` with tabs `basics` (name, slug with redirect warning, short description, category, tags, flags incl. unlisted with the demo-link warning, refundable, tax), `content` (Tiptap description, features/benefits/audience/use cases/industry/tech/requirements, live demo URL), `media` (upload via intents with progress, kinds, reorder, embed URL, presentation PDF, OG image, alt text required — docs/11 §A7), `offerings` (list + form per API-CAT-03 with discriminated `deliveryConfig`, prices per currency with base required and compare-at, payment methods flag-gated), `delivery` (service steps builder, instructions JSON editor, download cap, access months, update policy), `ownership` (versions table; propose form with bps sum live check; pending request status; apply history), `seo` (title/description/canonical, preview), `blog` (one blog: editor, cover, publish/unpublish), `versions` (semver, changelog editor, release file upload), `testimonials`, `faqs`, `publish` (readiness checklist mirroring API-CAT-11 rules, submit with optional `publishAt`, approval state, unpublish, preview link `/products/[id]/preview` rendering API-CAT-31 with draft visibility). Optimistic concurrency via `expectedUpdatedAt` → conflict banner.
- Owned paths: `src/app/(admin)/products/[id]/**`, `src/app/(admin)/products/new/**`, `src/components/admin/catalog/editor/**`, `src/components/admin/shared/{MediaUploader,RichTextEditor}.tsx` (RichTextEditor built here, reused by P8.12 — uses `tiptapExtensions` from P3.10). Forbidden: `src/modules/**`.
- Dependencies: P8.3; P3.5, P3.7, P3.8, P3.9, P3.10.
- Expected files/modules: 12 tab components + editor shell + uploader + rich-text editor.
- Tests required: unit `tests/unit/components/admin/{rich-text-editor,media-uploader,ownership-form}.test.tsx` (sum-bps validation; upload rejects disallowed MIME client-side too); e2e `tests/e2e/admin/product-editor.spec.ts` (S-11 steps 1–3: create → offering → media → ownership → submit → other admin approves with `publishAt`; own-approval button absent; S-10 steps 1 and 5 through the ownership tab; conflict banner on stale save), axe on every tab.
- Acceptance criteria:
  - [ ] S-11 steps 1–3 and S-10 steps 1/5 pass through the UI
  - [ ] readiness checklist blocks submit with field-level messages
  - [ ] uploads go through presigned PUT and complete; no direct bucket URLs in HTML
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: editor size → each tab lazy-loaded; Tiptap SSR issues → client-only component.

### P8.5 Approvals inbox
- Owner profile: UI builder (agent A)
- Requirement IDs: FR-ADM-01..04, BR-13, A-1101, SCR-ADM-05, API-ADM-01, API-ADM-02, API-ADM-03, API-ADM-04, docs/07 §4.11, S-07 step 2, S-10 step 3, S-11 step 2, S-13 (UI), docs/12 §11.9 (pending age)
- Description: `/approvals` with tabs "Pending for me", "Requested by me", "History"; cards per type with `payloadSummary` rendered by a per-type summariser (publish preview link, ownership diff old→new, refund amount + order, payout, adjustment lines, archive/delete, admin user change, project split), decisions list, pending approvers, age (red > 72 h); Approve (comment optional) / Reject (comment required) with confirmation; Approve absent on own requests; cancel own pending; retry apply for `approved` with `error` (super admin); narrow-layout support.
- Owned paths: `src/app/(admin)/approvals/**`, `src/components/admin/approvals/**`. Forbidden: `src/modules/approvals/**`.
- Dependencies: P8.1; P3.2.
- Expected files/modules: as listed + `summaries/<type>.tsx` (9).
- Tests required: e2e `tests/e2e/admin/approvals.spec.ts` (requester sees no Approve; direct action call rejected — S-07 step 3; other admin approves; reject with comment; retry on error fixture; narrow viewport renders), axe.
- Acceptance criteria:
  - [ ] every one of the nine types has a summary renderer
  - [ ] own requests show no Approve control; server still refuses direct calls (SA-08)
  - [ ] pending age highlighted > 72 h
- Definition of Done: code + e2e + PROGRESS row + CI green; master plan §6 "approvals inbox".
- Potential risks and mitigations: summariser drift from payload shapes → payload Zod schemas from P2 reused.

### P8.6 Orders, order detail, manual & project order, custom quotes, coupons
- Owner profile: UI builder (agent B)
- Requirement IDs: FR-COM-07, FR-COM-09, FR-COM-10, FR-COM-11, FR-PAY-05..08, FR-PAY-12, FR-DEL-03, FR-DEL-08, FR-DEL-09, D-516, D-520, D-1107, A-401, A-502, SCR-ADM-06, SCR-ADM-07, SCR-ADM-08, SCR-ADM-09, SCR-ADM-32, API-COM-06, API-COM-07, API-COM-08, API-COM-09, API-COM-11, API-COM-12, API-PAY-03, API-PAY-04, API-PAY-05, API-PAY-07, API-PAY-08, API-FIN-02, API-DEL-07, API-DEL-09, docs/09 §6.1 (confirmation checklist), docs/08 §6.15, §6.16, S-02 step 4, S-07 step 2, S-08 step 3, S-09 steps 1/4, S-12 (UI)
- Description: `/orders` DataTable with the "Awaiting confirmation" queue tab (age, reference, duplicate-UTR warning). `/orders/[id]`: header (status, customer/client, totals, tax snapshot), items with allocation summary (from `getOrderAllocation` after paid), payments timeline; **Confirm payment** dialog: amount received (default due), received date, reference, checklist boxes from docs/09 §6.1 (statement checked, amount matches, narration matches, not a duplicate), shortfall preview, overpayment preview showing the `customer_credit_minor` that will be recorded (never allocated — FR-PAY-07), `overrideExpiry` with audit note, coupon-exhausted prompt with "confirm without coupon"; **Fail payment** (reason, optional cancel order); refund proposal (amount, reason, revoke toggle, policy exception) → approval; fulfilment section (provisioning complete form, license key entry, service checklist ticks); invoice/credit-note PDF links; linked queries. `/orders/new`: manual product order (customer picker, offering lines) or project order (client fields, free-form lines with product link or split editor `{companyCutBps, lines}` showing approval requirement), tax toggle, optional payment record → confirmed in one step. `/quotes` + `/quotes/[id]`: create/send/cancel, status, pay link copy. `/coupons`: CRUD with restrictions and redemption count.
- Owned paths: `src/app/(admin)/orders/**`, `src/app/(admin)/quotes/**`, `src/app/(admin)/coupons/**`, `src/components/admin/orders/**`, `src/components/admin/quotes/**`, `src/components/admin/coupons/**`. Forbidden: `src/modules/**`.
- Dependencies: P8.1; P4.2–P4.8, P5.5, P5.4.
- Expected files/modules: as listed + `ConfirmPaymentDialog.tsx`, `SplitEditor.tsx`.
- Tests required: unit `tests/unit/components/admin/{confirm-payment-dialog,split-editor}.test.tsx` (shortfall preview; overpayment shows the credit amount; bps sum); e2e `tests/e2e/admin/orders.spec.ts` (S-02 step 4 with shortfall and checklist; step 5 immutability message; S-08 step 3 prompt; S-07 step 2 refund proposal), `manual-order.spec.ts` (S-12 through the UI incl. split approval), `quotes.spec.ts` (S-09 steps 1, 4), `coupons.spec.ts`, axe.
- Acceptance criteria:
  - [ ] S-02 step 4, S-07 step 2, S-08 step 3, S-09, S-12 pass through the UI with audit rows (SA-23)
  - [ ] shortfall and overpayment credit previewed before confirm (SA-24, FR-PAY-07)
  - [ ] project order with manual split shows "awaiting split approval" and blocks payment/invoice
- Definition of Done: code + tests + PROGRESS row + CI green; master plan §6 "payment confirm".
- Potential risks and mitigations: confirm dialog complexity → single Zod schema shared with API-PAY-03 input; UTR duplicate warning from the read model.

### P8.7 Customers list & detail
- Owner profile: UI builder (agent B)
- Requirement IDs: FR-ADM-11, FR-AUTH-12, FR-DEL-12, FR-DASH-08 (admin view after delete), D-1108, SCR-ADM-10, SCR-ADM-11, API-ADM-06, API-ADM-07, API-ADM-08, API-ADM-09, API-DEL-11, API-DEL-12, S-21 step 1 (admin view), S-23 steps 1–3 (UI), TM-16
- Description: `/customers` DataTable (status, tags, country, orders, spent INR, last order; filters). `/customers/[id]`: profile + stats, timeline (orders, payments, entitlements, queries, notes), internal notes/tags editor, suspend/reinstate with reason, send reset / one-time login link (never displayed; confirmation only), manual grant dialog (offering, access months, mandatory reason; shows "no ledger effect"), revoke dialog with reason, deleted/anonymised state view with retained records.
- Owned paths: `src/app/(admin)/customers/**`, `src/components/admin/customers/**`. Forbidden: `src/modules/**`.
- Dependencies: P8.1; P3.4, P5.1, P5.8.
- Expected files/modules: as listed.
- Tests required: e2e `tests/e2e/admin/customers.spec.ts` (S-23 steps 1–3 through the UI incl. no order/invoice/ledger rows and unchanged balances; S-21 step 1 admin still sees orders; magic link never rendered), axe.
- Acceptance criteria:
  - [ ] S-23 passes through the UI; manual grant shows `order_item_id` null semantics ("manual grant" badge)
  - [ ] link-sending actions show only "sent to <masked email>"
- Definition of Done: code + e2e + PROGRESS row + CI green.
- Potential risks and mitigations: timeline joins heavy → paginated per section.

### P8.8 Entitlements & delivery tasks
- Owner profile: UI builder (agent B)
- Requirement IDs: FR-DEL-03, FR-DEL-05, FR-DEL-07, FR-DEL-08, FR-DEL-11, FR-DEL-12, FR-ADM-13, D-607, D-608, SCR-ADM-12, API-DEL-06..10, API-DEL-12, API-DEL-13, API-DEL-14, S-03 steps 1–2, 4, S-04, S-05 steps 2–3, S-06 step 4 (admin view)
- Description: `/entitlements` DataTable (status, delivery type, product, customer, provisioning state, subscription status; filters) with row drawer showing `adminActions` from the handler: complete provisioning (notes form, credentials email toggle), set license key (masked after save, notify toggle), mark service step (note), reset download count (new cap optional, reason), extend access / cancel subscription (reason), revoke (reason; shows whether an external task will be created). `/delivery-tasks`: provision and revoke-external tasks sorted by age, assign, complete with note; operations queue summary (FR-ADM-13) at the top.
- Owned paths: `src/app/(admin)/entitlements/**`, `src/app/(admin)/delivery-tasks/**`, `src/components/admin/delivery/**`. Forbidden: `src/modules/**`.
- Dependencies: P8.7; P5.2, P5.4, P5.5, P5.8.
- Expected files/modules: as listed.
- Tests required: e2e `tests/e2e/admin/entitlements.spec.ts` (S-03 steps 1, 2, 4; S-04; S-05 steps 2–3 with order `fulfilled`; reset cap audited), `delivery-tasks.spec.ts` (revoke-external task completion), axe.
- Acceptance criteria:
  - [ ] S-03, S-04, S-05 admin steps pass through the UI with audit rows
  - [ ] license key field never re-displays the plaintext after save
  - [ ] tasks sorted by age; completion updates entitlement status
- Definition of Done: code + e2e + PROGRESS row + CI green.
- Potential risks and mitigations: action set per type drifting → rendered from `adminActions` (handler-driven), not hardcoded.

### P8.9 Leads table, kanban board, lead detail
- Owner profile: UI builder (agent C)
- Requirement IDs: FR-LEAD-02..06, FR-LEAD-10, D-703, D-705, D-706, SCR-ADM-13, SCR-ADM-14, API-LEAD-02..07, docs/07 §4.8, S-14 step 4 (UI)
- Description: `/leads` DataTable (status, source, product, assignee, priority, next follow-up with overdue highlight; filters incl. `assignedTo: me|unassigned`, `overdue`); `/leads/board` kanban (columns New → Contacted → Qualified → Proposal → Won | Lost; drag between columns with `domMax` Motion; Lost requires reason dialog; keyboard alternative via menu), claim from pool; `/leads/[id]`: details, linked product/user/won order, activities timeline, add note/email/call, set follow-up + priority, assign, status change, manual lead creation dialog. `admin` role: assigned + pool only.
- Owned paths: `src/app/(admin)/leads/**`, `src/components/admin/leads/**`. Forbidden: `src/modules/**`.
- Dependencies: P8.1; P6.3, P6.4.
- Expected files/modules: as listed + `KanbanBoard.tsx`.
- Tests required: unit `tests/unit/components/admin/kanban.test.tsx` (keyboard move; lost reason required); e2e `tests/e2e/admin/leads.spec.ts` (S-14 step 4: claim → Contacted → follow-up yesterday → overdue highlight; digest job then lists it), axe.
- Acceptance criteria:
  - [ ] S-14 step 4 passes through the UI
  - [ ] kanban usable by keyboard; illegal transitions blocked
  - [ ] `partner@` sees only assigned + pool
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: drag-and-drop a11y → menu-based move as the primary accessible path.

### P8.10 Queries inbox + thread, chatbot monitor
- Owner profile: UI builder (agent C)
- Requirement IDs: FR-LEAD-07, FR-LEAD-08, FR-LEAD-09, FR-CHAT-04, FR-CHAT-08, D-702, SCR-ADM-15, SCR-ADM-16, API-CHAT-03, API-CHAT-04, API-CHAT-05, API-CHAT-11, API-CHAT-12, API-CHAT-13, S-07 step 5, S-15 step 6 (admin reply), docs/04 §9 (prompt management)
- Description: `/queries` DataTable (status, source, assignee, customer, linked order/product; filters) + `/queries/[id]` thread (messages with attachments via private signed links, customer card, linked order with "propose refund" shortcut to P8.6, originating chatbot transcript panel, reply editor with `setStatus`, assign/close/reopen, manual/email-sourced query creation). `/chatbot?tab=conversations|usage|prompts`: transcripts (tokens, retrieved chunks, escalation link), usage vs caps (daily user/platform counters, cap-hit events), prompt versions (view, create from current, activate, roll back; diff view), reindex knowledge button with chunk count.
- Owned paths: `src/app/(admin)/queries/**`, `src/app/(admin)/chatbot/**`, `src/components/admin/queries/**`, `src/components/admin/chatbot/**`. Forbidden: `src/modules/**`.
- Dependencies: P8.1; P6.5, P6.6, P3.13.
- Expected files/modules: as listed.
- Tests required: e2e `tests/e2e/admin/queries.spec.ts` (S-15 step 6 admin reply → customer notified; S-07 step 5 close with note), `chatbot-monitor.spec.ts` (activate a new prompt version → next conversation records it; usage tab shows cap hits), axe.
- Acceptance criteria:
  - [ ] admin reply flips status and triggers customer notification/email (outbox assertion)
  - [ ] exactly one active prompt version at any time; activation audited
- Definition of Done: code + e2e + PROGRESS row + CI green.
- Potential risks and mitigations: transcript PII visible to admins → permission `chat.transcripts.read` enforced; no export.

### P8.11 Finance screens
- Owner profile: UI builder (agent B)
- Requirement IDs: FR-FIN-06..12, FR-FIN-14, FR-ADM-12 (partner records), BR-17, D-511–D-514, D-517, SCR-ADM-17..22, API-FIN-01..11, API-ADM-12, docs/08 §6.7, §6.17, S-13 (UI), S-10 steps 2/4 (allocation view), docs/09 §7 (CSV)
- Description: `/finance/ledger` journal browser (filters per API-FIN-01, `seq` order, totals by type, entry links to order/payout/expense/approval; no edit/delete controls anywhere; scope for `admin` role), `/finance/allocations` per-item snapshots with ownership version used, `/finance/partners` running balances per currency + INR (own only for `admin` role) with partner record editing (bank details masked), `/finance/payouts` record form (balance shown; over-balance refused unless overdraw with warning) → approval; list, `/finance/expenses` form (product, shared-by-split toggle with warning when no active ownership, receipt upload) + list, `/finance/adjustments` line editor (party/partner/amount signed/memo; sum explanation) → approval; list with request links, `/finance/reports` (seven reports, range/granularity/currency; Recharts + tables with text summaries; CSV download), `/finance/statements` (partner, period, PDF/CSV export via presigned URL).
- Owned paths: `src/app/(admin)/finance/**`, `src/components/admin/finance/**`. Forbidden: `src/modules/**`.
- Dependencies: P8.6; P4.1, P4.9, P4.10, P4.11, P3.4 partners.
- Expected files/modules: six route folders + components (`LedgerTable`, `AllocationCard`, `BalanceTable`, `PayoutForm`, `ExpenseForm`, `AdjustmentEditor`, `ReportView`, `StatementExport`).
- Tests required: e2e `tests/e2e/admin/finance.spec.ts` (S-13 through the UI incl. over-balance refusal; ledger shows S-02/S-07 entries; allocation view shows v1 vs v2 for S-10; reports totals equal ledger totals displayed; statement export returns a file), scoping test for `partner@`, axe.
- Acceptance criteria:
  - [ ] S-13 passes through the UI; balance decreases after apply
  - [ ] no edit/delete affordance on ledger/allocations/payouts (DOM assertion)
  - [ ] `partner@` sees own balance/statement only
- Definition of Done: code + e2e + PROGRESS row + CI green; master plan §6 "finance screens".
- Potential risks and mitigations: report charts colour contrast → docs/08 §6.17 palette + axe.

### P8.12 Content editors with Tiptap editor
- Owner profile: UI builder (agent C)
- Requirement IDs: FR-CONT-01..04, FR-CONT-06, FR-CAT-14 (blog is in P8.4), D-801, D-803, D-806, D-807, D-1106, SCR-ADM-23..28, API-CONT-01..08, docs/11 §A7, docs/10 §14 item 20
- Description: `/content/landing` (five chapter forms with rich text, media picker, CTA, position, published; featured products picker ≤ 8 published; live preview link), `/content/services` (list, reorder, editor with deliverables), `/content/case-studies` (CRUD, publish/unpublish, gallery uploader, SEO fields, slug-change warning), `/content/testimonials` + `/content/logos` (CRUD, reorder, context), `/content/faqs` (scope site/chatbot/product, reorder), `/content/legal` (four keys; editor; publish increments version; version history read-only; refund page shows the R-502 wording reminder). All use `RichTextEditor` from P8.4 and `MediaUploader`.
- Owned paths: `src/app/(admin)/content/**`, `src/components/admin/content/**`. Forbidden: `src/components/admin/shared/**` (request changes from A).
- Dependencies: P8.9 (lane order only), P8.4 (`RichTextEditor`, `MediaUploader`); P3.11, P3.10.
- Expected files/modules: six route folders + components.
- Tests required: e2e `tests/e2e/admin/content.spec.ts` (edit a landing chapter and a legal page → public page updates after revalidation within the test's polling window — founder checklist item 20; legal version increments; featured limit 8; case study publish → sitemap includes it), axe.
- Acceptance criteria:
  - [ ] landing/legal edits visible on the public site within 60 s (FR-CONT-03)
  - [ ] legal publish shows the new version and keeps history
  - [ ] every editor uses the shared rich-text component (no second Tiptap config)
- Definition of Done: code + e2e + PROGRESS row + CI green.
- Potential risks and mitigations: lane C waiting on A's `RichTextEditor` → A delivers it first inside P8.4 (first commit), tracked in PROGRESS.

### P8.13 Settings (9 tabs), audit log, admin users & roles
- Owner profile: UI builder (agent C)
- Requirement IDs: FR-ADM-08, FR-ADM-09, FR-ADM-10, FR-ADM-12, FR-OPS-03, FR-FIN-13 (FX override), NFR-SEC-08, D-1104, D-1105, SCR-ADM-29, SCR-ADM-30, SCR-ADM-31, API-ADM-05, API-ADM-10, API-ADM-11, API-FIN-12, API-OPS-02, docs/13 §6, S-20 (UI), MASTER_SPEC §7 "Approver set" (warning when < 2 admins), "Base currency lock"
- Description: `/settings/general` (seller details, contact phones/email for invoices), `currencies` (base currency locked with explanation once a paid order exists — FR-ADM-10 / API-ADM-10; enabled display currencies; FX rates table with override + refresh button + stale warning), `tax` (tax rate bps, GSTIN with format validation and "tax inert until GSTIN" note), `payment-methods` (UPI VPA required for `manual_upi`, bank details masked, gateway methods disabled until flags), `theme` (default theme; Theme 2 option only when flag), `ai` (model id, caps, timeout), `notifications` (admin channel note: in-app only), `flags` (ten flags with env-override indicator, `three_hero` kill switch), `retention` (chat months, records years; system health: job runs, outbox, storage). `/audit` (filters actor/action prefix/subject/date/q; before/after diff viewer; CSV export with audit of the export; no edit/delete). `/admin-users` (list with roles/partner/TOTP status; invite/change role/remove → approval; removal of the last `super_admin` refused; a change leaving fewer than two active admins is allowed and shows `warning: 'fewer_than_two_admins'` plus the persistent banner — FR-ADM-12, MASTER_SPEC §7 "Admin removal"; partner record fields).
- Owned paths: `src/app/(admin)/settings/**`, `src/app/(admin)/audit/**`, `src/app/(admin)/admin-users/**`, `src/components/admin/settings/**`, `src/components/admin/audit/**`, `src/components/admin/admin-users/**`. Forbidden: `src/modules/**`.
- Dependencies: P8.12 (lane order); P3.3, P3.4, P3.1, P3.12, P6.8.
- Expected files/modules: nine settings tabs + audit + admin users.
- Tests required: e2e `tests/e2e/admin/settings.spec.ts` (base currency editable with only a pending order, locked after the first paid order; GSTIN validation; flag toggle hides 3D hero on the site; AI cap change affects chat — founder checklist item 16), `audit.spec.ts` (S-20: rows for S-02/S-07/S-10/S-11/S-13 actions with before/after; login events; CSV export), `admin-users.spec.ts` (invite → approval; removing the last super admin refused; removal leaving < 2 admins succeeds with the warning banner), axe.
- Acceptance criteria:
  - [ ] S-20 passes; export audited
  - [ ] base currency field read-only with reason once a paid order exists
  - [ ] < 2 active admins → warning banner (action still applies); last super admin → refusal message
- Definition of Done: code + e2e + PROGRESS row + CI green.
- Potential risks and mitigations: flag changes needing revalidation → settings action revalidates `settings` + `content`; e2e polls.

### P8.14 Admin e2e + axe suites, phase gate
- Owner profile: reviewer + domain-standard
- Requirement IDs: master plan §6 (P8 gate), docs/10 §6 (admin steps of S-02, S-03, S-04, S-05, S-07, S-09, S-10, S-11, S-12, S-13, S-14, S-15, S-18, S-19, S-20, S-23), §8 (axe admin routes), §13 (P6 row), SA-06, SA-07, SA-17 (deferred to P9), SA-23, NFR-PERF-04
- Description: Assemble `tests/e2e/admin/index` running every admin journey above on the admin host with both admins (`ceo@`/`cfo@`) and `partner@` for scoping; per-step `expectAuditRow` (SA-23); axe on admin login, dashboard, catalog editor (all tabs), order detail, ledger and every other admin route in both themes; narrow-viewport checks for approvals/payment confirm/notifications; LHCI desktop informational run on `/dashboard` (TTI ≤ 4 s). Write `implementation/reviews/P8-review.md` with ownership compliance (`src/app/(admin)/**`, `src/components/admin/**`, `src/modules/dashboard-widgets/**` per master plan §3); no doc corrections expected.
- Owned paths: `tests/e2e/admin/**` (index + shared fixtures), `tests/e2e/a11y/admin-routes.spec.ts`, `implementation/reviews/P8-review.md`. Forbidden: `src/**`.
- Dependencies: P8.1–P8.13.
- Expected files/modules: as listed.
- Tests required: the suites above; `@security` tags for SA-06/SA-23.
- Acceptance criteria:
  - [ ] all admin journeys of docs/10 §6 pass on the admin host
  - [ ] zero serious/critical axe violations on all admin routes in both themes
  - [ ] every admin mutation in e2e has an audit row (SA-23)
- Definition of Done: suites + review + PROGRESS statuses + CI green.
- Potential risks and mitigations: e2e runtime > 12 min → shard Playwright by lane; nightly full matrix.

## Parallelisation map

```
Agent A: P8.1 ─► P8.2 ─► P8.3 ─► P8.4 ─► P8.5
Agent B: (after P8.1) P8.6 ─► P8.7 ─► P8.8 ─► P8.11
Agent C: (after P8.1) P8.9 ─► P8.10 ─► P8.12 (needs P8.4's RichTextEditor) ─► P8.13
All ─────────────────────────────────────────────────────────────────► P8.14
```

- P8.1 (shell + primitives) merges first; B and C start immediately after on disjoint route folders and component folders.
- Within a lane tasks are sequential (shared components per lane). Across lanes the only shared files are `components/admin/shared/{RichTextEditor,MediaUploader}` (A, delivered early in P8.4) and `components/admin/primitives/**` (A, P8.1; changes requested through A).
- `src/modules/dashboard-widgets/**` is written only by P8.2.
- P8.11 (finance) waits for P8.6 because the order detail's allocation card and refund proposal are reused; P8.13 waits for P8.12 only for lane ordering.
- Cross-phase: P8 needs P3–P6 complete; if P6 lags, lane C starts with P8.9 stubs disabled and A/B proceed.

## Phase Definition of Done

- All 14 tasks `done`; `implementation/reviews/P8-review.md` committed.
- Every `SCR-ADM-01..33` screen implemented with all documented states, ≥ 1024 px layout plus narrow read-mostly layout for the three allowed screens, both themes, `/dev/ui` components only.
- CI green: unit component tests, admin e2e journeys (widget persistence, approvals inbox, payment confirm with shortfall, finance screens, S-20 audit, S-23 manual grant, TOTP), axe on all admin routes both themes.
- 20 widgets registered, loaders typed/tested, layouts persisted per admin.
- No doc corrections expected; permission strings in code ⊆ docs/06 §1.2 (static test).

## Phase risks

| Risk | Mitigation |
|------|------------|
| Widget grid library incompatibility | pinned version; fixed-layout fallback (founder decision, master plan §7) |
| Editor complexity blows the schedule | tabs lazy-loaded; ownership/publish/offerings tabs first (critical path), testimonials/FAQs last |
| Permission strings invented in UI code | docs/06 §1.2 (= `ui/sitemap.md` §4) is canonical; static permission-list test from P1.6 |
| Admin e2e runtime | sharded by lane; full matrix nightly |
| Founders on phones need approvals/confirmations | narrow layout limited to three screens, tested at 390 px |

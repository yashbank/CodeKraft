# PHASE-06 — Leads, queries, notifications, chat, analytics

**Wave:** W3 (parallel with P3, P4, P5; 2 agents: A = notifications/emails/leads/queries, B = chat/analytics) · **Roadmap items:** R1-18, R1-19, R1-20, R1-22 · **Master plan §6 gate:** integration: lead creation with Turnstile stub; assignment; follow-ups; query thread; notification fan-out; chat menu, AI (mocked provider), caps, escalation; analytics ingest.

## Phase objective

Build the conversational and operational plumbing: the notification module every other module emits into (in-app rows, email channel through `email_outbox`, WhatsApp channel stub behind flag, customer preferences, the poll endpoint both hosts use), all react-email templates, the sales pipeline (leads from every source with Turnstile verification, shared pool, activities, follow-ups, overdue digest), support threads (queries from dashboard/order/form/chat/email/manual with the "Request refund" rule), the hybrid chatbot (menus without LLM, full-text retrieval, `AnthropicProvider` behind `LLMProvider` with streaming via `@anthropic-ai/sdk`, daily caps, prompt versions, escalation, lead capture, SSE route) and analytics (event ingest, web-vitals, Umami script, widget data). Server-side only; P7/P8 render.

## Prerequisites

- P2 done: schemas, `notifications.emit` contract, `LLMProvider` interface, `NotificationType` union (28 types), factories, stubs.
- P3.1 audit, P3.3 settings (`ai_model`, caps, `chatTimeoutMs`, `turnstileSiteKey`), P3.13 `search.retrieve` (stub until merged), P3.10 `toPlainText`.
- P1.8 email transport + base layout; P1 `lib/rate-limit` port.
- Env: `RESEND_API_KEY` (unused in tests; `EMAIL_TRANSPORT=outbox`), `RESEND_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY` (tests use `LLM_PROVIDER=fake`), `TURNSTILE_SECRET` (Cloudflare test keys locally), `NEXT_PUBLIC_UMAMI_*`.
- Rate limits (one canonical set: NFR-SEC-03 = docs/06 §1.7 = docs/09 §7; proposed values the founder may tune, `ISSUES.md` I-005): chat 30 messages / 10 min per user plus daily caps; public forms 5/h per IP (+ Turnstile); notification poll 30/min per session; analytics ingest 120/min per anon/user.

## Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P6.1 | Notifications core: emit, channels (in-app, email via outbox, WhatsApp stub), prefs, list/mark, poll endpoint, `email.outbox_retry` job (`src/jobs/email-outbox.ts`), Resend webhook | domain-standard (A) | — |
| P6.2 | Email templates (react-email, all docs/12 §7 templates) | UI builder (A) | P6.1 |
| P6.3 | Leads: all sources, Turnstile verification lib, pool/claim/assign, status machine, activities, follow-ups | domain-standard (A) | P6.1 |
| P6.4 | `admin.overdue_digest` job (`src/jobs/lead-digest.ts`): overdue leads + open revoke-external tasks | domain-standard (A) | P6.3, P6.2 |
| P6.5 | Queries + messages: all sources incl. refund request from order, guest, attachments, `autoClose` service | domain-standard (A) | P6.1 |
| P6.6 | Chat core: menus, retrieval glue, prompt builder, `LLMProvider` + `AnthropicProvider` + `FakeProvider`, caps, prompt versions, conversations, `retention.purge` job (`src/jobs/chat-purge.ts`) | domain-standard (B) | P6.1 |
| P6.7 | `POST /api/chat` SSE route, `capture_lead` intent + API-CHAT-15 confirmation, escalation to query | domain-standard (B) | P6.6, P6.5 |
| P6.8 | Analytics: `trackEvent`, vitals endpoint, Umami script, server events, widget/system queries | domain-standard (B) | — |
| P6.9 | Phase gate: integration scenarios S-14, S-15 (server), SA-15/16/20 + reviewer | reviewer | all |

### P6.1 Notifications core
- Owner profile: domain-standard (agent A)
- Requirement IDs: FR-NOTIF-01, FR-NOTIF-02, FR-NOTIF-03, FR-NOTIF-05, FR-NOTIF-06, FR-DASH-09, NFR-RT-01, NFR-OPS-02, D-015, D-707, D-1002, D-1604, X-012, API-NOTIF-01, API-NOTIF-02, API-NOTIF-03, API-NOTIF-04, docs/06 §3.4 (Resend webhook), §3.8, §3.3 `email.outbox_retry`, docs/12 §2.3, docs/04 §7.5, docs/12 §7, master plan §5 `notifications.emit`
- Description: `emit(target: userId | 'admins', type, payload, channels?, tx)`: resolves recipients (`'admins'` = active admin-class users), writes `notifications` rows (title/body/link built by `templates/<type>.ts` for each of the 28 types), decides channels: admin recipients in-app only (D-707) except digest types; customer recipients in-app + email unless `customer_profiles.notification_prefs` disables the optional category (`orderUpdates` locked on); `email` channel writes `email_outbox(template, payload, priority)` inside `tx` and, after commit, attempts immediate send via `lib/email/transport` marking `sent`; `whatsapp` channel is a stub that throws unless flag `whatsapp_channel` (interface only). `channel_state` updated per channel. Queries: `listNotifications(unreadOnly, cursor)`, `pollNotifications(since)` → `{ items, unreadCount, serverTime }` served by `GET /api/notifications` (rate class `poll`, both hosts), `markRead`/`markAllRead` (own rows), `get/updateNotificationPreferences`. Job `src/jobs/email-outbox.ts` exporting `{ key: 'email.outbox_retry', run(now) }` (`frequent`, docs/06 §3.3): retry `queued|failed` rows with exponential backoff, max 5 attempts, daily-cap deferral at 90/100 (priority order: verification/reset first), failures surfaced via `N: system.job_failed`. `POST /api/webhooks/resend`: Svix signature, `webhook_events` idempotency, `delivered|bounced|complained` → `email_outbox.status`, bounce note on `customer_profiles.internal_notes`, admin `N`. Type → audience → channels → template matrix (the `templates-all-types` unit test is generated from this table; template names are the docs/12 §7 canonical names):

  | `notifications.type` | Audience | In-app | Email template (customer only) | Emitting task |
  |----------------------|----------|--------|--------------------------------|---------------|
  | `order.created` | customer | yes | `order-created-instructions` | P4.2 |
  | `order.paid` | customer | yes | `payment-confirmed-invoice` | P4.4 |
  | `order.expired` | customer | yes | `order-expired` | P4.2 (`orders.expire`) |
  | `payment.submitted` | admins | yes | — (also `payment-submitted-ack` to customer) | P4.4 |
  | `payment.failed` | customer | yes | `payment-failed` | P4.4 |
  | `invoice.issued` | customer | yes | (attachment on `payment-confirmed-invoice`) | P4.5 |
  | `delivery.task` | admins | yes | — | P5.2 / P5.5 |
  | `service.progress` | customer | yes | `service-step-update` / `order-fulfilled` | P5.5 |
  | `license.ready` | customer | yes | `delivery-license-key` (dashboard link only, no key) | P5.4 |
  | `subscription.reminder` | customer | yes | `subscription-reminder` | P5.7 |
  | `subscription.grace` | customer | yes | `subscription-grace` | P5.7 |
  | `subscription.suspended` | customer | yes | `subscription-suspended` | P5.7 |
  | `subscription.cancelled` | admins (+ customer email) | yes | `subscription-cancelled` | P5.6 |
  | `refund.issued` | customer | yes | `refund-credit-note` | P4.8 |
  | `approval.requested` | admins except requester | yes | — | P3.2 |
  | `approval.approved` / `approval.rejected` | requester | yes | — | P3.2 |
  | `lead.new` | admins | yes | — | P6.3 |
  | `lead.assigned` | assignee | yes | — | P6.3 |
  | `lead.overdue_digest` | each admin | yes | `admin-overdue-digest` (the only recurring admin email) | P6.4 |
  | `query.new` | admins | yes | — | P6.5 / P6.7 |
  | `query.replied` | customer | yes | `query-reply` | P6.5 |
  | `query.customer_replied` | assignee/admins | yes | — | P6.5 |
  | `product.published` | requester | yes | — | P3.9 |
  | `product.updated` | entitled customers | yes | `product-update` | P3.7 |
  | `quote.sent` | customer | yes | `custom-quote` | P4.6 |
  | `chat.cap_reached` | admins (once/day) | yes | — | P6.6 |
  | `system.job_failed` | super admins | yes | — | P9.4 / any job |
  | `system.fx_stale` | admins | yes | — | P3.12 |

- Owned paths: `src/modules/notifications/**` (except frozen), `src/app/api/notifications/**`, `src/app/api/webhooks/resend/**`, `src/jobs/email-outbox.ts`. Forbidden: `src/emails/**` (P6.2), `src/lib/email/**` (P1).
- Dependencies: P2 contracts; P1.8 transport.
- Expected files/modules: `src/modules/notifications/{service,actions,queries,channels/{inapp,email,whatsapp}.ts,templates/index.ts,prefs.ts}`, routes, job.
- Tests required: unit `tests/unit/notifications/{fan-out,channel-rules,templates-all-types,digest-builder}.test.ts` (in-app always; email only for customer events; all 28 types have a template); integration `tests/integration/notifications/{emit-in-tx-rollback,poll-since,mark-read-own-only,prefs-locked-category,outbox-retry-backoff,outbox-daily-cap,resend-webhook-idempotent}.test.ts`, `tests/integration/api/notifications-route.test.ts` (both hosts).
- Acceptance criteria:
  - [ ] admin notification never queues email except `lead.overdue_digest`
  - [ ] customer event writes in-app + outbox row in the same transaction; rollback removes both
  - [ ] poll returns rows created after `since` and `unreadCount`; rate class `poll` enforced (429 on 31st/min)
  - [ ] outbox retries 5× with backoff and defers low-priority mail at 90/day
- Definition of Done: code + tests + PROGRESS row + CI green; master plan §6 "notification fan-out".
- Potential risks and mitigations: immediate send after commit inside a serverless request → `after()`/`waitUntil` with outbox row as source of truth; Resend daily cap → priority column (docs/12 §11.8).

### P6.2 Email templates
- Owner profile: UI builder (agent A)
- Requirement IDs: FR-NOTIF-01, FR-DEL-09 (instructions in confirmation email), FR-PAY-10 (invoice attachment), FR-DEL-07 (dashboard link only, no key), D-1002, docs/12 §7 (template list), docs/10 §7 (`emails/*` snapshots), MASTER_SPEC §7 "Print/PDF/email theming", "License key delivery"
- Description: `src/emails/*.tsx` on the P1.8 base layout, one per docs/12 §7 name: `verify-email`, `reset-password`, `one-time-login`, `order-created-instructions` (UPI QR image + bank details + reference-form link, A-601), `payment-submitted-ack`, `payment-confirmed-invoice` (PDF attachment), `payment-failed`, `order-expired`, `delivery-saas-credentials`, `delivery-license-key` (dashboard link only — the key is never in the email, docs/12 §7, FR-DEL-07), `delivery-download-ready`, `service-step-update`, `order-fulfilled`, `subscription-reminder` (T−7/T−1 variants), `subscription-grace`, `subscription-suspended`, `subscription-cancelled`, `query-reply`, `query-closed`, `refund-credit-note` (attachment), `custom-quote`, `access-granted`, `access-revoked`, `account-deleted`, `account-suspended`, `admin-overdue-digest`, `admin-invite`, `email-change-verify`, `product-update`. Plain table-based HTML, ink-on-white, brand mark, no theme branching; `src/emails/index.ts` registry keyed by template name with Zod payload schemas; text alternative for each.
- Owned paths: `src/emails/**`. Forbidden: `src/modules/notifications/**` (registry consumed via import).
- Dependencies: P6.1 (payload contracts).
- Expected files/modules: ~30 template files + `index.ts` + `fixtures/*.ts`.
- Tests required: `tests/unit/emails/*.snapshot.test.tsx` render snapshots with fixture payloads (docs/10 §7): license template contains no key at all, masked or full (S-03 step 2); instructions template contains the UPI URI text and order number; each template registered with a payload schema; `tests/unit/emails/registry.test.ts` (every `E:` name referenced in docs/06 §2 exists).
- Acceptance criteria:
  - [ ] every `E:` template name in docs/06 §2 and docs/12 §7 exists and renders
  - [ ] no template branches on theme; no license key (masked or full) in any template
  - [ ] snapshots stable across two runs
- Definition of Done: templates + snapshots + PROGRESS row + CI green.
- Potential risks and mitigations: docs/06 and docs/12 template names differ (`payment-confirmed` vs `payment-confirmed-invoice`) → registry maps docs/06 aliases to docs/12 canonical names; correction logged.

### P6.3 Leads
- Owner profile: domain-standard (agent A)
- Requirement IDs: FR-LEAD-01, FR-LEAD-02, FR-LEAD-03, FR-LEAD-04, FR-LEAD-05 (store part), FR-LEAD-06, FR-LEAD-10, FR-LEAD-11, FR-SEC-02, D-315, D-703, D-704, D-705, D-706, D-1204, API-LEAD-01..07, TM-07, SA-16, S-14 steps 1–2, 4 (server), docs/03 §3.6, docs/09 §7 (Turnstile placement)
- Description: `src/lib/turnstile.ts` `verify(token, ip, action)` calling Cloudflare siteverify (fail-closed → `CAPTCHA_FAILED`; test keys in local/CI; `TurnstileStub` in tests), bound to the form action name; honeypot field check. `createLead` (public: sources `inquiry_form|product_cta`, Turnstile required, rate class `public_form`, `turnstile_verified = true`, `user_id` when logged in, duplicate-by-email flag on the row, `lead_activities('created from …')`, `N: lead.new` to admins, `A: inquiry_submitted`, one acknowledgement email per email per day), `createLeadManual` (`source = manual`, optional `assignedTo`), `createLeadFromChat` (internal, `source = chatbot`, for P6.7). `listLeads`/`getLead` (filters per API-LEAD-03 incl. `overdue`, `assignedTo: me|unassigned|userId`; `admin` scope assigned + pool), `assignLead`/`claimLead` (`CONFLICT` when already claimed by someone else; `N: lead.assigned`), `updateLeadStatus` (transitions per docs/03 §3.6, `lost_reason` required, `lost → new` reopen audited, `won` links `won_order_id`), `addLeadNote`/`logLeadActivity`, `setFollowUp` (priority, `next_follow_up_at`). `overdueLeadsByAdmin(now)` query for P6.4. On admin removal (P3.4 hook) leads return to pool. Leads never deleted on account deletion (retention handled by P5.7 anonymise leaving `leads` untouched).
- Owned paths: `src/modules/leads/**` (except frozen), `src/lib/turnstile.ts`. Forbidden: `queries/**`.
- Dependencies: P6.1.
- Expected files/modules: `src/modules/leads/{service,actions,queries,state,activities}.ts`, `src/lib/turnstile.ts`.
- Tests required: unit `tests/unit/leads/{state,overdue,turnstile}.test.ts` (lost requires reason; overdue = `next_follow_up_at < now` and not won/lost); integration `tests/integration/leads/{create-public-turnstile,create-invalid-token,rate-limit-6th,claim-conflict,assign,status-flow,follow-up,admin-scope,manual,duplicate-flag}.test.ts` (`@security` SA-16, SA-15 sample).
- Acceptance criteria:
  - [ ] invalid Turnstile token → `CAPTCHA_FAILED`, no lead row (SA-16)
  - [ ] 6th submission from one IP within an hour → `RATE_LIMITED`
  - [ ] `admin` role lists only assigned + unassigned leads
  - [ ] every status change writes an activity row and audit
- Definition of Done: code + tests + PROGRESS row + CI green; master plan §6 "lead creation with Turnstile stub; assignment; follow-ups".
- Potential risks and mitigations: Turnstile outage → fail-closed with visible error (docs/04 §10), monitored via Sentry.

### P6.4 Follow-up overdue digest + revoke-task digest job
- Owner profile: domain-standard (agent A)
- Requirement IDs: FR-LEAD-05, FR-NOTIF-04, FR-DEL-11 (daily admin email until done), NFR-OPS-02, R-701, D-706, D-607, docs/06 §3.3 `admin.overdue_digest`, docs/12 §2.3, S-14 step 4 (digest), master plan §3 (`src/jobs/lead-digest.ts`)
- Description: `src/jobs/lead-digest.ts` exporting `{ key: 'admin.overdue_digest', run(now) }` (`daily`): per admin, overdue leads (own for `admin` role, all for super admins) + open `revoke_external` tasks (P5.8 `listOpenRevokeExternalTasks`) → one `E: admin-overdue-digest` per admin per day (the only admin email besides invites) + `N: lead.overdue_digest`; nothing sent when both lists are empty; idempotent per day via `job_runs`.
- Owned paths: `src/jobs/lead-digest.ts`, `src/modules/notifications/digest.ts`. Forbidden: `leads/**` (query via service).
- Dependencies: P6.3, P6.2.
- Expected files/modules: as listed.
- Tests required: integration `tests/integration/jobs/lead-digest.test.ts` (overdue lead → one email in outbox; rerun same day → none; empty → none; revoke task included).
- Acceptance criteria:
  - [ ] exactly one digest email per admin per day
  - [ ] digest lists overdue leads and open external revoke tasks
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: Resend daily cap → digest priority low, deferred by outbox rules.

### P6.5 Queries + messages
- Owner profile: domain-standard (agent A)
- Requirement IDs: FR-LEAD-03 (pool for queries), FR-LEAD-07, FR-LEAD-08, FR-LEAD-09, FR-DEL-05 (reset request query), FR-PAY-12 (request channel), D-702, D-1002, API-CHAT-01, API-CHAT-02, API-CHAT-03, API-CHAT-04, API-CHAT-05, docs/03 §3.8, docs/06 §5.2 step 1, TM-18, S-07 step 1 (server), S-15 step 6 (query half), MASTER_SPEC §7 "Refund request channel"
- Description: `createQuery` (customer sources `dashboard|order`, visitor `form` with Turnstile + `guestEmail` + rate class `public_form`; `order` source limited to one open query per order with `kind = refund_request` returning the existing thread; attachments ≤ 3 via intent purpose `query_attachment`; `N: query.new` to admins; `A: inquiry_submitted` for visitors), `createFromChat` (internal for P6.7: `source = chatbot`, `conversation_id`, system message with transcript excerpt), `createFromEmailOrManual` (admin, sources `email|manual`). `listMyQueries`/`getMyQuery` (attachment signed URLs 5 min; foreign → `NOT_FOUND`), `replyToQuery` (customer reopens `waiting_customer → open`, `resolved → open` within 7 d; admin reply → `waiting_customer` + `N: query.replied` + `E: query-reply`; `setStatus` admin only; `closed` → `STATE_INVALID`), `listQueriesAdmin`/`getQueryAdmin` (thread + customer card + linked order + originating conversation transcript), `assignQuery`/`closeQuery`/`reopenQuery` (`E: query-closed`). `queries.autoClose(now)` service: `resolved` for 7 d without customer reply → `closed` (FR-LEAD-09, proposed). docs/06 §3.3 / docs/12 §2.3 list no job key for it yet; P9.4 runs it from `daily` as `queries.autoclose` and P9.12 files the doc correction.
- Owned paths: `src/modules/queries/**` (except frozen). Forbidden: `chat/**`, `leads/**`, `src/jobs/**`.
- Dependencies: P6.1.
- Expected files/modules: `src/modules/queries/{service,actions,queries,state,attachments,autoclose}.ts`.
- Tests required: unit `tests/unit/queries/state.test.ts`; integration `tests/integration/queries/{create-dashboard,create-order-refund-request-once,create-guest-turnstile,reply-flips-status,customer-reopen-window,admin-close,attachments-signed,foreign-404,autoclose-job}.test.ts` (`@security` SA-10).
- Acceptance criteria:
  - [ ] second "Request refund" on the same order returns the existing thread (S-07 step 1)
  - [ ] admin reply notifies customer in-app + email and sets `waiting_customer`
  - [ ] resolved thread auto-closes after 7 days; customer can reopen before
- Definition of Done: code + tests + PROGRESS row + CI green; master plan §6 "query thread".
- Potential risks and mitigations: `queries.kind` column absent in docs/05 → use `source='order'` + `product_id`/`order_id` uniqueness on open threads; if a `kind` column is needed, additive migration `0004_p6-5_query_kind.sql` and doc correction.

### P6.6 Chat core
- Owner profile: domain-standard (agent B)
- Requirement IDs: FR-CHAT-01, FR-CHAT-02, FR-CHAT-03 (retrieval + prompt), FR-CHAT-04, FR-CHAT-07, FR-CHAT-08, FR-CHAT-10 (`chat_started`), NFR-AI-01, NFR-PERF-06, D-205, D-701, D-708, D-1503, ADR-08, API-CHAT-06, API-CHAT-07, API-CHAT-10, API-CHAT-11, API-CHAT-12, docs/04 §9, docs/09 §11, TM-08, TM-20, SA-20, S-15 steps 1–2, 4–5 (server), MASTER_SPEC §7 "Chatbot contact menu"
- Description: `startConversation(entry, context)`: verified customer (`EMAIL_UNVERIFIED` otherwise), rate class `chat`, `conversations(model = site_settings.ai_model, prompt_version_id = active, purge_after = today + 12 mo)`, menu root, usage `{ userRemaining, platformRemaining }`, `A: chat_started`. `menus.ts`: intents `order_status|downloads|contact|renewal|invoices|talk_to_human|back` resolved only from the caller's own rows via orders/entitlements/subscriptions/invoices query contracts, `chat_messages(role='menu')`, `contact` → escalation prompt (no public contact details). `caps.ts`: `chat_usage_daily` for `user` and `platform` checked before every LLM call, incremented before the call and decremented on failure before first token; when exceeded → menu-only + `N: chat.cap_reached` once per day. `prompt.ts`: system prompt = active `prompt_versions.system_prompt` + retrieved chunks wrapped in delimiters labelled untrusted, forbids answering outside context, plus the `capture_lead` tool definition; user message only (no email/phone/order data — SA-20). `providers/types.ts` (frozen), `providers/anthropic.ts` using `@anthropic-ai/sdk` `messages.stream()` with `max_tokens 600`, `timeoutMs` from settings (default 20 s), tool `capture_lead`, mapping `stop_reason: refusal` → `fallback('refusal')`, errors → `fallback('unavailable')`; `providers/fake.ts` per docs/10 §3 (canned answers, "trigger refusal", "trigger timeout" 25 s, records the exact request payload for SA-20); `providers/index.ts` selects by `LLM_PROVIDER`. Output sanitizer (markdown → text, no HTML execution). `endConversation`, `listMyConversations`, admin `listConversationsAdmin`/`getTranscript` (tokens, retrieved chunks, usage vs caps), `listPromptVersions`/`createPromptVersion`/`activatePromptVersion` (single active; audited). Retention: `purge_after` set on `startConversation`; job `src/jobs/chat-purge.ts` exporting `{ key: 'retention.purge', run(now) }` (`daily`, docs/06 §3.3) deletes `chat_messages`/`conversations` with `purge_after < today` (FR-CHAT-09, D-1503); `job_runs` row, idempotent.
- Owned paths: `src/modules/chat/**` (except frozen), `src/jobs/chat-purge.ts`. Forbidden: `src/app/api/chat/**` (P6.7), `search/**` (call `retrieve`).
- Dependencies: P6.1; P3.13 `retrieve` (stub until merged); P3.3 settings.
- Expected files/modules: `src/modules/chat/{service,actions,queries,menus,caps,prompt,sanitize,prompts-admin}.ts`, `src/modules/chat/providers/{anthropic,fake,index}.ts`, `src/jobs/chat-purge.ts`.
- Tests required: unit `tests/unit/chat/{menus,caps-boundary,prompt-builder,refusal-fallback,sanitizer,anthropic-mapping}.test.ts` (Anthropic SDK mocked; event mapping incl. `refusal`, tool call, timeout); integration `tests/integration/chat/{start-requires-verified,menu-no-llm-call,caps-user-then-platform,cap-notifies-once,prompt-versions-single-active,transcript-admin,provider-payload-has-no-pii}.test.ts`, `tests/integration/jobs/chat-purge.test.ts` (rows past `purge_after` deleted, others kept; run twice) (`@security` SA-20 asserting the fake provider's recorded request contains no email/phone/order numbers; TM-08 chunk wrapping).
- Acceptance criteria:
  - [ ] menu intents answer from the caller's rows and record no provider call
  - [ ] cap boundary: message at cap → menu-only fallback; admins notified once per day
  - [ ] provider request contains system prompt + delimited chunks + user text only (SA-20)
  - [ ] `refusal` and provider error both produce a menu fallback event
- Definition of Done: code + tests (coverage ≥ 90/80/90) + PROGRESS row + CI green; master plan §6 "chat menu, AI (mocked provider), caps".
- Potential risks and mitigations: Anthropic SDK API drift → all SDK usage in `providers/anthropic.ts` only, mocked in unit tests, one nightly `ai-live` smoke on staging with a USD 5 cap (docs/10 §4); model id from settings so switching needs no deploy.

### P6.7 `POST /api/chat` SSE route, lead capture, escalation
- Owner profile: domain-standard (agent B)
- Requirement IDs: FR-CHAT-03 (SSE), FR-CHAT-05, FR-CHAT-10, D-702, D-704, API-CHAT-08, API-CHAT-09, API-CHAT-15, docs/06 §3.2 (event names and order), §5.6, docs/04 §9, docs/09 §11, TM-08 (explicit confirmation for escalation/lead), S-15 steps 3, 6, 7 (server)
- Description: `src/app/api/chat/route.ts`: auth (customer, verified), body `{ conversationId, content ≤ 2000 }`, pre-flight in the documented order (rate `chat` → caps → ownership → retrieval top-8 → `LLMProvider.stream`), response `text/event-stream` with events `meta → delta* → citations? → lead_intent? → done`, or `fallback {menu, reason: refusal|timeout|unavailable|limit}` then `done`; cap reached before the call → HTTP 200 with a single `fallback(limit)`. Persist after close: `chat_messages` (user + assistant with tokens, `retrieved_chunk_ids`), usage decrement on pre-first-token failure. `capture_lead` is the model's only tool and is side-effect-free (docs/04 §9, docs/09 §11): when the model calls it the route emits `event: lead_intent { name?, email?, need }` and writes nothing; the client shows a confirm card and the lead row is created only by the `confirmLeadCapture` action (API-CHAT-15: `leads.createLeadFromChat(source='chatbot', user_id, message=need)`, `chat_messages(role='system', 'lead captured')`, `N: lead.new`, `A: chat_lead_captured`; `STATE_INVALID` when the conversation has ended). No lead is ever created from a model action (TM-08). `escalateConversation(conversationId, subject?, summary?)`: `queries.createFromChat` with transcript summary + last 10 turns as system message, `conversations.escalated_query_id/ended_at`, `N: query.new`, `A: chat_escalated`; `STATE_INVALID` when already escalated. Bot offers escalation after two consecutive `fallback` events (flag in conversation state). No `runtime = 'edge'` (lint). SSE contract implemented by the route (clients ignore unknown events, docs/06 §6):

  | Event | Payload | When | Persisted as |
  |-------|---------|------|--------------|
  | `meta` | `{ messageId, usage: { userRemaining, platformRemaining } }` | first, after pre-flight | — |
  | `delta` | `{ text }` | per streamed token chunk | concatenated into the assistant `chat_messages` row |
  | `citations` | `{ chunks: [{ title, sourceType, href }] }` | after last delta when chunks were used | `retrieved_chunk_ids` |
  | `lead_intent` | `{ name?, email?, need }` | when the model calls `capture_lead` (optional, at most once per message) | nothing — the lead row exists only after API-CHAT-15 `confirmLeadCapture` returns `{ leadId }` |
  | `fallback` | `{ menu: MenuNode[], reason: 'refusal'\|'timeout'\|'unavailable'\|'limit' }` | refusal / timeout / provider error / cap | `chat_messages(role='menu')` |
  | `done` | `{ tokensIn, tokensOut, stopReason }` | always last | token counts on the row; usage counters reconciled |

- Owned paths: `src/app/api/chat/**`, `src/modules/chat/escalation.ts`, `src/modules/chat/lead-capture.ts`. Forbidden: `queries/**`, `leads/**` (contracts).
- Dependencies: P6.6, P6.5, P6.3.
- Expected files/modules: as listed + `src/modules/chat/sse.ts` (encoder).
- Tests required: integration `tests/integration/api/chat-route/{stream-events-order,fallback-refusal,fallback-timeout,fallback-limit-200,persist-after-close,lead-intent-writes-nothing,confirm-lead-capture-creates-lead,escalate-creates-query,escalate-twice-invalid,unverified-403,injection-chunk-boundaries}.test.ts` (fake provider; S-15 step 7 asserts the answer does not include prompt text).
- Acceptance criteria:
  - [ ] event order matches docs/06 §3.2; unknown events are additive only
  - [ ] "trigger timeout" yields `fallback(timeout)` within `chatTimeoutMs + 1 s`
  - [ ] escalation creates a query with transcript excerpt and ends the conversation
  - [ ] `lead_intent` writes no row; the lead exists only after `confirmLeadCapture` (API-CHAT-15)
- Definition of Done: code + tests + PROGRESS row + CI green; master plan §6 "escalation".
- Potential risks and mitigations: streaming on Vercel Hobby 60 s function limit → 20 s hard timeout keeps well inside; SSE buffering by proxies → `X-Accel-Buffering: no`, flush per event.

### P6.8 Analytics
- Owner profile: domain-standard (agent B)
- Requirement IDs: FR-COM-14, FR-CHAT-10, FR-SEO-06, NFR-PERF-01 (field INP), D-1301, D-1302, A-1501, API-OPS-01, API-OPS-02, API-OPS-03, docs/11 §A9, §B10 (field vitals), §B13, docs/06 §3.3 / docs/12 §2.3 (`vitals.rollup`), MASTER_SPEC §7 "INP measurement"
- Description: `trackEvent` (rate class `analytics`; client-allowed names `product_view|wishlist_add|checkout_start|page_view|chat_started`; server-only names rejected with `FORBIDDEN`; `anonId` uuid; props ≤ 20 keys/2 KB), server-side emitters used by P4/P5/P6 (`payment_submitted`, `payment_confirmed`, `inquiry_submitted`, `signup`, `login`, `chat_escalated`, `chat_lead_captured`, `refund`). `POST /api/analytics/vitals` (`sendBeacon`, `name = 'web_vital'`, props `{metric, value, rating, route pattern, navType, device, connection, theme, three}`, no user id). `src/components/site/WebVitals.tsx` (client; P7 mounts it) and finalise `UmamiScript` (renders when env + `launched_at`). Queries: `listJobRuns` (filters; missed windows), `getSystemHealthWidget` (`jobs`, `fxAgeDays`, `emailOutbox {queued, failed}`, `chatUsage`, `sentryLink`, vitals p75 per route 28 d), `popularProducts30d` for catalog sort `popular`, funnel/conversion/visits data for P8 widgets (`visits_top_products`, `conversion_rate`, `chatbot_usage`). `analytics.rollup(now)` in `src/modules/analytics/rollup.ts` (p75 per metric per route for the System widget, monthly aggregate, purge > 13 months per docs/12 §11.7) exported for the `vitals.rollup` `daily` job, which P9.4 registers; the beacon writes `analytics_events` directly, so there is no ingest-flush job.
- Owned paths: `src/modules/analytics/**` (except frozen), `src/app/api/analytics/**`, `src/components/site/WebVitals.tsx`, `src/components/site/UmamiScript.tsx` (finalise P1.8 placeholder). Forbidden: other modules, `src/jobs/**`.
- Dependencies: none in-phase (P3.3 `launched_at` setting via stub).
- Expected files/modules: `src/modules/analytics/{service,actions,queries,names,vitals,widgets,rollup}.ts`, routes, component.
- Tests required: unit `tests/unit/analytics/{names,props-limits}.test.ts` (every funnel step name once; server-only names rejected); integration `tests/integration/analytics/{track-event,vitals-ingest-no-user,system-health-widget,popular-products,rollup-job}.test.ts`; `tests/unit/components/web-vitals.test.tsx` (posts via beacon, route pattern not path).
- Acceptance criteria:
  - [ ] client cannot write `payment_confirmed`
  - [ ] vitals rows carry no user identifier and use route patterns
  - [ ] system health widget reports FX age, outbox counts, job status
- Definition of Done: code + tests + PROGRESS row + CI green; master plan §6 "analytics ingest".
- Potential risks and mitigations: `analytics_events` growth on Neon free tier → monthly rollup + purge job, storage widget.

### P6.9 Phase gate: scenarios + reviewer
- Owner profile: reviewer
- Requirement IDs: master plan §6 (P6 gate), docs/10 §13 (P5 row), S-14, S-15 (server side), SA-15, SA-16, SA-20
- Description: Author `tests/integration/scenarios/p6-{leads,chat}.test.ts` running S-14 (steps 1–4 with the digest job) and S-15 (steps 1–7 with the fake provider and P5/P4 stubs for menu data) end to end at service/route level; sample SA-15 limits (inquiry 5/h per IP, chat 30/10 min per user); audit acceptance boxes, coverage (`modules/chat` ≥ 90/80/90), contract freeze, ownership compliance (`src/jobs/{email-outbox,lead-digest,chat-purge}.ts` and `src/app/api/{chat,notifications,analytics}/**` are P6's per master plan §3), doc corrections (email template aliases only, if any; the `queries.autoclose` job key gap is filed by P9.12). Write `implementation/reviews/P6-review.md`.
- Owned paths: `tests/integration/scenarios/p6-*.test.ts`, `implementation/reviews/P6-review.md`. Forbidden: `src/**`.
- Dependencies: P6.1–P6.8.
- Expected files/modules: as listed.
- Tests required: scenario files tagged `@security` where they cover SA-15/16/20.
- Acceptance criteria:
  - [ ] S-14 and S-15 green at service level
  - [ ] SA-15 (sampled), SA-16, SA-20 green
  - [ ] review file with evidence
- Definition of Done: scenarios + review + PROGRESS statuses + CI green.
- Potential risks and mitigations: S-15 menu answers need P4/P5 data → factories + stubs provide orders/entitlements rows directly.

## Parallelisation map

```
Agent A: P6.1 ──┬── P6.2 ──┐
                ├── P6.3 ──┼── P6.4
                └── P6.5 ──┼──────────┐
Agent B: P6.8 (independent)          ├── P6.9
         P6.6 (after P6.1 contract) ── P6.7 (after P6.5, P6.3) ┘
```

- P6.1 first for agent A (every other task emits notifications); agent B starts P6.8 immediately (no dependency) and P6.6 as soon as P6.1's `emit` merges (can begin against the stub).
- P6.2, P6.3, P6.5 concurrent after P6.1 (disjoint directories: `emails/`, `leads/`, `queries/`).
- P6.4 after P6.3 + P6.2 (uses the digest template). P6.7 after P6.6, P6.5 and P6.3 (escalation and lead capture call their services).
- Same-directory rule: only agent B writes `chat/`; only agent A writes `notifications/`, `leads/`, `queries/`, `emails/`; `src/jobs/` files are distinct per task.
- Cross-phase: P5.8's `listOpenRevokeExternalTasks` needed by P6.4 — stubbed until P5 merges.

Cross-phase handoffs into and out of P6:

| Direction | Contract | Provided by | Consumed by |
|-----------|----------|-------------|-------------|
| in | `search.retrieve(query, 8)` | P3.13 | P6.6 / P6.7 |
| in | `settings` (`ai_model`, caps, timeout, `turnstileSiteKey`, `launched_at`) | P3.3 | P6.6, P6.3, P6.8 |
| in | orders/entitlements/subscriptions/invoices "mine" queries | P4.2, P5.9, P5.6, P4.5 | P6.6 menus |
| in | `delivery.listOpenRevokeExternalTasks()` | P5.8 | P6.4 |
| in | `users.onAdminRemoved` hook | P3.4 | P6.3 (leads back to pool) |
| out | `notifications.emit(...)` | P6.1 | P3.2, P3.7, P3.9, P3.12, P4.*, P5.*, P9.4 |
| out | `leads.createLead*`, `queries.createQuery/createFromChat` | P6.3, P6.5 | P7.2, P7.6, P7.9, P7.11, P8.9, P8.10 |
| out | `analytics.track*`, `getSystemHealthWidget`, `popularProducts30d` | P6.8 | P3.6 (sort), P7.*, P8.2 |
| out | `GET /api/notifications`, `POST /api/chat` | P6.1, P6.7 | P7.10, P7.11, P8.1 |

## Phase Definition of Done

- All 9 tasks `done`; `implementation/reviews/P6-review.md` committed.
- CI green: unit (notifications, emails snapshots, leads, queries, chat incl. Anthropic mapping, analytics), integration (fan-out, poll route on both hosts, outbox retry, Resend webhook, leads with Turnstile stub, digest job, query threads, chat route SSE incl. fallbacks and caps, escalation, analytics ingest; S-14, S-15 server side; SA-15 sample, SA-16, SA-20).
- Coverage `modules/chat` ≥ 90/80/90; contract freeze unchanged.
- All 28 notification types have templates; all `E:` names resolve.
- `src/jobs/{email-outbox,lead-digest,chat-purge}.ts` export `{ key, run(now) }` for `email.outbox_retry`, `admin.overdue_digest`, `retention.purge` and pass the run-twice test; no `ISSUES.md` additions expected.

## Phase risks

| Risk | Mitigation |
|------|------------|
| Anthropic SDK/streaming behaviour differs from mocks | provider isolated in one file; nightly `ai-live` smoke on staging with spend cap |
| Prompt injection via admin content | plain-text chunks, delimiters, no tools with side effects, explicit confirmation for lead/escalation (TM-08) |
| Email volume on Resend free tier | outbox priority + daily-cap deferral; admin mail = digest only |
| Turnstile misconfiguration blocks all forms | test keys in non-prod; fail-closed with visible error; smoke check in P9 |
| Rate-limit values | one canonical set (NFR-SEC-03 = docs/06 §1.7 = docs/09 §7), settings-tunable; founder may tune (I-005) |

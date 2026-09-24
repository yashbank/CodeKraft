# PHASE-05 — Delivery & subscriptions

**Wave:** W3 (parallel with P3, P4, P6; 1 agent — master plan §1.3 "one agent owns entitlements") · **Roadmap items:** R1-15, R1-17 (dashboard data half) · **Master plan §6 gate:** integration: entitlement per delivery type; download cap; license reveal; subscription reminder/grace/suspend via cron; revocation paths.

## Phase objective

Implement the delivery pivot of MASTER_SPEC §4.3: one entitlement per paid order item, created by `entitlements.grantForOrder`, with per-type `DeliveryHandler`s (`saas`, `hosted`, `download`, `license`, `service`, `custom`), presigned capped downloads with logging, encrypted license keys with audited reveal, service checklists, delivery tasks for manual provisioning and external revocation, manual grants/revokes with mandatory reasons, and subscriptions (renewal orders, reminders, grace `past_due`, suspension, cancel at period end) driven by idempotent cron jobs. Also the two job files the master plan §3 assigns to this phase, `src/jobs/subscriptions.ts` (`subscriptions.remind_grace_suspend`, `entitlements.expire`) and `src/jobs/retention.ts` (`retention.purge_tokens`, `users.anonymise` sweep). Everything is server-side; P7/P8 render it.

## Prerequisites

- P2 done: `entitlements`/`delivery`/`subscriptions` schema, `DeliveryHandler` interface, `EntitlementView` Zod output, factories, `tests/stubs` (notifications, finance).
- P4 **contracts** only (frozen in P2): `orders.createOrder` with `expiresAt`/`renewal` fields, `orders.markFulfilledIfComplete`, `payments.confirmPayment` hook `onPaid(orderId, tx)` → this phase's `grantForOrder`. Order expiry (`orders.expire`, `src/jobs/order-expiry.ts`) is P4.2's. P5 tests use P4 factories, never P4's implementation (master plan §7).
- P3.5 storage client (MinIO in test), P3.1 audit, P1 `lib/crypto`.
- Env: `APP_ENCRYPTION_KEY`, `R2_BUCKET_PRIVATE`, storage endpoint.
- Rules applied (the docs agree; nothing open except the founder's option to relax I-004): the license-key email and in-app notification carry only a dashboard link, never the key (FR-DEL-07, API-DEL-08, docs/10 S-03, docs/12 §7, TM-05); anonymisation is immediate inside API-AUTH-08 (BR-18, FR-DASH-08, docs/05 §12, docs/09 §5.3) and `users.anonymise` is a safety sweep only; download/license/saas-manual entitlements are `active` on grant (MASTER_SPEC §7 "Order fulfilled", docs/03 §3.4); manual grants create no order, invoice, ledger entry or allocation (API-DEL-11).

## Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P5.1 | Entitlements core: `grantForOrder`, state machine, revoke/expire/extend, manual grant, reset cap, queries | domain-critical | — |
| P5.2 | Delivery handlers per type + fulfilment computation | domain-critical | P5.1 |
| P5.3 | Downloads: presigned issuance, cap, log, update policy, route | domain-critical | P5.2 |
| P5.4 | License keys: set, encrypt, masked view, audited reveal | domain-critical | P5.2 |
| P5.5 | Provisioning, service progress, delivery tasks | domain-standard | P5.2 |
| P5.6 | Subscriptions: create on grant, renewal order, cancel, period roll-forward on paid | domain-critical | P5.1 |
| P5.7 | Cron jobs: `src/jobs/subscriptions.ts` (`subscriptions.remind_grace_suspend`, `entitlements.expire`) + `src/jobs/retention.ts` (`retention.purge_tokens`, `users.anonymise` sweep) | domain-critical | P5.5, P5.6 |
| P5.8 | Revocation paths: refund hook, chargeback, manual revoke, external revoke reminders | domain-critical | P5.2, P5.5 |
| P5.9 | Customer read models (`EntitlementView`, dashboard joins) and phase gate scenarios | domain-standard + reviewer | all |

### P5.1 Entitlements core
- Owner profile: domain-critical
- Requirement IDs: FR-DEL-01, FR-DEL-02, FR-DEL-06, FR-DEL-10, FR-DEL-12, A-602, D-605, D-1108, API-DEL-01 (skeleton), API-DEL-06, API-DEL-11, API-DEL-12, API-DEL-13, API-DEL-14, docs/03 §3.4, S-23 (server), master plan §5 `entitlements.grantForOrder/revoke`, MASTER_SPEC §4.3, §7 "Manual entitlement grants" (both rows), "Order fulfilled"
- Description: `grantForOrder(orderId, tx)`: for every order item with an offering, create exactly one `entitlements` row copying `delivery_type`, `update_policy`, `download_cap`, access window (`access_starts_at = paid_at`, `access_ends_at = + accessMonths` or null for lifetime; subscription → period end), initial status per docs/03 §3.4 and MASTER_SPEC §7 "Order fulfilled": `active` for `download`, `license`, `service`, `custom` and manual `saas` (the latter with `provisioning_state='pending'`, which does not block `active`), `pending` only for manual `hosted` until `completeProvisioning`; dispatch `handler.onGranted`; create `subscriptions` row via P5.6 for subscription offerings; renewal orders (item flagged `renewal`) route to P5.6 `onRenewalPaid` instead of creating a new entitlement; idempotent per `order_item_id` (partial unique). State machine per docs/03 §3.4 in `state.ts` (`pending → active`, `active → suspended|expired|revoked`, `suspended → active|revoked`, `expired → revoked`). `revoke(entitlementId, reason, tx)`: `revoked`, `revoked_at`, `revoke_reason`, `handler.onRevoked('hard')` (may create `revoke_external` task), `E: access-revoked`. `expireAccess(now, tx)` for one-time entitlements past `access_ends_at` (run by the `entitlements.expire` job, P5.7). `grantManual({ userId, offeringId, accessMonths, reason })` (`entitlements.admin`, API-DEL-11): `order_item_id = null`, `granted_manually_by`, `status='active'` (`provisioning_state='pending'` for saas-manual), mandatory reason, audit row with the reason, `N: entitlement.granted_manually` to every other admin, `E: access-granted`; never creates an order, invoice, ledger entry or allocation and is not dual-approved (MASTER_SPEC §7 "Manual entitlement grants"); `DUPLICATE_PURCHASE` when an active one-time entitlement exists. `resetDownloadCount` (audited), `extendAccess`/`cancelSubscriptionAdmin` (API-DEL-14). `listEntitlementsAdmin`/`getEntitlementAdmin` (filters per API-DEL-06; `admin` scope own products). After any status change call `orders.markFulfilledIfComplete` via contract when all handlers report fulfilled.
- Owned paths: `src/modules/entitlements/**` (except frozen). Forbidden: `orders/**`, `payments/**`, `finance/**`.
- Dependencies: P2 contracts, P3.1 audit.
- Expected files/modules: `src/modules/entitlements/{service,actions,queries,state,grant,manual,admin}.ts`.
- Tests required: unit `tests/unit/entitlements/{state,access-window}.test.ts` (lifetime vs months; month-end dates); integration `tests/integration/entitlements/{grant-per-item,grant-idempotent,pending-for-manual-saas,manual-grant-no-ledger,manual-grant-duplicate,revoke,expire-access,reset-cap-audited,admin-scope,foreign-id-404}.test.ts` (S-23 steps 1–2 at service level; `@security` SA-10, SA-23 helper).
- Acceptance criteria:
  - [ ] one entitlement per paid item; re-running `grantForOrder` creates none
  - [ ] manual grant has `order_item_id = null`, `granted_manually_by` set, no `orders`/`ledger_entries`/`allocations` rows, partner balances unchanged (stub asserts no finance call)
  - [ ] every admin mutation carries an audit row with the reason
  - [ ] manual `hosted` lands `pending` with an open `provision` task; manual `saas` lands `active` with `provisioning_state='pending'` and an open `provision` task; `download`/`license`/`service`/`custom` land `active` (docs/03 §3.4, MASTER_SPEC §7 "Order fulfilled")
  - [ ] `expireAccess(now)` expires only one-time entitlements past `access_ends_at`; subscription-backed ones are left to P5.7
- Definition of Done: code + tests (coverage ≥ 95/90/95) + PROGRESS row + CI green.
- Potential risks and mitigations: `grantForOrder` invoked inside P4's confirm transaction with a long chain → handler `onGranted` must be cheap (no external calls); email/notification via outbox rows only.

### P5.2 Delivery handlers per type + fulfilment computation
- Owner profile: domain-critical
- Requirement IDs: FR-DEL-02, FR-DEL-03, FR-DEL-08, FR-DEL-09, FR-DEL-11, A-601, D-601–D-608, docs/04 §7.3, docs/06 §5.1 step 6, API-DEL-01 (`render`), API-DEL-06 (`adminActions`), MASTER_SPEC §7 "Order fulfilled"
- Description: `src/modules/delivery/handlers/{saas,hosted,download,license,service,custom}.ts` implementing `DeliveryHandler`: `onGranted` — `saas`/`hosted`: `delivery_tasks(provision)` when `delivery_config.provisioning = 'manual'`, `provisioning_state = 'pending'` (automated path refused unless flag `automated_provisioning`, returns `STATE_INVALID` in R1); `download`: nothing beyond active; `license`: `provisioning_state = 'pending'` + `delivery_tasks(provision)` (admin must enter the key); `service`: `service_progress` rows from `offering.service_steps`; `custom`: active + instructions. `onRevoked(mode)` — platform-controlled types revoke immediately; `saas`/`hosted` with external accounts create `delivery_tasks(revoke_external)` (`hard`) or soft-suspend (`soft`, used by grace). `render(entitlement, viewer)` builds the `EntitlementView` sections for its type (downloads, key masked, provisioning notes, service progress, subscription, `instructionsHtml` from `offering.instructions_json` fallback product text via P3.10 renderer). `adminActions` list per type (`complete_provisioning`, `set_license_key`, `mark_step`, `revoke`, `reset_downloads`, `extend_access`). `isFulfilled` — download/custom: active; license: key set (API-DEL-08 sets the order `fulfilled` there); saas/hosted: `provisioning_state='done'` (API-DEL-07 sets the order `fulfilled` there — the entitlement itself is `active` earlier for saas, MASTER_SPEC §7 "Order fulfilled"); service: all steps done (API-DEL-09). `orders.markFulfilledIfComplete` requires every item's handler to report fulfilled. `handlers/index.ts` registry keyed by `delivery_type`. Behaviour matrix the handlers must implement (the unit test matrix mirrors it row by row):

  | `delivery_type` | `onGranted` | initial status | `isFulfilled` (order → `fulfilled`) | `onRevoked('hard')` | `onRevoked('soft')` (grace/suspend) | customer `render` sections |
  |-----------------|-------------|----------------|-------------------------------------|----------------------|-------------------------------------|----------------------------|
  | `download` | none | `active` | on grant | `revoked`; downloads refused | `suspended`; downloads hidden | downloads (cap, files by policy), history, versions, instructions |
  | `license` | `provisioning_state=pending`, task `provision` | `active` | when key set | `revoked`; key hidden | `suspended`; key hidden | masked key + reveal, instructions, versions |
  | `saas` (manual) | `provisioning_state=pending`, task `provision` | `active` on grant (`provisioning_state` tracked separately, MASTER_SPEC §7) | when `provisioning_state=done` | `revoke_external` task; status `revoked` when task done (or immediately if no external account) | `revoke_external(soft)` task; `suspended` | provisioning notes/login URL, subscription block, instructions |
  | `hosted` (manual) | as `saas` | `pending` until `completeProvisioning` (docs/03 §3.4) | as `saas` | as `saas` | as `saas` | as `saas` + service progress when steps exist |
  | `service` | `service_progress` rows from `service_steps` | `active` | all steps done | `revoked` | `suspended` | checklist n/m with timestamps/notes, instructions |
  | `custom` | none | `active` | admin marks (API-DEL-07 semantics) | `revoked` | `suspended` | instructions only |
  | `saas`/`hosted` automated | refused in R1 (`STATE_INVALID` unless flag `automated_provisioning`) | — | — | — | — | — |

- Owned paths: `src/modules/delivery/handlers/**`, `src/modules/delivery/{service,queries}.ts` (shared helpers). Forbidden: `entitlements/**` (call service).
- Dependencies: P5.1.
- Expected files/modules: six handler files + `index.ts` + `fulfilment.ts`.
- Tests required: unit `tests/unit/delivery/handlers/*.test.ts` (per type: onGranted side effects, onRevoked task creation for external SaaS — docs/10 §7, render sections, isFulfilled matrix); integration `tests/integration/delivery/{grant-each-type,fulfilment-order-status}.test.ts` (five seeded products → correct handler behaviour; MIS Portal 3 steps → order `fulfilled` only after step 3 — S-05 server side).
- Acceptance criteria:
  - [ ] each seeded product's offering resolves to the right handler and side effects (master plan §6 "entitlement per delivery type")
  - [ ] external SaaS revoke creates `revoke_external`; download revoke is immediate
  - [ ] `orders.fulfilled` reached only when every item's handler reports fulfilled
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: handler interface tempted to grow → frozen in P2; additions need an ADR and a snapshot update.

### P5.3 Downloads
- Owner profile: domain-critical
- Requirement IDs: FR-DEL-04, FR-DEL-05, FR-DEL-06, FR-DEL-10, FR-DASH-10, FR-SEC-04, NFR-SEC-03 (downloads), NFR-SEC-04, BR-15, D-602, D-604, D-605, D-606, API-DEL-02, docs/06 §3.5 (`GET /api/files/download`), §5.7, TM-04, SA-11, SA-12, S-02 steps 6–7 (server)
- Description: `issueDownloadLink(entitlementId, mediaId, ctx)`: rate class `download` (20/h per user — NFR-SEC-03 = docs/06 §1.7 = docs/09 §7 — plus the per-entitlement cap, BR-15); entitlement `active` and `access_ends_at` not passed (`STATE_INVALID`); media ∈ `release_files` of the product and allowed by `update_policy` (`all_free`: any version; `during_access`: versions released before `access_ends_at`; `major_paid`: versions with the same major as the purchased `current_version` at grant); atomic `UPDATE entitlements SET downloads_used = downloads_used + 1 WHERE id = ? AND (download_cap IS NULL OR downloads_used < download_cap) RETURNING` → 0 rows → `LIMIT_EXCEEDED` with message pointing to a query (`source='dashboard'`); `downloads(ip, user_agent)` row; audit (customer security event); presigned GET 5 min with `response-content-disposition=attachment; filename="<product>-<version>.<ext>"`. Route `src/app/api/files/download/[entitlementId]/[mediaId]/route.ts` → 302 (never proxies bytes; JSON errors 401/403/404/409/429). `listReleaseFiles(entitlementId)` with the policy filter and `listDownloadHistory`.
- Owned paths: `src/modules/delivery/downloads.ts`, `src/app/api/files/download/**`. Forbidden: `media/**` (use storage client).
- Dependencies: P5.2; P3.5 storage.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/delivery/update-policy.test.ts`; integration `tests/integration/delivery/{issue-link,cap-reached,cap-atomic-concurrent,revoked-refused,expired-refused,policy-filter,history,route-302}.test.ts` (`@security` SA-11, SA-12: URL expiry ≤ 300 s parsed from the signed query).
- Acceptance criteria:
  - [ ] seed cap 3: fourth issuance refused, no URL, `downloads_used = 3` (S-02 step 7)
  - [ ] 10 concurrent issuances on cap 3 yield exactly 3 rows
  - [ ] revoked/expired entitlements get `STATE_INVALID`
  - [ ] every issuance logged with ip/user agent and audited
- Definition of Done: code + tests + PROGRESS row + CI green; master plan §6 "download cap".
- Potential risks and mitigations: R2 presign clock skew → 5-min window measured from server time; `major_paid` semver comparison → `semver` lib, unit-tested.

### P5.4 License keys
- Owner profile: domain-critical
- Requirement IDs: FR-DEL-07, FR-SEC-05, NFR-SEC-06, D-603, D-1002, API-DEL-03, API-DEL-08, TM-05, SA-14, S-03 steps 2–3 (server), docs/09 §7 (`key_reveal` 10/h), docs/12 §7 (`delivery-license-key`), MASTER_SPEC §7 "License key channel", "License key delivery"
- Description: `setLicenseKey(entitlementId, licenseKey 8..512, installNotesJson?, notifyEmail)`: `license_key_enc = lib/crypto.encrypt(key)`, `provisioning_state = 'done'`, close the `provision` task, `N: license.ready` and `E: delivery-license-key` — both carry only a link to the dashboard entitlement page; the key is never placed in the email or the notification, not even masked (FR-DEL-07, API-DEL-08, docs/12 §7, S-03 step 2, TM-05; the founder may relax this to plaintext email — `ISSUES.md` I-004, default off), order fulfilment check. `revealLicenseKey(entitlementId)`: `delivery.self`, entitlement `active`, rate 10/h, decrypt server-side, audit `license.revealed`, never cached/logged (logger redact list covers `licenseKey`). Masked view `XXXX-…-1234` in `render`.
- Owned paths: `src/modules/delivery/license.ts`. Forbidden: `lib/crypto.ts`.
- Dependencies: P5.2.
- Expected files/modules: as listed.
- Tests required: integration `tests/integration/delivery/{set-key-encrypted,reveal-audited,reveal-not-active,reveal-rate-limit,key-absent-from-logs}.test.ts` (`@security` SA-14: `license_key_enc ≠ plaintext`, decrypts with key; log capture has no key).
- Acceptance criteria:
  - [ ] stored value differs from plaintext and round-trips
  - [ ] reveal writes `license.revealed` audit row; suspended/revoked entitlement cannot reveal
  - [ ] email and in-app payloads carry a dashboard link only; S-03 asserts the plaintext key is absent from the outbox row
- Definition of Done: code + tests + PROGRESS row + CI green; master plan §6 "license reveal".
- Potential risks and mitigations: founder wants plaintext key in email → single settings flag `licenseKeyInEmail` (default off, raises TM-05 residual to Medium), tracked as `ISSUES.md` I-004; nothing is built for it until answered.

### P5.5 Provisioning, service progress, delivery tasks
- Owner profile: domain-standard
- Requirement IDs: FR-DEL-03, FR-DEL-08, FR-DEL-11, FR-ADM-13 (queue data), D-601, D-607, D-608, API-DEL-07, API-DEL-09, API-DEL-10, S-04, S-05 (server)
- Description: `completeProvisioning(entitlementId, notes {loginUrl, username, message}, credentialsEmail)`: `provisioning_state = 'done'`, `provisioning_notes` (shown to customer), task `done`, `E: access-provisioned`, fulfilment check. `markServiceStep(entitlementId, stepKey, done, note)`: `service_progress.done_at/done_by/note`, `N: service.progress` + `E: service-progress`, when all done → order fulfilled (`E: order-fulfilled` "your project is complete"). `listDeliveryTasks` (filters `kind, status, assignedTo`, sorted by age) / `completeDeliveryTask(taskId, note)` (`revoke_external` completion sets `revoked` if not already). Operations-queue query `listOpsQueue()` (payments awaiting via P4 query contract, provision tasks, revoke tasks, service checklists due, pending approvals) for FR-ADM-13.
- Owned paths: `src/modules/delivery/{provisioning,service-progress,tasks,ops-queue}.ts`, `src/modules/delivery/actions.ts`. Forbidden: `entitlements/**` internals.
- Dependencies: P5.2.
- Expected files/modules: as listed.
- Tests required: integration `tests/integration/delivery/{complete-provisioning,service-steps-fulfil,tasks-list-complete,revoke-external-completion,ops-queue}.test.ts` (S-04, S-05 server side).
- Acceptance criteria:
  - [ ] provisioning done → notes visible in `render`, email queued, order fulfilled when all items done
  - [ ] ticking 3/3 steps flips the order to `fulfilled` with `fulfilled_at`
  - [ ] ops queue sorted by age and scoped for `admin` role
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: credentials in provisioning notes emailed in plaintext → notes marked sensitive; email contains login URL + username, password never stored (admin sends it out of band or the notes field forbids `password` key — validated).

### P5.6 Subscriptions
- Owner profile: domain-critical
- Requirement IDs: FR-DEL-13, FR-DEL-15, FR-DEL-16, FR-DASH-06, BR-14, D-503, D-521, D-1004, API-DEL-04, API-DEL-05, docs/03 §3.5, docs/06 §5.3, S-06 steps 2, 5, 6 (server), MASTER_SPEC §7 "Renewal order expiry", "Subscription grace"
- Description: `createForEntitlement(entitlement, offering, paidAt, tx)`: `interval`, `current_period_start = paidAt`, `current_period_end = + interval` (month-end safe), `status = trialing` when `trial_days > 0` else `active`; entitlement `access_ends_at` mirrors period end. `renewSubscription(entitlementId, paymentMethod, billing)`: refuse when cancelled or a renewal order is already `pending_payment` (return it); creates a renewal order through the orders contract (same offering, current price, item flagged `renewal`, `expiresAt = grace_until ?? period_end + 7 d` so BR-10/BR-14 coincide) and stores `renewal_order_id`. `onRenewalPaid(orderId, tx)` (called from `grantForOrder` for renewal items): roll `current_period_start/end` forward by one interval from the **previous** `period_end` when paid before/during grace, or start at confirmation date when paid after suspension; `status = active`, `grace_until = null`, `cancel_at_period_end = false`, entitlement `active`, `access_ends_at` updated. `cancelSubscription(entitlementId, reason)`: `cancel_at_period_end = true`, reminders stop, `E: subscription-cancelled`, `N: subscription.cancelled` (admins); no proration. Period math in `periods.ts`.
- Owned paths: `src/modules/subscriptions/**` (except frozen). Forbidden: `orders/**`, `entitlements/**` (contracts only).
- Dependencies: P5.1.
- Expected files/modules: `src/modules/subscriptions/{service,actions,queries,periods,renewal}.ts`.
- Tests required: unit `tests/unit/subscriptions/periods.test.ts` (31 Jan + 1 month, leap years, quarterly/annual); integration `tests/integration/subscriptions/{create-trialing,create-active,renewal-order-expires-at-grace,renewal-during-grace-rolls-from-period-end,renewal-after-suspension-starts-now,cancel-at-period-end,cancel-then-renew-clears-flag,duplicate-renewal-returns-existing}.test.ts`.
- Acceptance criteria:
  - [ ] renewal paid during grace: new period starts at the old `period_end` (docs/03 §5 DEL edge)
  - [ ] renewal after suspension: new period starts at confirmation
  - [ ] renewal order `expires_at` = `grace_until`
  - [ ] cancel then renew before period end clears the cancel flag
  - [ ] `trial_days > 0` yields `trialing` with `current_period_end = paidAt + trial_days`, then `active` at trial end (job-driven)
  - [ ] renewal order item is flagged `renewal` and `grantForOrder` routes it to `onRenewalPaid` (no second entitlement)
- Definition of Done: code + tests (≥ 95/90/95) + PROGRESS row + CI green.
- Potential risks and mitigations: `orders.createOrder` contract lacking `expiresAt`/`renewal` flags → added to the P2 contract before freeze (P2.6 owner); if missed, ADR + snapshot update.

### P5.7 Cron jobs: `src/jobs/subscriptions.ts` and `src/jobs/retention.ts`
- Owner profile: domain-critical
- Requirement IDs: FR-DEL-10, FR-DEL-14, FR-DEL-16, FR-DASH-08 (safety sweep only), FR-OPS-01, NFR-DATA-01, BR-14, BR-18, D-521, D-605, D-1503, docs/06 §3.3 (`subscriptions.remind_grace_suspend`, `entitlements.expire`, `retention.purge_tokens`, `users.anonymise`), docs/12 §2.3, docs/09 §5.3, S-06 steps 1, 3, 4, S-21 step 2, SA-21 (sweep half), MASTER_SPEC §7 "Subscription grace", "Anonymisation timing", master plan §3 (`src/jobs/{subscriptions,retention}.ts` are P5's)
- Description: Two job files, four job keys — the keys and endpoints are exactly those of docs/06 §3.3 / docs/12 §2.3 (identical lists). `src/jobs/subscriptions.ts` exports `subscriptionsRemindGraceSuspend` (`subscriptions.remind_grace_suspend`, `daily`) combining reminders (T−7 d and T−1 d windows; `reminder_sent_at` guard; skip when `cancel_at_period_end`; `N: subscription.reminder` + `E: subscription-reminder`), grace (`period_end < now`, not renewed/cancelled → `past_due`, `grace_until = period_end + 7 d`, `E: subscription-grace`, entitlement stays `active`), suspend (`grace_until < now` → `suspended`; entitlement `suspended`; `handler.onRevoked('soft')`; `E: subscription-suspended`) and cancel (`cancel_at_period_end` and `period_end < now` → `cancelled`, entitlement `expired`); and `entitlementsExpire` (`entitlements.expire`, `daily`) → `entitlements.expireAccess(now)` for one-time entitlements past `access_ends_at` (D-605). `src/jobs/retention.ts` exports `retentionPurgeTokens` (`retention.purge_tokens`, `frequent`: expired Better Auth `verifications`, expired unconsumed `files_upload_intents` plus their R2 `tmp/` objects) and `usersAnonymise` (`users.anonymise`, `daily`, **safety sweep only**: any `users.status='deleted'` row with `anonymized_at IS NULL` is anonymised with the same field rules as API-AUTH-08 — normally zero rows, because anonymisation happens immediately inside the delete transaction owned by P3.4). Order expiry (`orders.expire`) is P4.2's; chat purge (`retention.purge`) is P6.6's; nothing here touches orders or chat tables. Every job: `job_runs` row, window idempotency (docs/06 §1.5), explicit `now` parameter, state-guarded updates; each export is `{ key, run(now) }`. Endpoint wiring into `/api/cron/frequent|daily` is P9.4. Windows and guards per job:

  | Job key (docs/06 §3.3 = docs/12 §2.3) | File | Endpoint | Window key | State guard (idempotency) | Emits |
  |---------------------------------------|------|----------|------------|---------------------------|-------|
  | `subscriptions.remind_grace_suspend` | `subscriptions.ts` | `daily` | `day` | reminders: `reminder_sent_at` not within the T−7/T−1 window, skip `cancel_at_period_end`; grace: `status='active' AND current_period_end < now AND renewal not paid` → `past_due`; suspend: `status='past_due' AND grace_until < now` → `suspended`; cancel: `cancel_at_period_end AND period_end < now` → `cancelled` | `N: subscription.reminder/grace/suspended`, `E: subscription-reminder/-grace/-suspended` |
  | `entitlements.expire` | `subscriptions.ts` | `daily` | `day` | `status='active' AND access_ends_at < now AND no subscription` → `expired` | none (dashboard state) |
  | `retention.purge_tokens` | `retention.ts` | `frequent` | `15 min` | `verifications.expires_at < now`; `files_upload_intents.expires_at < now AND consumed=false` | none |
  | `users.anonymise` | `retention.ts` | `daily` | `day` | `status='deleted' AND anonymized_at IS NULL` (expected: no rows) | none |

- Owned paths: `src/jobs/{subscriptions,retention}.ts`, `src/jobs/_runner.ts` (shared `withJobRun`). Forbidden: `src/app/api/cron/**` (P9.4), `src/jobs/{order-expiry,quote-expiry,publish,fx,knowledge,email-outbox,lead-digest,chat-purge}.ts` (other phases), `src/modules/**` except through services.
- Dependencies: P5.5, P5.6; P3.4 anonymisation field rules (shared helper `users.anonymiseRow`).
- Expected files/modules: as listed.
- Tests required: integration `tests/integration/jobs/{subscriptions-reminder-no-duplicate,subscriptions-grace,subscriptions-suspend,subscriptions-cancel-at-period-end,entitlements-expire,retention-purge-tokens,users-anonymise-sweep-noop,users-anonymise-sweep-fixture}.test.ts` (S-06 1/3/4; S-21 step 2 — sweep changes zero rows after API-AUTH-08; a fixture row inserted with `anonymized_at IS NULL` is anonymised and keeps orders/invoices/ledger/audit; `@security` SA-21; each job run twice with the same `now` → same state).
- Acceptance criteria:
  - [ ] reminder at `period_end − 3 d` sent once; rerun sends nothing
  - [ ] grace keeps access (`past_due`, entitlement `active`); suspension hides downloads/keys (via `render`) and soft-revokes external accounts
  - [ ] `users.anonymise` is a no-op after a real self-delete (S-21 step 2) and anonymises only the fixture row, keeping its records
  - [ ] every run writes `job_runs`; the four exported keys are exactly the docs/06 §3.3 keys
- Definition of Done: code + tests + PROGRESS row + CI green; master plan §6 "subscription reminder/grace/suspend via cron".
- Potential risks and mitigations: job keys drifting from docs/06 §3.3 → P9.4's `tests/unit/jobs/registry.test.ts` asserts each documented key is mapped exactly once; reminders and grace in one job → per-subscription state guards keep each sub-step idempotent.

### P5.8 Revocation paths
- Owner profile: domain-critical
- Requirement IDs: FR-DEL-11, FR-PAY-13 (revoke part), FR-PAY-14, FR-NOTIF-04 (revoke-task digest input), D-416, D-607, API-DEL-12, API-PAY-06 (hook), API-PAY-08 (hook), TM-18, S-03 step 4, S-07 step 4 (revoke), S-23 step 2 (server)
- Description: Wire the four entry points to `entitlements.revoke`: refund apply (P4.8 calls the contract), chargeback (P4.4 calls the contract), manual admin revoke (`revokeEntitlement` action with mandatory reason, audit, `E: access-revoked`, optional `taskId` when external), account suspension (P3.4 → entitlements unreachable but not revoked: `render` refuses for suspended users). Daily reminder input: `listOpenRevokeExternalTasks()` consumed by P6.4's digest (`FR-NOTIF-04`). `reinstate` for admin unsuspend (suspended → active) and refund of a `partially_refunded` order leaves entitlements untouched.
- Owned paths: `src/modules/entitlements/revoke.ts`, `src/modules/delivery/revoke-tasks.ts`. Forbidden: `payments/**`, `finance/**`.
- Dependencies: P5.2, P5.5.
- Expected files/modules: as listed.
- Tests required: integration `tests/integration/entitlements/{revoke-manual-reason-required,revoke-download-immediate,revoke-saas-task,revoke-hides-key-and-downloads,suspended-user-render-refused,open-revoke-tasks-list}.test.ts`.
- Acceptance criteria:
  - [ ] revoke without reason → `VALIDATION`
  - [ ] after revoke: `issueDownloadLink` and `revealLicenseKey` refused (SA-11)
  - [ ] external SaaS revoke opens a task that appears in the digest input
- Definition of Done: code + tests + PROGRESS row + CI green; master plan §6 "revocation paths".
- Potential risks and mitigations: refund path calling revoke inside P4's transaction → revoke is transactional and cheap; `E:` goes to outbox.

### P5.9 Customer read models and phase gate
- Owner profile: domain-standard + reviewer
- Requirement IDs: FR-DASH-02, FR-DASH-06, FR-DASH-07, FR-DASH-10, API-DEL-01, API-DASH-01 (delivery joins), master plan §6 (P5 gate), docs/10 §13 (P3 row)
- Description: `listMyEntitlements`/`getMyEntitlement` returning the full `EntitlementView` (P2 Zod output) via `handler.render`, scoped (`NOT_FOUND` foreign — SA-10), including `subscription` block, `downloads {used, cap, files}`, `licenseKeyMasked`, `provisioning`, `serviceProgress`, `instructionsHtml`, `versions[]`; "next action" derivation for FR-DASH-02 (`submit reference | awaiting confirmation | retry | download | renew | view instructions`) exported for P7. Derivation table (first matching row wins):

  | Order status | Latest payment | Entitlement | Subscription | Next action |
  |--------------|----------------|-------------|--------------|-------------|
  | `pending_payment` | `initiated` | — | — | `submit_reference` |
  | `pending_payment` | `submitted` | — | — | `awaiting_confirmation` |
  | `pending_payment` | `failed` | — | — | `retry` |
  | `cancelled` / `failed` | any | — | — | `none` (shows reason) |
  | `paid` / `fulfilled` | `confirmed` | `active`, type `download`, cap not reached | — | `download` |
  | `paid` / `fulfilled` | `confirmed` | `active` | `past_due` or `suspended` | `renew` |
  | `paid` / `fulfilled` | `confirmed` | `active` | `active` within 7 d of `period_end` | `renew` |
  | `paid` / `fulfilled` | `confirmed` | `pending` (provisioning) | — | `view_instructions` ("we are setting up your access") |
  | `paid` / `fulfilled` | `confirmed` | `active` (other types) | — | `view_instructions` |
  | `refunded` / `partially_refunded` | `refunded`/`confirmed` | `revoked` / `active` | — | `none` / `view_instructions` | Then author `tests/integration/scenarios/p5-*.test.ts` (S-02 6–8, S-03, S-04, S-05, S-06, S-23 at service level with P4 factories and stubs) and `implementation/reviews/P5-review.md`.
- Owned paths: `src/modules/entitlements/customer-queries.ts`, `src/modules/entitlements/next-action.ts`, `tests/integration/scenarios/p5-*.test.ts`, `implementation/reviews/P5-review.md`. Forbidden: other `src/**`.
- Dependencies: P5.1–P5.8.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/entitlements/next-action.test.ts` (matrix order × payment × entitlement × subscription); integration scenarios above; `EntitlementView` output validated against the P2 Zod schema in every scenario.
- Acceptance criteria:
  - [ ] every scenario green; every `EntitlementView` passes the frozen Zod output schema
  - [ ] coverage `modules/entitlements` ≥ 95/90/95
  - [ ] review file confirms ownership compliance (no doc corrections expected: API-DEL-11, the job keys and S-03 already match the implementation)
- Definition of Done: read models + scenarios + review + PROGRESS statuses + CI green.
- Potential risks and mitigations: P7 needs fields not in `EntitlementView` → additive Zod change with snapshot update, never removal.

## Parallelisation map

```
P5.1 ──┬── P5.2 ──┬── P5.3 ──┐
       │          ├── P5.4 ──┤
       │          └── P5.5 ──┼── P5.8 ──┐
       └── P5.6 ─────────────┼── P5.7 ──┼── P5.9
                             └──────────┘
```

- Single agent by master plan rule; if a support agent is added, the only safe split is {P5.3, P5.4} (different files under `delivery/`) after P5.2, and P5.6 concurrently with P5.2 (different module). Never split P5.1/P5.2/P5.8 — they share the state machine.
- P5.7 needs P5.5 (tasks for soft revoke) and P5.6 (period fields). P5.8 after P5.5 (revoke tasks). P5.9 last.
- Cross-phase: P4.4 confirm calls `grantForOrder` — until P5.1 merges, P4 uses the stub; after merge, P4.13 re-runs its scenarios with the real implementation (orchestrator step).

Cross-phase handoffs (who calls what, to make the coupling explicit):

| Caller (phase.task) | P5 contract called | When | P5 task providing it |
|---------------------|--------------------|------|----------------------|
| P4.4 `confirmPayment` | `entitlements.grantForOrder(orderId, tx)` | inside the confirm transaction | P5.1 (+ P5.2 handlers, P5.6 subscriptions) |
| P4.8 `applyRefund` | `entitlements.revoke(entitlementId, reason, tx)` | inside the approval apply transaction | P5.1 / P5.8 |
| P4.4 `flagChargeback` | `entitlements.revoke(...)` | on chargeback | P5.8 |
| P3.4 `suspendCustomer` | none (render refuses for suspended users) | — | P5.8 |
| P3.7 `createProductVersion` | `entitlements.listHoldersForUpdate(productId)` (query) | on new version | P5.1 (query) |
| P6.4 digest job | `delivery.listOpenRevokeExternalTasks()` | daily | P5.8 |
| P6.6 chat menus | `entitlements.listMyEntitlements`, `subscriptions.listMine` | per menu intent | P5.9 / P5.6 |
| P7.10 / P7.11 screens | `EntitlementView`, `nextAction`, `renewSubscription`, `cancelSubscription`, download route | UI | P5.9 / P5.6 / P5.3 |
| P8.8 screens | `listEntitlementsAdmin`, `adminActions`, task actions | UI | P5.1 / P5.2 / P5.5 |
| P9.4 cron endpoints | `jobs/{subscriptions,retention}.ts` exports (`subscriptions.remind_grace_suspend`, `entitlements.expire`, `retention.purge_tokens`, `users.anonymise`) | scheduled | P5.7 |

## Phase Definition of Done

- All 9 tasks `done`; `implementation/reviews/P5-review.md` committed.
- CI green: unit (handlers, periods, next-action), integration (grant per type, download cap incl. concurrency, license reveal, subscription reminder/grace/suspend/cancel via jobs, revocation paths, token purge, anonymise sweep; S-02 6–8, S-03..S-06, S-21 step 2, S-23 at service level; SA-10, SA-11, SA-12, SA-14, SA-21).
- Coverage `modules/entitlements` ≥ 95/90/95; contract freeze unchanged (or ADR-referenced additive change for `orders.createOrder` renewal fields).
- `src/jobs/{subscriptions,retention}.ts` export the four docs/06 §3.3 keys as `{ key, run(now) }` and pass the run-twice test.
- No doc corrections expected; ownership per master plan §3 (`src/modules/{entitlements,delivery,subscriptions}/**`, `src/jobs/{subscriptions,retention}.ts`).

## Phase risks

| Risk | Mitigation |
|------|------------|
| Hidden coupling with P4 (master plan §7) | tests use P4 factories + stubs; real integration only in P4.13 re-run and P9 e2e |
| Period math errors (month ends, leap years) | dedicated unit matrix; date-fns-tz with Asia/Kolkata only where FY matters (never here — periods are UTC instants) |
| Handler side effects inside the confirm transaction slow it down | handlers write rows only; emails/notifications via outbox |
| Job keys drift from the docs | keys are identical in docs/06 §3.3, docs/12 §2.3, docs/09 §5.3 and docs/10 §6; P9.4 registry test |
| License-key email policy | link only (no key) by default per FR-DEL-07; plaintext only if the founder relaxes it (I-004) behind a settings flag |

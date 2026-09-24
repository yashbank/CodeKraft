# PHASES 10–14 — V1.1

**Entry gate:** `docs/13` §4.1 (V-01…V-04): `v1.0.0` live ≥ 7 days without a P1 incident; KYC status known; SMS/WhatsApp/VPS decisions recorded; Theme 2 palette approved. Each item ships as its own tag behind its flag (docs/13 §4.2), enabled staging-first. Ownership map: master plan §3 with the P1–P9 additions from `implementation/reviews/P9-review.md`; V1.1 tasks may edit the paths named below only. Every task keeps the P1–P9 rules: `defineAction` + audit, contract freeze (changes need an ADR), tests in the same PR, PROGRESS row, CI green.

---

## PHASE-10 — Razorpay provider (`v1.1.0`, flag `provider_razorpay`)

### Phase objective
Automate Indian payments through the `PaymentProvider` abstraction: `RazorpayProvider` (`createIntent` returning a `client_sdk` instruction set, `handleWebhook` with signature verification, `confirm` from the captured event with gateway fee, `refund` for chargeback reconciliation only), the webhook route with `webhook_events` idempotency, `gateway_fee` ledger lines from settlement payloads, UPI AutoPay (mandate) groundwork for V2 recurring billing, legal refund wording update (R-502). Nothing changes in `orders`, `finance`, `invoices`, `entitlements` (docs/06 §4.3).

### Prerequisites
P9 done; Razorpay sandbox account; env `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in staging; KYC (R-102) for production go-live (code ships dark).

### Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P10.1 | `RazorpayProvider` adapter + registry gating | domain-critical | — |
| P10.2 | Webhook route + `webhook_events` idempotency + `payments.confirm` from webhook | domain-critical | P10.1 |
| P10.3 | Gateway fees in ledger, settlement reconciliation job, refund/chargeback path | domain-critical | P10.2 |
| P10.4 | Checkout + admin UI for gateway method; legal refund page wording | UI builder | P10.1 |
| P10.5 | Staging sandbox e2e, flag rollout per product, CFO reconciliation | reviewer | all |

#### P10.1 `RazorpayProvider` adapter + registry gating
- Owner profile: domain-critical
- Requirement IDs: FR-PAY-01, FR-PAY-02, A-402, D-501, D-110, API-CAT-05, docs/06 §4.1, §4.3, docs/09 §6.2, docs/13 §4.2 item 1
- Description: `src/modules/payments/providers/razorpay.ts` implementing `PaymentProvider` (`keys: ['razorpay']`): `createIntent` creates a Razorpay order (amount in paise, `receipt = orderNo`, notes with order id) and returns `{ kind: 'client_sdk', keyId, razorpayOrderId, amount, currency, prefill }`; `confirm` reads captured amount + fee from the verified event (`bankShortfall = 0`); `refund` calls the API (policy keeps customer refunds manual — D-505 — so this exists for chargeback reconciliation only). Registry registers the key only when `provider_razorpay` is on; API-CAT-05 accepts `razorpay` for offerings when the flag and settings allow.
- Owned paths: `src/modules/payments/providers/razorpay.ts`, `src/modules/payments/providers/registry.ts`, `src/lib/env.ts` (three variables). Forbidden: `orders/**`, `finance/**`, `invoices/**`, `entitlements/**`.
- Dependencies: none.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/payments/razorpay-provider.test.ts` (SDK mocked: order creation payload, confirm mapping, fee extraction, flag-off registry absence); static test extended: provider key appears only under `modules/payments`.
- Acceptance criteria:
  - [ ] provider satisfies the frozen interface (contract-freeze unchanged)
  - [ ] with the flag off nothing about Razorpay is reachable (registry, offerings, webhook route 404)
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: Razorpay SDK types → thin typed wrapper; secrets scoped per env.

#### P10.2 Webhook route + idempotency + confirm from webhook
- Owner profile: domain-critical
- Requirement IDs: FR-PAY-06 (same path), docs/06 §1.5 (webhook idempotency), §3.4 (`/api/webhooks/razorpay`), docs/05 §11 `webhook_events`, docs/09 §6.2, SA-09 (immutability still holds)
- Description: `POST /api/webhooks/razorpay`: registered only when the flag is on; verifies the HMAC signature with `RAZORPAY_WEBHOOK_SECRET`; `webhook_events(provider, event_id)` unique insert (duplicate → 200 no-op); maps `payment.captured` → `payments.confirmPayment` with actor `webhook:razorpay`, `amountReceived = captured`, `gatewayFeeMinor` from payload, `reference = razorpay payment id`; `payment.failed` → `failPayment`; returns 200 within 5 s — invoice PDF rendering deferred to the `frequent` job (`invoices.regenerate_pending`). Audit actor `webhook:razorpay`.
- Owned paths: `src/app/api/webhooks/razorpay/**`, `src/modules/payments/webhooks.ts`. Forbidden: `payments/confirm.ts` internals (call only).
- Dependencies: P10.1.
- Expected files/modules: as listed.
- Tests required: integration `tests/integration/api/webhooks/razorpay/{signature-invalid-401,captured-confirms-once,replay-no-op,failed-marks-failed,flag-off-404,invoice-deferred}.test.ts`.
- Acceptance criteria:
  - [ ] replayed event is a no-op (`webhook_events` unique)
  - [ ] confirm path identical to admin confirmation (ledger, entitlements, audit)
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: out-of-order events → state machine guards (`STATE_INVALID` logged, not retried).

#### P10.3 Gateway fees in ledger, settlement reconciliation, chargeback path
- Owner profile: domain-critical
- Requirement IDs: FR-FIN-01 (`gateway_fee`), FR-FIN-05 (fees never reversed), FR-PAY-14, D-416, FI-01, FI-04, docs/13 §4.2a item 1
- Description: `gateway_fee` entries populated from `gatewayFeeMinor` (formula unchanged: fee reduces distributable); `src/jobs/razorpay-settlements.ts` (`daily`): fetch settlements, compare fee totals per payment with posted `gateway_fee` entries, propose `ledger.adjustment` requests for differences (never auto-post); chargeback webhook (`payment.dispute.*`) → `flagChargeback` (revoke + tag) and an adjustment proposal. Property tests extended with non-zero gateway fees (FI-01/FI-04 already parameterise fees).
- Owned paths: `src/jobs/razorpay-settlements.ts`, `src/modules/payments/chargeback.ts`, `tests/property/finance.spec.ts` (fee arbitrary range). Forbidden: `finance/allocation.ts` (frozen formula).
- Dependencies: P10.2.
- Expected files/modules: as listed.
- Tests required: property runs with fees; integration `tests/integration/finance/gateway-fee-posting.test.ts`, `tests/integration/jobs/razorpay-settlements.test.ts` (mismatch → adjustment request, no direct ledger write).
- Acceptance criteria:
  - [ ] fee reduces distributable exactly; never reversed on refund
  - [ ] settlement mismatch produces an approval request, not a ledger write
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: settlement API pagination/time zones → job idempotent by settlement id.

#### P10.4 Checkout + admin UI for the gateway method; legal wording
- Owner profile: UI builder
- Requirement IDs: FR-PAY-02, FR-PAY-12 (gateway refunds unavailable message), R-502, SCR-ACC-10, SCR-ACC-11, SCR-ADM-07, SCR-ADM-29 (payment-methods tab), SCR-SITE-10, docs/13 §4.2a item 1
- Description: Checkout renders the Razorpay client SDK flow when the method is enabled (script origin added to CSP `script-src`/`frame-src`/`connect-src` — P9.1 owner reviews); order status shows gateway payment state; admin order detail shows gateway reference/fee and hides manual confirm for gateway payments; settings payment-methods tab enables `razorpay` when the flag is on and keys are configured; refund proposal refuses gateway payments with the D-505 message; `/legal/refunds` copy updated through the content editor (seed + content) to state gateway-payment refund terms (R-502).
- Owned paths: `src/components/account/PaymentPanel.tsx`, `src/components/admin/orders/**` (gateway section), `src/components/admin/settings/payment-methods*.tsx`, `middleware.ts` CSP allow-list (reviewed), `scripts/seed/data/legal.ts`. Forbidden: `src/modules/**`.
- Dependencies: P10.1.
- Expected files/modules: as listed.
- Tests required: e2e `tests/e2e/scenarios/S-24.razorpay-sandbox.spec.ts` (staging only, `@gateway` tag: checkout → sandbox payment → webhook → paid → invoice; refund proposal refused with message), axe on changed screens.
- Acceptance criteria:
  - [ ] gateway checkout works in the staging sandbox end to end
  - [ ] refund page states the gateway policy; refund proposal on gateway payment refused
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: CSP breakage → staged report-only on staging first.

#### P10.5 Staging sandbox e2e, rollout per product, CFO reconciliation
- Owner profile: reviewer
- Requirement IDs: docs/13 §4.2a item 1 (done-when), §4.3
- Description: Run S-24 on staging with sandbox keys, replay webhook to prove idempotency, verify `gateway_fee` entries against the sandbox dashboard, enable the flag in production for one product (D-110 per offering), reconcile the first live order with the CFO (statement vs ledger), write `implementation/reviews/P10-review.md`, tag `v1.1.0`.
- Owned paths: `implementation/reviews/P10-review.md`, `CHANGELOG.md [1.1.0]`. Forbidden: `src/**`.
- Dependencies: P10.1–P10.4.
- Acceptance criteria:
  - [ ] sandbox order paid via webhook in staging; replay idempotent
  - [ ] flag on for ≥ 1 production product; first live order reconciled by the CFO
- Definition of Done: review + changelog + tag + PROGRESS statuses.
- Potential risks and mitigations: KYC delay → code stays dark in production behind the flag.

### Parallelisation map
`P10.1 → P10.2 → P10.3`, with `P10.4` after `P10.1` in parallel with `P10.2/P10.3`; `P10.5` last. Only one agent writes `modules/payments/`.

### Phase Definition of Done / risks
`v1.1.0` tagged; docs/13 §4.2a item 1 "done when" satisfied; contract freeze unchanged; risk: refund policy vs card-network rules (R-502) mitigated by the legal update shipping in the same tag.

---

## PHASE-11 — Theme 2 light-editorial enablement (`v1.1.1`, flag `theme_light_editorial`)

### Phase objective
Enable the second design system that shipped as tokens in P1.2: visitor toggle and admin default option visible, Theme 2 posters/imagery/OG variants, and QA of every screen in `ui/screens/**` in Theme 2 (axe, visual baselines, LHCI unchanged within 3 points). No component may branch on theme name (grep lint).

### Prerequisites
P9 done; Theme 2 palette/fonts approved (V-04); `ui/theme-02/light-editorial.md` final; Theme 2 hero poster and OG imagery from the founders.

### Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P11.1 | Token sheet final pass + theme-name lint rule + contrast tests for Theme 2 | UI builder | — |
| P11.2 | Theme 2 assets: hero poster, OG template variant, email/PDF unaffected check | UI builder | P11.1 |
| P11.3 | Screen-by-screen QA in Theme 2 (all 61 screens), fixes via token changes only | UI builder | P11.2 |
| P11.4 | Enable flag staging → production, visual baselines for both themes, tag | reviewer | P11.3 |

#### P11.1 Token sheet final pass + lint + contrast
- Requirement IDs: NFR-THEME-01, FR-A11Y-01, D-011, D-902, D-903, docs/08 §5, §10, §15, docs/13 §4.2a item 2
- Description: Reconcile `src/styles/themes/light-editorial.css` with the approved sheet; `eslint-rules/no-theme-branching.js` (fails on `data-theme`/`light-editorial`/`dark-cinematic` string checks in `src/components/**` and `src/app/**` except the toggle and layout resolver); extend `tests/unit/tokens.test.ts` contrast checks to every Theme 2 pair.
- Owned paths: `src/styles/themes/light-editorial.css`, `eslint-rules/no-theme-branching.js`, `tests/unit/tokens.test.ts`.
- Tests required: tokens test; lint rule fixtures.
- Acceptance criteria: [ ] parity + contrast green; [ ] lint rule finds zero violations.
- Definition of Done: code + tests + PROGRESS row + CI green.

#### P11.2 Theme 2 assets
- Requirement IDs: docs/08 §10 (poster swap + preload), §12, docs/11 §B6 (poster sizes), FR-SEO-05
- Description: `public/hero/hero-poster-light.{avif,webp}` within size limits; inline head script preloads the poster of the active theme (already specified in P7.1, verified here); OG route renders with Theme 2 tokens when the page theme is light (query param from the toggle cookie is not available on OG — use admin default); confirm emails/PDFs stay ink-on-white.
- Owned paths: `public/hero/**`, `src/app/api/og/**` (token variant), `src/components/three/HeroPoster.tsx`.
- Tests required: `tests/integration/three-assets.test.ts` (both posters), OG snapshot in both token sets, e2e poster swap on toggle.
- Acceptance criteria: [ ] poster swaps with the theme without layout shift; [ ] sizes within docs/11 §B6.
- Definition of Done: assets + tests + PROGRESS row + CI green.

#### P11.3 Screen-by-screen QA in Theme 2
- Requirement IDs: NFR-A11Y-01, NFR-THEME-01, docs/10 §8 ("both themes"), docs/13 §4.2a item 2
- Description: Run the full axe suite and the visual baseline capture with `data-theme="light-editorial"` forced on every route of `ui/sitemap.md` (site, auth, account, admin); fix findings only by editing token values or adding semantic tokens (never component branches); LHCI on the eight URLs in Theme 2 must stay within 3 points of Theme 1.
- Owned paths: `src/styles/**`, `tests/e2e/a11y/**` (theme matrix), `tests/e2e/visual/**`, `lighthouserc.json` (theme cookie run).
- Tests required: axe both themes all routes; LHCI Theme 2 run; visual baselines.
- Acceptance criteria: [ ] zero serious/critical axe in Theme 2 on all routes; [ ] LHCI delta ≤ 3 points; [ ] no component edits in the fix PRs (review).
- Definition of Done: fixes + baselines + PROGRESS row + CI green.

#### P11.4 Enable flag, baselines, tag
- Requirement IDs: D-905, D-1602, FR-OPS-03, S-16, docs/13 §4.2a item 2
- Description: Flag on in staging → S-16 with flag on/off → production flag on via settings (audited); admin default-theme option available; visual job becomes blocking for both themes (docs/10 §1 "blocking once Theme 2 lands"); `implementation/reviews/P11-review.md`; tag `v1.1.1`.
- Owned paths: `.github/workflows/ci.yml` (visual job blocking), `implementation/reviews/P11-review.md`, `CHANGELOG.md`.
- Acceptance criteria: [ ] S-16 green with the flag on in staging and production; [ ] visual job blocking.
- Definition of Done: review + changelog + tag + PROGRESS statuses.

### Parallelisation map
Sequential (single UI builder); P11.3 may be split by app (site/account vs admin) across two builders on disjoint test folders; token edits go through one owner.

### Phase Definition of Done / risks
`v1.1.1` tagged; every screen passes in both themes; risk: QA surface doubles → token-only fixes and the lint rule keep the fix cost linear.

---

## PHASE-12 — Phone OTP login + WhatsApp channel (`v1.1.5`, `v1.1.7`; flags `phone_otp`, `whatsapp_channel`)

### Phase objective
Ship the two flagged channels whose UI and interfaces exist since Release 1: an SMS provider adapter for Better Auth's phone-number plugin with per-phone/per-IP limits, and a WhatsApp notification channel adapter with customer opt-in, approved templates and a cost widget.

### Prerequisites
P9 done; founder decisions V-03 (SMS budget R-1201, WhatsApp cost R-1001); provider contracts; env `SMS_PROVIDER_*`, `WHATSAPP_*`; Meta Business verification (needs the legal entity) for WhatsApp; privacy policy update naming the providers.

### Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P12.1 | SMS provider adapter (`SmsProvider` interface + first vendor) + OTP rate limits + daily platform cap | domain-critical | — |
| P12.2 | Phone OTP enablement: Better Auth phone plugin config, `/auth/otp` live, account linking, audit, privacy copy | domain-standard | P12.1 |
| P12.3 | WhatsApp channel adapter: `NotificationChannel` impl, opt-in on `customer_profiles.notification_prefs`, template registry, cost widget | domain-standard | — |
| P12.4 | Staging e2e with real providers, flags on, tags | reviewer | P12.2, P12.3 |

#### P12.1 SMS provider adapter + limits
- Requirement IDs: FR-AUTH-11, NFR-SEC-03 (OTP), FR-SEC-01, D-1603, docs/09 §7 (OTP rows), docs/13 §4.2 item 5
- Description: `src/modules/auth/sms/{types,provider-<vendor>,fake}.ts` (`SmsProvider.send(phone, text)`), selected by env; limits per NFR-SEC-03 / docs/06 §1.7 / docs/09 §7: `otp` 5/h per phone, 10/h per IP, platform daily cap 200 SMS (settings), all through `lib/rate-limit`; OTP 6 digits, 5 min, 5 attempts.
- Owned paths: `src/modules/auth/sms/**`, `src/lib/env.ts` (vars), `src/modules/settings` (cap key).
- Tests required: unit adapter mapping; integration limits (`@security` SA-15 OTP rows).
- Acceptance criteria: [ ] limits enforced; [ ] fake provider in CI; [ ] cap stops sends with an admin notification.
- Definition of Done: code + tests + PROGRESS row + CI green.

#### P12.2 Phone OTP enablement
- Requirement IDs: FR-AUTH-11, FR-AUTH-03 (linking analogue), FR-AUTH-13, SCR-AUTH-05, API-AUTH-01 (phone flows), docs/13 §4.2a item 5
- Description: Register the Better Auth phone-number plugin when the flag is on; `/auth/otp` screen (already built, P7.8) goes live; link phone to an existing verified account; audit `auth.phone_*`; privacy policy names the SMS provider (content edit); S-25 e2e "register/login by OTP" with the fake provider in CI and the real one on staging.
- Owned paths: `src/modules/auth/config.ts` (plugin block), `src/app/(auth)/otp/**` (polish), `tests/e2e/scenarios/S-25.phone-otp.spec.ts`, seed legal copy.
- Tests required: S-25; SA-15 OTP; audit rows.
- Acceptance criteria: [ ] OTP login e2e in staging with the real provider; [ ] flag off → 404 unchanged.
- Definition of Done: code + tests + PROGRESS row + CI green.

#### P12.3 WhatsApp channel adapter
- Requirement IDs: FR-NOTIF-06, D-1604, API-NOTIF-04 (prefs), docs/13 §4.2a item 7, NFR-OPS-02 analogue (cost)
- Description: `src/modules/notifications/channels/whatsapp.ts` implementing `NotificationChannel` via the Meta Cloud API; opt-in stored in `notification_prefs.whatsapp` (customer settings UI); template registry mapping only the customer notification types the customer selected to approved Meta templates; sends only when the flag is on and the template is approved; `whatsapp_usage` widget (conversations/month, cost estimate) added to the widget registry (21st widget, additive).
- Owned paths: `src/modules/notifications/channels/whatsapp.ts`, `src/modules/notifications/templates/whatsapp/**`, `src/components/account/NotificationPrefs.tsx` (opt-in), `src/modules/dashboard-widgets/loaders/whatsapp_usage.ts`, `src/components/admin/widgets/WhatsappUsage.tsx`.
- Tests required: unit channel mapping (no send without opt-in/approval/flag); integration fan-out includes WhatsApp only when opted in.
- Acceptance criteria: [ ] no message without explicit opt-in; [ ] widget shows usage; [ ] flag off → channel inert.
- Definition of Done: code + tests + PROGRESS row + CI green.

#### P12.4 Staging verification, flags, tags
- Description: real-provider runs on staging (OTP, one WhatsApp template), limits verified, privacy policy live, flags on where the founders accepted the cost; `implementation/reviews/P12-review.md`; tags `v1.1.5` (OTP) and `v1.1.7` (WhatsApp) per docs/13.
- Acceptance criteria: [ ] docs/13 §4.2a items 5 and 7 "done when" satisfied for the items the founders enabled.
- Definition of Done: review + changelog + tags + PROGRESS statuses.

### Parallelisation map
`P12.1 → P12.2` and `P12.3` in parallel (auth vs notifications directories); `P12.4` last. WhatsApp may be skipped entirely if cost is rejected (D-1604) — the flag stays off and P12.3/P12.4-WhatsApp are marked `cancelled` in PROGRESS.

---

## PHASE-13 — Purchased hosting migration (`v1.1.2`)

### Phase objective
Move compute from Vercel Hobby to a VPS running the P9.9 container stack (app + scheduler + Caddy) with zero data migration (Neon, R2, Resend, Sentry, Umami unchanged), following docs/12 §9.4 steps 1–9, removing R-1401 and the Hobby limits.

### Prerequisites
P9 done; domain live on Cloudflare (E-06); VPS provider chosen (V-03); GHCR image from `release.yml`; `docs/ops/rollback.md`; both founders available for the cutover window.

### Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P13.1 | VPS provisioning runbook + hardening (ufw, deploy user, Docker, `.env` mode 600, log rotation) | domain-critical | — |
| P13.2 | Staging stack on the VPS (`staging.<domain>` compose), smoke checklist via `--resolve`, scheduler tick verified | domain-critical | P13.1 |
| P13.3 | Production cutover per docs/12 §9.4 (freeze, crons off, DNS flip, scheduler on, 48 h Vercel fallback) | domain-critical | P13.2 |
| P13.4 | Post-cutover: `DEPLOY_TARGET=vps` in `release.yml`, Vercel production project removed, runbook 11.2 updated, restore drill from the new path, tag | reviewer | P13.3 |

#### P13.1 VPS provisioning + hardening
- Requirement IDs: FR-OPS-02, NFR-PORT-01, D-1401, D-1606, docs/12 §9.1, §9.3, §8.2 (Docker logs)
- Description: `docs/ops/vps-provisioning.md` + `scripts/ops/vps-bootstrap.sh` (Ubuntu 24.04, `ufw` 22/80/443, deploy user, Docker + compose plugin, `docker login ghcr.io`, `/srv/codekraft/{.env,docker-compose.prod.yml,Caddyfile,deploy.sh}`, json-file log rotation 50m×5, unattended-upgrades).
- Owned paths: `docs/ops/vps-provisioning.md`, `scripts/ops/vps-bootstrap.sh`.
- Tests required: bootstrap script lint (`shellcheck`); dry run on a throwaway VM recorded.
- Acceptance criteria: [ ] a fresh VM reaches "compose up" in one script run; [ ] `.env` never leaves the password manager except by the founder.
- Definition of Done: docs + script + PROGRESS row.

#### P13.2 Staging stack on the VPS
- Requirement IDs: docs/12 §9.2, §9.3, §9.5, FR-OPS-01 (scheduler), NFR-AVAIL-01
- Description: Second compose stack `staging.<domain>` (own `.env`, Neon staging, staging buckets), Caddy staging issuer to avoid Let's Encrypt limits, run docs/12 §9.5 checklist 1–15 with `--resolve`, verify `job_runs` gets `frequent` rows from the scheduler container, image-optimizer cache volume, ISR cache on disk.
- Owned paths: `docker-compose.staging.yml`, `Caddyfile` (staging block), `docs/ops/launch-log.md` (VPS section).
- Tests required: `@smoke` Playwright against the VPS staging host; scheduler tick assertion.
- Acceptance criteria: [ ] checklist 1–15 green on the VPS staging host; [ ] scheduler ticks every 15 min.
- Definition of Done: stack + evidence + PROGRESS row.

#### P13.3 Production cutover
- Requirement IDs: docs/12 §9.4 steps 1–9, §10 (rollback), MASTER_SPEC §7 "Admin host during interim" (ends), R-1401
- Description: TTL 300 s 24 h before; freeze window announced (no admin mutations); delete Vercel crons and disable `scheduler.yml` before the flip (no double runs — email digests would duplicate); `deploy.sh <current tag>` with `RUN_SCHEDULER=false`; flip A/AAAA for `@`, `www`, `admin` with Cloudflare proxy off until ACME completes; `RUN_SCHEDULER=true` + `docker compose up -d scheduler`; smoke checklist on live hostnames; `job_runs` shows a `frequent` row within 15 min; Vercel kept 48 h as rollback; `ops.rollback` audit action ready.
- Owned paths: `docs/ops/launch-log.md` (cutover section), `.github/workflows/scheduler.yml` (disabled), `vercel.json` (crons removed).
- Tests required: `smoke-production` (S-00) on the VPS host; Playwright `@smoke`.
- Acceptance criteria: [ ] DNS flipped with < 30 min freeze; [ ] S-00 green; [ ] no duplicate digest emails that day (outbox check).
- Definition of Done: cutover log + PROGRESS row.

#### P13.4 Post-cutover
- Requirement IDs: docs/12 §9.4 step 9, §11.2, §5.3 (restore drill), docs/13 §4.2a item 3
- Description: `DEPLOY_TARGET=vps` in the `production` GitHub Environment so `release.yml` deploys over SSH (`appleboy/ssh-action` → `deploy.sh <tag>`); remove the Vercel production project (keep or move staging); runbook 11.2 updated to container commands; one restore drill executed from the new deploy path; `implementation/reviews/P13-review.md`; tag `v1.1.2`.
- Owned paths: `.github/workflows/release.yml` (deploy step), `docs/12` runbook edits, `docs/ops/restore-log.md`, `implementation/reviews/P13-review.md`.
- Acceptance criteria: [ ] a subsequent `v1.1.x` tag deploys to the VPS via `release.yml`; [ ] restore drill logged; [ ] Vercel production project removed.
- Definition of Done: review + changelog + tag + PROGRESS statuses.

### Parallelisation map
Strictly sequential; one domain-critical agent plus a founder for DNS and approvals.

### Phase Definition of Done / risks
docs/13 §4.2a item 3 satisfied; risk: cutover downtime/cert issues → 48-h Vercel fallback, TTL 300 s, staging issuer rehearsal.

---

## PHASE-14 — Stripe/PayPal providers + bundles (`v1.1.3`, `v1.1.4`, `v1.1.6`; flags `provider_stripe`, `provider_paypal`, `bundles`)

### Phase objective
Reuse the P10 gateway pattern for international buyers (Stripe, then PayPal) and add bundle offerings (a product set with a bundle price allocated per contained item by its own ownership, BR-05/BR-06 per item), with the charging-currency decision recorded before Stripe ships.

### Prerequisites
P10 live; legal entity + international KYC (R-102); founder decision on charging in display currency vs base (D-502/R-106) recorded in the decision log; D-1504 foreign-tax statement reviewed; `bundles` flag exists (docs/13 §6).

### Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P14.1 | `StripeProvider` + webhook + fees + UI (pattern of P10.1–P10.4) | domain-critical | — |
| P14.2 | `PayPalProvider` + webhook + fees + UI | domain-critical | P14.1 |
| P14.3 | Bundles schema + catalog: `product_bundles`, bundle offering type, admin editor tab, public bundle card/detail | domain-critical + UI builder | — |
| P14.4 | Bundle checkout + allocation: multi-item order from a bundle, discount pro-rated by list price, per-item ownership allocation, BR-10 per contained one-time offering, property tests extended | domain-critical | P14.3 |
| P14.5 | Staging verification, flags, tags | reviewer | all |

#### P14.1 `StripeProvider`
- Requirement IDs: FR-PAY-01, FR-PAY-02, D-502 (decision), D-1504, docs/06 §4.3, docs/13 §4.2 item 4, §4.2a item 4
- Description: `providers/stripe.ts` (`createIntent` → PaymentIntent with `client_sdk` instructions in the charging currency per the recorded decision; `handleWebhook` with signature; `confirm` from `payment_intent.succeeded` with balance-transaction fee; `refund` for reconciliation), `/api/webhooks/stripe`, settlement job, checkout/admin/settings UI additions, legal wording review; FX: if charging in a non-base currency is chosen, `orders.currency` may differ from base and `fx_rate_to_inr` semantics are unchanged (rate at payment date) — allocation formula untouched.
- Owned paths: `src/modules/payments/providers/stripe.ts`, `src/app/api/webhooks/stripe/**`, `src/jobs/stripe-settlements.ts`, UI files as in P10.4, `middleware.ts` CSP allow-list (reviewed).
- Tests required: as P10.1–P10.3 for Stripe; S-26 sandbox e2e on staging; property tests with foreign currency + fee.
- Acceptance criteria: [ ] sandbox order paid via webhook; [ ] fees posted; [ ] charging-currency decision recorded and reflected in tests.
- Definition of Done: code + tests + PROGRESS row + CI green; tag `v1.1.3`.

#### P14.2 `PayPalProvider`
- Requirement IDs: as P14.1, docs/13 §4.2 item 4
- Description: same pattern with PayPal Orders API + webhooks (`CHECKOUT.ORDER.APPROVED`/`PAYMENT.CAPTURE.COMPLETED`), fee from capture breakdown.
- Owned paths: `src/modules/payments/providers/paypal.ts`, `src/app/api/webhooks/paypal/**`, `src/jobs/paypal-settlements.ts`, UI additions.
- Tests required: as P14.1; S-27 sandbox e2e.
- Acceptance criteria: [ ] sandbox order paid; [ ] fees posted; [ ] flag off → nothing reachable.
- Definition of Done: code + tests + PROGRESS row + CI green; tag `v1.1.4`.

#### P14.3 Bundles schema + catalog
- Requirement IDs: D-417, ADR-12 (multi-item order schema), FR-CAT-04 (offering config), docs/13 §4.2 item 6, MASTER_SPEC §4.11 (`bundles` flag)
- Description: Migration `product_bundles(id, product_id (the bundle product), name, status)` + `product_bundle_items(bundle_id, offering_id, position, list_price_snapshot_minor)`; `purchase_model` gains `bundle` (append-only enum) on an offering of the bundle product; catalog service/queries expose bundle contents; admin editor tab "Bundle" (pick contained offerings, bundle price per currency); public product card/detail show "Includes N products" and the contents; all behind the `bundles` flag.
- Owned paths: `drizzle/00NN_p14-3_bundles.sql`, `src/modules/catalog/bundles.ts`, `src/modules/offerings/**` (bundle validation), `src/components/admin/catalog/editor/BundleTab.tsx`, `src/components/site/BundleContents.tsx`.
- Tests required: migration/trigger tests; integration bundle CRUD; e2e editor + public page with flag on/off.
- Acceptance criteria: [ ] bundle offering saved only with ≥ 2 contained offerings, each with a base price; [ ] flag off hides everything.
- Definition of Done: code + migration + tests + PROGRESS row + CI green.

#### P14.4 Bundle checkout + allocation
- Requirement IDs: BR-05, BR-06, BR-10, FR-COM-01 (multi-item exception), FR-FIN-01..03, FI-01, FI-02, FI-04, FI-10, docs/13 §4.2a item 6
- Description: `createOrder` for a bundle offering creates one order with N items (one per contained offering) whose unit prices are the list-price snapshots and whose discount = bundle discount pro-rated by list price (largest-remainder); BR-10 applied per contained one-time offering (`DUPLICATE_PURCHASE` names the item); `postOrderPaid` allocates each item by its own product's active ownership (unchanged formula); entitlements per item; property tests extended with multi-item bundle orders; checkout/order UI lists the items.
- Owned paths: `src/modules/orders/bundles.ts`, `src/modules/coupons` (bundle interaction rule: coupons apply after bundle discount), `tests/property/finance.spec.ts` (bundle arbitrary), `src/components/account/{BillingForm,OrderTimeline}.tsx` (items list).
- Tests required: property suite extended; integration `bundle-order-allocation`, `bundle-duplicate-item`; e2e S-28 bundle purchase.
- Acceptance criteria: [ ] Σ item discounts = bundle discount exactly; [ ] each item allocated by its own ownership (FI-10 per item); [ ] duplicate contained one-time offering refused.
- Definition of Done: code + tests + PROGRESS row + CI green; tag `v1.1.6`.

#### P14.5 Verification, flags, tags
- Description: staging sandbox runs for Stripe and PayPal, bundle e2e, flags on per founder decision, `implementation/reviews/P14-review.md`, changelog entries.
- Acceptance criteria: [ ] docs/13 §4.2a items 4 and 6 satisfied.
- Definition of Done: review + changelog + tags + PROGRESS statuses.

### Parallelisation map
`P14.1 → P14.2` (one payments agent) in parallel with `P14.3 → P14.4` (one catalog/finance agent; P14.4 touches `orders/` and the property suite — coordinate with the payments agent who does not write there); `P14.5` last.

### Phase Definition of Done / risks
Tags `v1.1.3`, `v1.1.4`, `v1.1.6`; contract freeze unchanged except ADR-recorded additive enum `purchase_model = bundle`; risks: charging-currency decision changes ledger FX assumptions (keep base-currency charging until decided; Stripe can present INR), bundle allocation correctness (property tests before flag on).

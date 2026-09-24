# PHASE-09 — Hardening, performance, launch

**Wave:** W5 (solo lead + 2 reviewers) · **Roadmap items:** R1-09 (budget verification), R1-24, R1-25, R1-26 · **Master plan §6 gate:** full suite + security checklist + founder checklist generated + production smoke. **Roadmap exit criteria:** X-01…X-10.

## Phase objective

Turn the feature-complete build into `v1.0.0`: enforce security headers and nonce-based CSP on both hosts, rate limits on every surface, Turnstile on every public form, the consolidated `frequent`/`daily` cron endpoints with the container scheduler, the complete e2e suite S-00..S-23 on the full browser matrix, Lighthouse/axe/size gates as required checks, security acceptance SA-01..25, final seed and legal copy, all deployment workflows and Vercel projects (site + admin host), the founder-action checklist (domain, DNS, Resend, OAuth, Turnstile, Umami, Sentry, uptime), the production deploy with smoke tests and a restore drill, and the release entry in `CHANGELOG.md`.

## Prerequisites

- P7 and P8 done and green; all reviews P1–P8 committed.
- Founder actions from roadmap E-02, E-03, E-04, E-05, E-06, E-07 complete or scheduled (tracked in P9.10).
- Accounts and secrets available in Vercel (Production/Preview), GitHub Environments (`staging`, `production` with required reviewer) and the founders' password manager: every variable of docs/12 §2.2 including `CRON_SECRET`, `BACKUP_ENCRYPTION_KEY`, `VERCEL_*`, `NEON_*`, `RESEND_WEBHOOK_SECRET`, `SENTRY_AUTH_TOKEN`.
- Domain purchased and on Cloudflare DNS (E-06) — hard prerequisite for customer email (docs/12 Open #3).

## Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P9.1 | Security headers + nonce CSP on both hosts, CSP report endpoint | domain-critical | — |
| P9.2 | Rate limiting on every surface (`rate_limit_buckets`) | domain-critical | — |
| P9.3 | Turnstile wiring on every public form + login-after-3-failures | domain-standard | P9.2 |
| P9.4 | Cron endpoints `frequent`/`daily`, job registry, `scheduler.ts`, backups verify, audit export, jobs health | domain-critical | — |
| P9.5 | Full e2e suite S-00..S-23 on both hosts + full browser matrix | domain-standard | P9.1, P9.2, P9.3, P9.4 |
| P9.6 | LHCI, axe, size-limit as required checks; visual baselines; flaky policy | domain-standard | P9.5 |
| P9.7 | Security acceptance SA-01..25 audit + report | reviewer | P9.5 |
| P9.8 | Final seed, production seed, legal copy, founder assets | domain-standard | — |
| P9.9 | Deployment configs: Vercel projects, `vercel.json`, workflows (`preview-db`, `staging`, `release`, `scheduler`, `backup`, `lhci-weekly`), `docker-compose.prod.yml`, `Caddyfile`, `deploy.sh` | domain-critical | P9.4 |
| P9.10 | Founder-action checklist (domain/DNS/Resend/OAuth/Turnstile/Umami/Sentry/uptime) + `FOUNDER-CHECKLIST.md` generation | domain-standard | P9.9 |
| P9.11 | Production deploy `v1.0.0`, smoke, restore drill, monitoring verification | domain-critical | P9.5–P9.10 |
| P9.12 | `CHANGELOG.md` release entry, doc sync, final review | reviewer | P9.11 |

### P9.1 Security headers + nonce CSP, CSP report endpoint
- Owner profile: domain-critical
- Requirement IDs: NFR-SEC-07, FR-SEC-03 (HTTPS), FR-AUTH-08, SA-18, TM-21, TM-26, docs/09 §9 (header and CSP tables), docs/12 §9.2 (Caddy adds HSTS only), MASTER_SPEC §7 "Theme attribute on ISR pages"
- Description: `next.config.ts` `headers()` per docs/09 §9 for both hosts (HSTS `max-age=63072000; includeSubDomains; preload`, `X-Frame-Options DENY`, `nosniff`, `Referrer-Policy` site `strict-origin-when-cross-origin` / admin `no-referrer`, `Permissions-Policy`, `COOP same-origin-allow-popups`, admin `X-Robots-Tag`). `middleware.ts` (P1 owner; edited here by orchestrator rule) builds the per-request nonce and the CSP string: site `script-src 'self' 'nonce-…' 'strict-dynamic' challenges.cloudflare.com cloud.umami.is`, `img-src`/`media-src` with the media domain and R2 endpoint, `connect-src` incl. Sentry ingest, `frame-src` youtube-nocookie/vimeo/challenges, `worker-src 'self' blob:`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`; admin host drops `frame-src`/Umami. No `unsafe-eval`; `wasm-unsafe-eval` only if a library needs it, with a comment. ISR pages: the inline theme script is nonce'd when dynamic and hash-allow-listed when cached (engineering decision recorded in P1.7; P9.12 notes the wording of MASTER_SPEC §7 "Theme attribute on ISR pages"). `POST /api/csp-report` (rate-limited, sampled, Sentry breadcrumb). Staging runs `Content-Security-Policy-Report-Only` for one week (`APP_ENV=staging` + `CSP_ENFORCE=false`), production enforces.
- Owned paths: `next.config.ts` (headers block), `middleware.ts` (CSP block), `src/app/api/csp-report/**`, `src/lib/csp.ts`. Forbidden: everything else.
- Dependencies: none.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/lib/csp.test.ts` (directive builder per host; nonce present; no `unsafe-inline` for scripts); e2e `tests/e2e/security/headers.spec.ts` (`@security` SA-18: headers on `/`, `/products/<slug>`, `/account`, admin `/`; CSP enforced; inline theme script executes; Turnstile iframe loads; Umami absent on admin), `csp-report.spec.ts`.
- Acceptance criteria:
  - [ ] SA-18 passes on both hosts
  - [ ] no CSP violations in the e2e console log for any route (Playwright console listener)
  - [ ] admin host has no `frame-src` and no Umami origin
- Definition of Done: code + tests + staging report-only week logged + PROGRESS row + CI green.
- Potential risks and mitigations: third-party script breakage under strict CSP → report-only week on staging with violation review; PDF/3D workers → `worker-src blob:`.

### P9.2 Rate limiting on every surface
- Owner profile: domain-critical
- Requirement IDs: FR-SEC-01, NFR-SEC-03 (canonical values), FR-AUTH-02 (resend 3/h), SA-15, TM-06, TM-09, TM-17, TM-20, TM-25, docs/06 §1.7 (classes), docs/09 §7 (table — identical values), docs/05 §11 (`rate_limit_buckets`), docs/06 §1.4 (`RATE_LIMITED` + `retryAfterMs`)
- Description: Implement the `RateLimitStore` port from P1.4 on `rate_limit_buckets` (`key text pk (class:subject), count, window_start, expires_at` per docs/05 §11; fixed windows; in-memory store when `RUN_SCHEDULER` container mode is single-instance) and wire `rateLimit(class, subject, limit, window)` into every surface with the one canonical value set (NFR-SEC-03 = docs/06 §1.7 = docs/09 §7): `login` 10/15 min per IP and 5/15 min per account (15-min lock + email notice); `totp` 5/5 min per session attempt then session discarded; `signup` 5/h per IP; `verify_resend` 3/h per email; `reset` 3/h per email + 10/h per IP with silent success; `otp` (flagged) 5/h per phone + 10/h per IP; `public_form` 5/h per IP (+ Turnstile); `chat` 30 messages/10 min per user plus daily caps; `download` 20/h per user plus the per-entitlement cap; `key_reveal` 10/h per user; `checkout` 10/day per user; `coupon` 10/10 min per user; `quote_lookup` 10/h per IP; `upload` 30/h per user; `poll` 30/min per session; `admin` 300/min per user; `analytics` 120/min per anon/user; `cron` 1 concurrent per job. These are proposed values, tunable via `site_settings.rate_limits` (settings tab addition) — the founder may tune them (`ISSUES.md` I-005). Better Auth flows get limits via the route wrapper. Expired buckets are removed by `rateLimitStore.purgeExpired()`, which P9.4 runs as a step of the `daily` `retention.purge` job (docs/05 §11 "purged by `daily`"; no new job key).
- Owned paths: `src/lib/rate-limit.ts` (store impl), `src/modules/_ops/rate-limit-store.ts`, per-surface wiring lines in the owning modules' `actions.ts`/route files (single PR reviewed by module owners), `src/app/api/auth/[...all]/route.ts` (wrapper). Forbidden: business logic changes.
- Dependencies: none.
- Expected files/modules: as listed + `docs/ops/rate-limits.md` (effective table).
- Tests required: unit `tests/unit/lib/rate-limit-store.test.ts` (window rollover; concurrent increments); integration `tests/integration/security/rate-limits.test.ts` (`@security` SA-15 sampled: login 6th/15 min per account locks; signup 6th/h per IP; inquiry 6th/h per IP; chat 31st/10 min per user; download 21st/h per user; `retryAfterMs` set); e2e `tests/e2e/security/rate-limit.spec.ts` (S-14 step 3).
- Acceptance criteria:
  - [ ] every class in docs/06 §1.7 / docs/09 §7 returns `RATE_LIMITED` at its threshold (table-driven test from the NFR-SEC-03 list)
  - [ ] lock-out email notice on account lock
  - [ ] limits tunable without deploy
- Definition of Done: code + tests + ops doc + PROGRESS row + CI green.
- Potential risks and mitigations: PgBouncer transaction mode with `INSERT … ON CONFLICT` counters → single statement, no session state; false positives behind Cloudflare proxy → client IP from `CF-Connecting-IP`/`X-Forwarded-For` first hop only.

### P9.3 Turnstile wiring on every public form + login-after-3-failures
- Owner profile: domain-standard
- Requirement IDs: FR-SEC-02, FR-LEAD-02, D-1204, SA-16, TM-07, TM-25, docs/09 §7 (placement list), docs/04 §10 (fail-closed)
- Description: Ensure `lib/turnstile.verify` (P6.3) is enforced with action binding on: inquiry form, contact page, product "Request customisation" CTA, guest query form, signup, password-reset request, and login after 3 failures per IP (dynamic widget injection); not on chatbot/account/admin forms. Fail-closed with a visible error and Sentry breadcrumb; test keys in non-production; `turnstile_verified` recorded on leads. Server binds the token to the form action name.
- Owned paths: wiring lines in `src/app/(site)/contact`, `src/components/site/{InquiryForm,CustomisationCta,TurnstileWidget}.tsx`, `src/app/(auth)/{register,reset,login}` and their actions (single PR), `src/lib/turnstile.ts` (action binding). Forbidden: new forms.
- Dependencies: P9.2.
- Expected files/modules: as listed.
- Tests required: integration `tests/integration/security/turnstile.test.ts` (`@security` SA-16: each listed form rejects a missing/invalid token; action mismatch rejected); e2e `tests/e2e/security/turnstile.spec.ts` (login shows widget after 3 failures).
- Acceptance criteria:
  - [ ] all seven placements verified server-side with action binding
  - [ ] SA-16 green; no Turnstile on chatbot/admin forms
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: Turnstile outage → fail-closed message; runbook note in docs/12 §11.

### P9.4 Cron endpoints, job registry, scheduler, backups verify, audit export, jobs health
- Owner profile: domain-critical
- Requirement IDs: FR-OPS-01, FR-OPS-02, NFR-AVAIL-01, NFR-DATA-02 (verify), NFR-DATA-04 (reconciliation), FR-LEAD-09 (auto-close), SA-17, TM-09, docs/04 §4 (jobs), §11, docs/06 §3.3, docs/09 §5.3, docs/12 §2.3 (endpoint table), §5.3 (`backups.verify`), §8.1 (jobs signal), §9.3, MASTER_SPEC §7 "Cron on free tier"
- Description: `src/jobs/registry.ts` mapping every job key of docs/06 §3.3 (identical to docs/12 §2.3) to its endpoint and implementation, in the documented order. `GET /api/cron/frequent` (every 15 min): `publish.scheduled` (P3.9 `jobs/publish.ts`), `orders.expire` (P4.2 `jobs/order-expiry.ts`), `quotes.expire` (P4.6 `jobs/quote-expiry.ts`), `email.outbox_retry` (P6.1 `jobs/email-outbox.ts`), `invoices.regenerate_pending` (P4.5 `invoices.regeneratePending`), `retention.purge_tokens` (P5.7 `jobs/retention.ts`). `GET /api/cron/daily` (03:00 IST): `subscriptions.remind_grace_suspend` and `entitlements.expire` (P5.7 `jobs/subscriptions.ts`), `fx.refresh` (P3.12 `jobs/fx.ts`), `knowledge.reindex` (P3.13 `jobs/knowledge.ts`), `retention.purge` (P6.6 `jobs/chat-purge.ts` + P9.2 `rateLimitStore.purgeExpired()` as a second step of the same key), `users.anonymise` (P5.7 `jobs/retention.ts`, safety sweep), `admin.overdue_digest` (P6.4 `jobs/lead-digest.ts`), `vitals.rollup` (P6.8 `analytics.rollup`), `backups.verify` (this task: yesterday's dump exists in `codekraft-backups`, size > 100 KB, else `N: system.job_failed`), `audit.export` (this task, Sundays: P3.1 `audit.exportForRetention` + ledger CSV from P4.11 to R2 `exports/`, docs/09 §5.3), `health.jobs_check` (this task: each job's expected interval; last `ok` older than 2× → `N: system.job_failed` to super admins, System widget red). Two services the SRS requires but the job table does not yet name are also run from `daily` and flagged for P9.12's doc correction to docs/06 §3.3 / docs/12 §2.3: `finance.reconcile` (P4.12, NFR-DATA-04) and `queries.autoclose` (P6.5, FR-LEAD-09). No materialized-view refresh exists (`partner_balances` and `customer_credits` are plain views). `GET /api/cron/frequent|daily`: `Authorization: Bearer <CRON_SECRET>`, constant-time compare, 401 otherwise (docs/06 §3.3, SA-17), per-job lock row (1 concurrent → 409, docs/09 §7), runs each job with `withJobRun`, one `job_runs` row per job per invocation, returns per-job status, `skipped: true` when the window already ran; on Vercel Hobby both endpoints are fired by `scheduler.yml` (P9.9), on Pro by Vercel Cron, in containers by `scheduler.ts`. `src/jobs/scheduler.ts` (node-cron; `RUN_SCHEDULER=true`; calls the same endpoints in-process) and `scheduler.js` entry in the Docker image. System widget wiring to `listJobRuns`.
- Owned paths: `src/app/api/cron/**` (P9 row of master plan §3), `src/jobs/registry.ts`, `src/jobs/scheduler.ts`, `src/jobs/{backups-verify,audit-export,jobs-health}.ts` (cron plumbing under the same §3 row), `Dockerfile` (scheduler entry). Forbidden: the job files owned by P3/P4/P5/P6 (`publish`, `fx`, `knowledge`, `order-expiry`, `quote-expiry`, `subscriptions`, `retention`, `email-outbox`, `lead-digest`, `chat-purge`).
- Dependencies: none (jobs exist).
- Expected files/modules: as listed + `docs/ops/jobs.md` (key → endpoint → file mapping, a mirror of docs/06 §3.3 plus the two flagged additions).
- Tests required: integration `tests/integration/api/cron.test.ts` (`@security` SA-17: missing or wrong secret → 401; with secret → 200 and one `job_runs` row per job; second call in the same window → skipped; concurrent → 409), `tests/integration/jobs/{backups-verify,audit-export,jobs-health}.test.ts`; unit `tests/unit/jobs/registry.test.ts` (every job key from docs/06 §3.3 mapped exactly once to the documented endpoint; no key outside docs/06 §3.3 except the two flagged additions).
- Acceptance criteria:
  - [ ] SA-17 green; every job key in docs/06 §3.3 / docs/12 §2.3 runs from exactly the documented endpoint, in the documented order
  - [ ] missed job turns the System widget red and notifies super admins
  - [ ] `node scheduler.js` ticks in the container (P9.11 verifies on staging compose)
- Definition of Done: code + tests + ops doc + PROGRESS row + CI green.
- Potential risks and mitigations: Hobby 60 s function limit for `daily` → jobs bounded (reindex chunked; purge batched); if a job exceeds 45 s it logs `partial` and continues next tick.

### P9.5 Full e2e suite S-00..S-23 on both hosts + full browser matrix
- Owner profile: domain-standard
- Requirement IDs: FR-OPS-05, NFR-OPS-01, NFR-COMPAT-01, D-1607, D-1304, docs/10 §2 (`e2e` job, nightly `@full` matrix), docs/12 §4.1, §6 (all scenarios), §10 (matrix), §11 (flaky policy), X-01
- Description: Consolidate P7/P8 journeys into the canonical scenario files `tests/e2e/scenarios/S-00.smoke.spec.ts` … `S-23.spec.ts`, each end to end across hosts (customer on site host, admins on admin host) with the seeded snapshot, `email_outbox` assertions for every email, `expectAuditRow` on every admin step, cron invocations through `/api/cron/*` with an injected `now` (`X-Test-Now` header honoured only when `APP_ENV≠production`), fake LLM, MinIO. Playwright projects: PR = chromium desktop + mobile Chrome; nightly/tag `@full` = WebKit, Firefox, mobile Safari, 2560/3840 layout screenshots. `S-00` tagged `@smoke` for staging/production read-only runs. Sharding by scenario group to stay ≤ 12 min on PR.
- Owned paths: `tests/e2e/scenarios/**`, `tests/e2e/fixtures.ts`, `playwright.config.ts` (projects/sharding), `src/lib/test-clock.ts` (`X-Test-Now` guard). Forbidden: `src/**` beyond the clock guard.
- Dependencies: P9.1–P9.4.
- Expected files/modules: 24 scenario files + fixtures.
- Tests required: the suite itself; `tests/static/scenario-coverage.test.ts` asserting every S-xx of docs/10 §6 has a file and every step number appears as a `test.step`.
- Acceptance criteria:
  - [ ] S-00..S-23 green on chromium desktop + mobile Chrome on every PR
  - [ ] `e2e-full` green on the release candidate commit (WebKit, Firefox, mobile Safari)
  - [ ] flake rate < 2 % over the last 7 days of runs (workflow report)
- Definition of Done: suite + config + PROGRESS row + CI green.
- Potential risks and mitigations: clock injection misuse → header ignored in production and audited when used on staging; WebKit SSE/streaming quirks → chat scenario asserts final state with `expect.poll`.

### P9.6 LHCI, axe, size-limit as required checks; visual baselines; flaky policy
- Owner profile: domain-standard
- Requirement IDs: NFR-PERF-01..04, NFR-A11Y-01, NFR-OPS-01, FR-OPS-05, docs/10 §2, §8, §9, §11, §12, docs/11 §B10, §B13, docs/12 §4.2 (required checks), X-02, X-03
- Description: Make `lhci`, `axe`, `size-limit` (inside `build`) required checks with the path filter from docs/12 §4.2; LHCI against the Vercel preview URL when present (Lighthouse GitHub app token) else `next start`; PR comment with deltas vs `main`; `lhci-weekly.yml` against production (P9.9 creates the workflow; this task supplies the config and notification hook). Axe over the complete route inventory (both hosts, both themes, reduced-motion pass on `/`), moderate findings reported. Visual baselines: 12 key screens, both themes, masked dynamic regions, nightly non-blocking. Coverage ratchet (last green minus ≤ 1 point) and `@flaky` age check (5 working days) wired into `ci.yml`/nightly. Lint rule: `test.skip` needs issue + date.
- Owned paths: `lighthouserc.json`, `.size-limit.json`, `tests/e2e/a11y/**`, `tests/e2e/visual/**`, `.github/workflows/ci.yml` (required-check and ratchet steps — coordinated with P9.9), `scripts/ci/{coverage-ratchet,flaky-age}.ts`. Forbidden: `src/**`.
- Dependencies: P9.5.
- Expected files/modules: as listed.
- Tests required: the gates themselves; `tests/static/route-inventory-axe.test.ts` (every route in `ui/sitemap.md` appears in the axe list).
- Acceptance criteria:
  - [ ] LHCI thresholds of docs/11 §B10 pass on the eight URLs on the release candidate (X-02)
  - [ ] zero serious/critical axe violations across all routes/themes (X-03)
  - [ ] coverage thresholds (docs/10 §12) met and ratchet active
- Definition of Done: gates + workflows + PROGRESS row + CI green.
- Potential risks and mitigations: preview URL cold start skews LCP → 3 runs median with warm-up request.

### P9.7 Security acceptance SA-01..25 audit + report
- Owner profile: reviewer
- Requirement IDs: NFR-SEC-08, SA-01..SA-25, docs/09 §13, docs/10 §2 (`security-acceptance` job), X-05, TM-01..TM-26
- Description: Map every SA-nn to its `@security`-tagged tests (SA-01 verification/checkout gate; SA-02/03 sessions; SA-04 cookies; SA-05 host isolation; SA-06 TOTP; SA-07 static `defineAction`; SA-08 approver; SA-09 immutability; SA-10 IDOR 404s; SA-11 downloads; SA-12 presign lifetime + **manual** R2 listing check; SA-13 uploads; SA-14 key encryption; SA-15 limits; SA-16 Turnstile; SA-17 cron; SA-18 headers; SA-19 rich text; SA-20 LLM payload; SA-21 anonymisation; SA-22 `pnpm audit` + gitleaks; SA-23 audit rows; SA-24 shortfall; SA-25 **manual** tabletop drill + secrets inventory), fill gaps with new tests, run the `security-acceptance` job, perform the threat-model walk-through TM-01..TM-26 against the code, run `pnpm audit --prod --audit-level=high` and gitleaks history scan, verify logger redaction and Sentry scrubbing on a live staging event, and write `docs/ops/security-acceptance-report.md` with evidence per SA (test names + CI links; manual items with founder sign-off lines). Expected mapping (the report confirms or corrects it):

  | SA | Origin task(s) | Test(s) |
  |----|----------------|---------|
  | SA-01 | P4.2, P7.8, P6.6 | `orders/unverified-blocked`, `e2e/auth/register-verify` (S-01), `chat/start-requires-verified` |
  | SA-02, SA-03 | P1.5 | `auth/single-session`, `auth/idle-timeout`, `e2e/scenarios/S-18` |
  | SA-04 | P1.5 | cookie attributes test |
  | SA-05 | P1.7 | `e2e/foundation/host-isolation`, `e2e/scenarios/S-19` |
  | SA-06 | P1.5, P8.1 | `auth/totp`, `e2e/admin/login-totp` |
  | SA-07 | P1.6 | `static/actions-use-define-action` |
  | SA-08 | P2.11, P3.2 | `triggers/approver`, `approvals/requester-rejected`, S-07 step 3 |
  | SA-09 | P2.11, P4.8 | `triggers/append-only`, `triggers/payments-frozen`, `refunds/payment-transition-once` |
  | SA-10 | P4.2, P4.5, P4.6, P5.1, P6.5 | `*/foreign-id-404` suites |
  | SA-11 | P5.3, P5.8 | `delivery/cap-reached`, `revoked-refused`, `expired-refused` |
  | SA-12 | P3.5, P5.3 | presign lifetime tests + manual R2 listing check |
  | SA-13 | P3.5 | `media/validation`, `media/mismatch-rejected` |
  | SA-14 | P5.4 | `delivery/set-key-encrypted`, `key-absent-from-logs` |
  | SA-15 | P9.2 | `security/rate-limits` (sampled surfaces) |
  | SA-16 | P6.3, P9.3 | `leads/create-invalid-token`, `security/turnstile` |
  | SA-17 | P9.4 | `api/cron` |
  | SA-18 | P9.1 | `e2e/security/headers` |
  | SA-19 | P3.10 | `content/render` |
  | SA-20 | P6.6 | `chat/provider-payload-has-no-pii` |
  | SA-21 | P3.4, P5.7 | `users/delete-account-anonymises-immediately` (API-AUTH-08 transaction, S-21 step 1), `jobs/users-anonymise-sweep-noop` (S-21 step 2) |
  | SA-22 | P1.10 | `lint` job (`pnpm audit`, gitleaks) |
  | SA-23 | P3.1, P8.14 | `expectAuditRow` in every admin e2e step |
  | SA-24 | P4.4 | `payments/confirm-shortfall` |
  | SA-25 | P9.10 | manual: tabletop drill + secrets inventory sign-off |

- Owned paths: `tests/**/*security*.spec.ts` gap fillers, `docs/ops/security-acceptance-report.md`. Forbidden: `src/**` (findings become issues assigned to owners).
- Dependencies: P9.5.
- Expected files/modules: as listed + `tests/static/sa-coverage.test.ts` (each SA id referenced by ≥ 1 tagged test, except SA-12 manual part and SA-25).
- Tests required: `security-acceptance` job green; SA coverage static test.
- Acceptance criteria:
  - [ ] SA-01..SA-24 automated and green; SA-12 manual R2 check and SA-25 signed by both founders
  - [ ] no high/critical vulnerabilities; gitleaks clean including history
  - [ ] report committed with evidence
- Definition of Done: report + tests + PROGRESS row + CI green (X-05).
- Potential risks and mitigations: unfixable dependency advisory → documented exception with mitigation and founder acknowledgement (not a CI override; the dependency is replaced or pinned to a patched fork).

### P9.8 Final seed, production seed, legal copy, founder assets
- Owner profile: domain-standard
- Requirement IDs: FR-OPS-04, FR-CONT-04, FR-CAT-01, D-018, D-807, A-1501, R-502, docs/05 §14, docs/12 §1 (production subset), docs/13 E-05, E-07, R1-26, X-07, X-10
- Description: Replace placeholders in `scripts/seed/data/*` with founder-supplied content (E-05): eight services copy, ≥ 3 case studies, landing chapter copy and posters, five products' descriptions/media/offerings/splits (still `draft` in production), legal pages final copy (privacy incl. cookie line + AI-provider note + the immediate-anonymisation-on-deletion statement (BR-18); terms with Indian governing law; refunds stating manual-payment-only refunds with the gateway placeholder; license), site settings from E-03/E-04 (seller details, UPI VPA, bank details encrypted), both Super Admins with real emails; hero poster/logo/font assets from E-07 into `public/`; media objects uploaded to the production `codekraft-public` bucket by a `scripts/seed/upload-media.ts` step. `pnpm db:seed --production` idempotent with `seeded_at`. Legal copy reviewed against X-10 by the founders (sign-off line in `FOUNDER-CHECKLIST.md`).
- Owned paths: `scripts/seed/**`, `public/{brand,hero,seed}/**`, `docs/ops/content-inventory.md`. Forbidden: `src/**`.
- Dependencies: founder inputs (tracked in `ISSUES.md`).
- Expected files/modules: as listed.
- Tests required: `tests/integration/seed/production-seed.test.ts` (subset only; products `draft`; `seeded_at` once; legal pages present with the required phrases — regex for "manual" and "gateway" on refunds, "anonymis" on privacy), `tests/unit/seed/no-placeholder.test.ts` (no `lorem`/`TODO`/`placeholder` strings in seed data).
- Acceptance criteria:
  - [ ] production seed contains no placeholder text; legal pages carry the mandated wording (X-10)
  - [ ] founders' real admin accounts seeded; example products `draft`
  - [ ] assets within docs/11 §B2/§B6 size limits (test)
- Definition of Done: seed + assets + tests + PROGRESS row + CI green.
- Potential risks and mitigations: content late → launch blocked on E-05; placeholders never ship because the no-placeholder test fails the `integration` job when `SEED_MODE=production`.

### P9.9 Deployment configs and workflows
- Owner profile: domain-critical
- Requirement IDs: FR-OPS-02, FR-OPS-05, NFR-PORT-01, NFR-DATA-02, D-1404, D-1606, A-1201, A-1401, R-1401, docs/12 §2.1 (projects, admin host), §2.3 (cron entries), §4.1 (all workflows), §5.3 (backups), §9.2 (image, compose, Caddy, deploy script), §10 (rollback), MASTER_SPEC §7 "Admin host during interim", "Cron on free tier", "Backups"
- Description: Vercel: projects `codekraft` (Git auto-deploy disabled via `vercel.json`, second domain `codekraft-admin.vercel.app`, `ADMIN_HOST`, region `bom1`, cron entries for `daily` and a daily `frequent` safety net) and `codekraft-staging` (Git-connected, previews on, `admin-staging` host); env variables per docs/12 §2.2 documented in `docs/ops/env-matrix.md`. Workflows: `preview-db.yml` (Neon branch create/seed/env inject; delete on close; > 8 branches → clear failure), `staging.yml` (migrate staging → Vercel deploy → `@smoke`), `release.yml` (`verify-tag` on `main` + green checks → `backup-pre-deploy` → `migrate-production` → `deploy-production` with GitHub Environment approval by the other founder → `docker-image` to GHCR → `smoke-production` → `github-release`), `scheduler.yml` (15-min `frequent` tick on production and staging; disabled flag for VPS), `backup.yml` (nightly `pg_dump -Fc` → `age`/openssl → R2 `daily/`; Sunday `weekly/` off-site to the second account/B2; R2 lifecycle rules documented), `lhci-weekly.yml`. Container: `docker-compose.prod.yml` (`app`, `scheduler`, `caddy`), `Caddyfile` (HSTS + compression only), `deploy.sh`, `migrate.js` entry — validated on a staging VPS-like compose run in CI (`docker compose -f docker-compose.prod.yml config` + boot test). Rollback procedures of docs/12 §10 in `docs/ops/rollback.md`; `ops.rollback` audit action.
- Owned paths: `vercel.json`, `.github/workflows/{preview-db,staging,release,scheduler,backup,lhci-weekly}.yml`, `docker-compose.prod.yml`, `Caddyfile`, `deploy.sh`, `scripts/ops/**`, `docs/ops/{env-matrix,rollback,restore-log}.md`. Forbidden: `ci.yml` job semantics (P9.6 edits coordinated).
- Dependencies: P9.4.
- Expected files/modules: as listed.
- Tests required: workflow dry runs on a `release-rehearsal` tag against staging (`v0.9.0-rc.1`), `tests/static/workflows.test.ts` (every workflow/job name of docs/12 §4.1 exists; `production` environment requires a reviewer), compose boot test in CI.
- Acceptance criteria:
  - [ ] rehearsal tag runs `release.yml` end to end against staging with the other founder's approval step exercised
  - [ ] backup workflow produced ≥ 1 encrypted dump in R2 and `backups.verify` sees it
  - [ ] admin host reachable on both Vercel projects via `ADMIN_HOST`
- Definition of Done: configs + rehearsal evidence + ops docs + PROGRESS row + CI green.
- Potential risks and mitigations: Hobby single-member limit → only one founder has Vercel access (recorded, docs/12 Open #5); GitHub minutes → scheduler tick is a 5-second job.

### P9.10 Founder-action checklist + `FOUNDER-CHECKLIST.md` generation
- Owner profile: domain-standard
- Requirement IDs: D-1607, docs/10 §14 (25 checks), docs/12 §2.1 (domains), §7 (Resend DNS records), §8.1 (monitoring), §9.4 step 1, docs/13 E-02..E-07, X-06, X-08, X-09, MASTER_SPEC §7 "Domain before launch (founder action)"
- Description: `scripts/ops/generate-founder-checklist.ts` producing `FOUNDER-CHECKLIST.md` at the repo root from a typed list: (a) founder actions before deploy — domain on Cloudflare DNS, `<domain>`/`www`/`admin` added to Vercel with `ADMIN_HOST` set, Resend domain verification records (DKIM/SPF/return-path/DMARC exact values), Google OAuth redirect URIs per env, Turnstile hostnames, Umami website id, Sentry alert rules, UptimeRobot monitors for site/admin `/api/health` and `/` keyword, R2 custom domain `media.<domain>` + CORS + lifecycle rules + public-listing off (SA-12), Anthropic spend cap, secrets inventory complete in Vercel/GitHub (SA-25), both founders' TOTP devices; (b) the docs/10 §14 manual pass (25 items) with evidence columns and the dual sign-off line; (c) post-deploy: `launched_at` set in settings, backups ≥ 3 nights (X-06), restore drill logged, monitoring test event (X-08). Each item links to the runbook section. The generator is re-runnable; status ticks live in the generated file.
- Owned paths: `scripts/ops/generate-founder-checklist.ts`, `FOUNDER-CHECKLIST.md`, `docs/ops/dns-records.md`. Forbidden: `src/**`.
- Dependencies: P9.9.
- Expected files/modules: as listed.
- Tests required: `tests/unit/ops/founder-checklist.test.ts` (generated file contains all 25 docs/10 §14 items and every E-0x criterion; DNS record names present).
- Acceptance criteria:
  - [ ] `FOUNDER-CHECKLIST.md` generated and committed; every founder action has an owner and a runbook link
  - [ ] DNS record values match docs/12 §7 patterns
- Definition of Done: generator + file + test + PROGRESS row + CI green.
- Potential risks and mitigations: founders skip items → P9.11 refuses to tag `v1.0.0` until section (a) is ticked (orchestrator gate, not CI).

### P9.11 Production deploy `v1.0.0`, smoke, restore drill, monitoring verification
- Owner profile: domain-critical
- Requirement IDs: FR-OPS-02, NFR-AVAIL-01, NFR-DATA-02, D-1404, docs/12 §4.1 (`release.yml`), §5.3 (restore drill, `pnpm db:verify`), §9.5 (smoke checklist 1–15), §11.5, docs/10 S-00, docs/13 §3.3 X-01, X-04, X-06, X-07, X-08, X-09, §2 ("live" definition)
- Description: With P9.10 section (a) ticked and CI green on `main`: tag `v1.0.0` (annotated, by a founder) → `release.yml` (pre-deploy backup, production migration, deploy with the other founder's approval, GHCR image, `smoke-production` S-00, release notes). Then: run docs/12 §9.5 smoke checklist items 1–15 on `<domain>` and `admin.<domain>` (documented in `docs/ops/launch-log.md`), production seed applied once, both Super Admins log in with TOTP and publish one product through dual approval (X-07), set `site_settings.launched_at` (unlocks Umami + sitemap `lastModified`), verify Sentry test event + UptimeRobot alerts (X-08), perform the restore drill into Neon branch `restore-drill` with `pnpm db:verify` and record `docs/ops/restore-log.md` (X-06 needs three nightly backups — schedule the drill on day 3, launch is not blocked by the third night if the founders accept; recorded), founders execute `FOUNDER-CHECKLIST.md` section (b) and sign (X-09). Any failure returns to engineering as a bug → `v1.0.x`.
- Owned paths: `docs/ops/{launch-log,restore-log}.md`, `scripts/ops/db-verify.ts` (`pnpm db:verify`: row counts, `partner_balances` totals, triggers present, latest invoice number). Forbidden: `src/**` (fixes are separate PRs).
- Dependencies: P9.5–P9.10.
- Expected files/modules: as listed.
- Tests required: `smoke-production` job (S-00) green; `tests/integration/ops/db-verify.test.ts`.
- Acceptance criteria:
  - [ ] `v1.0.0` deployed by `release.yml` with dual approval; S-00 green on production
  - [ ] smoke checklist 1–15 recorded green; `launched_at` set
  - [ ] restore drill succeeded and logged; monitoring alerts verified
  - [ ] founders' manual pass signed by both
- Definition of Done: launch log + restore log + PROGRESS row + release notes published.
- Potential risks and mitigations: Resend domain not verified → customer email fails silently → P9.10 (a) gate; Hobby commercial-use risk (R-1401) → move trigger recorded (first paid order).

### P9.12 `CHANGELOG.md` release entry, doc sync, final review
- Owner profile: reviewer
- Requirement IDs: master plan §1.5, §7 "Doc errors discovered in code", §8, docs/12 §4.2 (Conventional Commits changelog), X-01..X-10 evidence table
- Description: Write the `[1.0.0]` section of `CHANGELOG.md` (Added per area, Documentation corrections consolidated from every phase review), reconcile every doc correction into the cited docs (`docs/03`–`docs/13`, `ui/sitemap.md`, MASTER_SPEC §7 where the founder decided — expected set: the answered `ISSUES.md` items such as I-004 license-key email policy and I-005 rate-limit tuning, the `finance.reconcile` and `queries.autoclose` job keys to add to docs/06 §3.3 / docs/12 §2.3, and any email-template alias), update master plan §3 ownership map with the paths assigned during P1–P9, close or carry `ISSUES.md` items into V1.1, and produce `implementation/reviews/P9-review.md` with the X-01..X-10 evidence table.
- Owned paths: `CHANGELOG.md`, `implementation/IMPLEMENTATION-MASTER-PLAN.md` (§3 only), `docs/**` (corrections only), `ui/sitemap.md`, `implementation/ISSUES.md`, `implementation/reviews/P9-review.md`. Forbidden: `src/**`.
- Dependencies: P9.11.
- Expected files/modules: as listed.
- Tests required: `tests/static/docs-consistency.test.ts` (permission names in `ui/sitemap.md` ⊆ docs/06 §1.2; every `SCR-` in docs/07 has a route in `ui/sitemap.md`; every job key in docs/06 §3.3 in `docs/ops/jobs.md`).
- Acceptance criteria:
  - [ ] `[1.0.0]` changelog published with the GitHub release
  - [ ] no open doc correction without a doc edit
  - [ ] X-01..X-10 each has evidence
- Definition of Done: changelog + doc edits + review + PROGRESS statuses + CI green.
- Potential risks and mitigations: doc drift resumes in V1.1 → the docs-consistency static test stays in `ci.yml`.

## Parallelisation map

```
P9.1 ─┐
P9.2 ─┼─► P9.3 ─┐
P9.4 ─┘         ├─► P9.5 ─► P9.6 ─┐
P9.8 (independent, founder inputs)  ├─► P9.7 ─┐
P9.9 (after P9.4) ─► P9.10 ─────────┘         ├─► P9.11 ─► P9.12
```

- P9.1, P9.2, P9.4, P9.8 start concurrently (disjoint: config/middleware; rate-limit lib + wiring PR; cron routes/jobs registry; seed data). P9.2's wiring PR touches many `actions.ts` files — it is the only PR doing so in this window; P9.3 follows it because both touch auth actions.
- P9.9 after P9.4 (scheduler/cron entries). P9.10 after P9.9 (needs the final host/env facts).
- P9.5 needs P9.1–P9.4 (headers, limits, Turnstile and cron are exercised by scenarios). P9.6 and P9.7 after P9.5 (gates and SA mapping over the final suite); they are concurrent with each other and with P9.10.
- P9.11 is the launch gate; P9.12 closes.
- Reviewer capacity: reviewer 1 owns P9.7; reviewer 2 owns P9.12 and audits P9.5/P9.6.

## Phase Definition of Done

- All 12 tasks `done`; `implementation/reviews/P9-review.md` committed with X-01..X-10 evidence.
- `ci.yml` required checks on the `v1.0.0` commit all green (docs/12 §4.1 names): `lint`, `typecheck`, `unit` (thresholds + ratchet), `integration` (all FI, triggers), `build` (size-limit, docker), `e2e` (S-00..S-23 on the PR projects), `axe` (all routes, both hosts, both themes), `lhci` (eight URLs), plus the `security-acceptance` report (SA-01..24); the nightly `@full` browser matrix green on the tag.
- Production live on `<domain>` + `admin.<domain>` with `ADMIN_HOST`; smoke checklist 1–15 green; `launched_at` set; monitoring alerts verified; restore drill logged; `FOUNDER-CHECKLIST.md` sections (a) and (b) signed by both founders.
- `CHANGELOG.md [1.0.0]` published; all doc corrections applied; `ISSUES.md` carries only V1.1 items.

## Phase risks

| Risk | Mitigation |
|------|------------|
| Strict CSP breaks Turnstile/Umami/3D workers | report-only week on staging; e2e console assertion |
| Founder actions (domain, DNS, Resend) late | P9.10 gate; interim `*.vercel.app` hosts work for everything except customer email |
| Full matrix reveals WebKit/Firefox bugs late | `e2e-full` nightly starts at P9.5 merge, not at tag time |
| Backups untested until launch week | `backup.yml` enabled at P9.9; drill scheduled; X-06 timing recorded |
| Hobby commercial-use ToS (R-1401) | move to Pro/VPS on first paid order — carried to V1.1 P13 |
| Performance regression from hardening (headers/nonce) | LHCI gate remains required on site paths |

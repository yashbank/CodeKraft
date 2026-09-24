# 12 — DEVOPS & DEPLOYMENT

**Implements:** baseline §12 (portability), §13 (secrets, HTTPS), §17; D-1401, D-1402, D-1403, D-1404, D-1502, D-1503, D-1606, D-1607; A-1201, A-1401, A-1402; R-1401, R-1402; FR-OPS-01…05, NFR-OPS-01…03 (`docs/03-SRS.md`).
**Depends on:** `docs/04-SOLUTION-ARCHITECTURE.md` §4 (stack), §6 (cron), §8 (admin host), §10 (integrations), §11 (portability); `docs/05-DATABASE-DESIGN.md` §12 (triggers), §14 (seed), §15 (migrations); `docs/09-SECURITY-DESIGN.md` §8 (secrets), §9 (headers), §10 (logging); `docs/11-SEO-PERFORMANCE.md` §B10 (Lighthouse CI).
**Feeds:** `docs/10-QA-TEST-STRATEGY.md` (CI gates), `docs/13-ROADMAP.md` (launch definition, V1.1 hosting migration), `implementation/` (P-tasks for `.github/workflows`, `Dockerfile`, `docker-compose*.yml`).

Owner of every account below: the founders (Super Admins). The repository is private on GitHub under the founders' organisation. Purchased domain written as `<domain>` (D-1502). The domain is bought and DNS-verified **before** release 1 goes live (MASTER_SPEC §7 "Domain before launch", docs/13 E-06) even though hosting stays on Vercel; the `*.vercel.app` hostnames below are the pre-launch and fallback names only.

---

## 1. Environments (D-1404)

| Env | Purpose | Trigger | Host | Database | Storage | Email | Robots | `APP_ENV` |
|-----|---------|---------|------|----------|---------|-------|--------|-----------|
| **local** | developer / AI-agent loop | `pnpm dev` | `localhost:3000`, admin at `admin.localhost:3000` (`/etc/hosts` not needed: browsers resolve `*.localhost`) | Docker `postgres:16` via `docker-compose.yml` | R2 bucket `codekraft-dev-*` (free) or MinIO service in compose (`STORAGE_ENDPOINT` override) | Resend test key → console transport when `EMAIL_TRANSPORT=log` | n/a | `local` |
| **preview** | one per PR | PR opened/updated | Vercel preview URL (`codekraft-git-<branch>-<team>.vercel.app`) | Neon branch `preview/pr-<n>` created from `staging` by CI, seeded, deleted on PR close | `codekraft-dev-*` buckets, keys prefixed `pr-<n>/` | Resend, `EMAIL_ALLOWLIST` = founders' addresses only | `X-Robots-Tag: noindex` (Vercel default) | `preview` |
| **staging** | integration of `main` | push to `main` | Vercel project `codekraft-staging` → `staging.<domain>` (interim `codekraft-staging.vercel.app`), admin `admin-staging.<domain>` (interim `codekraft-staging-admin.vercel.app`) | Neon branch `staging` (reset from production snapshot weekly, anonymised) | `codekraft-staging-*` buckets | Resend with allowlist | `noindex` header set by middleware when `APP_ENV=staging` | `staging` |
| **production** | customers | tag `v*` on a commit of `main` with green checks (D-1404) | Vercel project `codekraft` → `<domain>` + `admin.<domain>` (interim `codekraft.vercel.app` + `codekraft-admin.vercel.app`) | Neon branch `main` (primary) | `codekraft-public`, `codekraft-private`, `codekraft-documents`, `codekraft-backups` | Resend verified domain | indexable | `production` |

Rules: no environment shares a database or an R2 bucket with another; `lib/env.ts` refuses to start production with a `*-dev-*` bucket name or a non-`main` Neon branch (branch name is read from `DATABASE_URL` host label). Seed data (DB §14) is loaded into local, preview and staging; production receives the "production seed" only (roles, permissions, two Super Admins + partners, settings, legal placeholders, landing chapter skeletons, eight services); the five example products are seeded to production as `draft` so the founders can edit or delete them (BR-11: zero orders → deletable; D-018).

## 2. Vercel setup (now)

### 2.1 Projects, domains, hosts

| Item | Value |
|------|-------|
| Projects | `codekraft` (production; Git auto-deploy **disabled** by `vercel.json` `"git": {"deploymentEnabled": {"main": false}}` — deploys come from CI on tags) and `codekraft-staging` (Git-connected, Production Branch = `main`, PR previews on). Both import the same repo. |
| Framework | Next.js, Node 22, `pnpm install --frozen-lockfile`, build `pnpm build`, output standalone (arch §11). Function region `bom1` (Mumbai) to sit next to Neon `ap-southeast-1` — pick Neon region Singapore; both hosts serve India-first traffic (R-401). |
| Admin host | Middleware matches `request.headers.host === process.env.ADMIN_HOST` **exactly** (arch §8, MASTER_SPEC §7 "Admin host during interim"); there is no prefix fallback, and an unset `ADMIN_HOST` disables the admin app. Before the domain exists (`*.vercel.app` cannot carry a nested subdomain) each project gets a second `*.vercel.app` domain assigned in *Settings → Domains* (`codekraft-admin.vercel.app`) and `ADMIN_HOST` names it; from launch `ADMIN_HOST=admin.<domain>`. |
| Domain | `NEXT_PUBLIC_SITE_URL=https://codekraft.vercel.app` only during development; before launch (E-06) add `<domain>`, `www.<domain>` (redirect), `admin.<domain>` to project `codekraft`; set `NEXT_PUBLIC_SITE_URL=https://<domain>`, `ADMIN_HOST=admin.<domain>`; Vercel issues TLS. `*.vercel.app` hosts then 308-redirect to `<domain>` (middleware, docs/11 §A3). |
| Media host | R2 custom domain `media.<domain>` (CNAME to R2, Cloudflare-proxied). Interim: the bucket's `*.r2.dev` public URL. |
| Plan | Hobby now (D-1606, R-1401). Hobby constraints that matter: **commercial use prohibited**, 1 member (the second founder cannot be added — accepted for the interim, MASTER_SPEC §7 "Admin host during interim"), 2 cron jobs per project at once-daily granularity, function max duration 60 s, 100 GB bandwidth/month, 1 h log retention. Move to **Pro (USD 20/member/month)** on whichever comes first: the first real paid order, the second founder needing dashboard access, or a cron that must run hourly — unless the VPS migration (§9) has already happened. |

### 2.2 Environment variables

Set per environment in Vercel (Production / Preview) and in GitHub Environments; `lib/env.ts` validates all with Zod at boot (docs/09 §8). "S" = secret (Vercel *Sensitive*, GitHub secret), "P" = public (`NEXT_PUBLIC_*`, shipped to the browser), "C" = CI-only.

| Variable | Type | Used by | Notes |
|----------|------|---------|-------|
| `APP_ENV` | plain | env guard, robots, logger | `local` / `preview` / `staging` / `production` |
| `NEXT_PUBLIC_SITE_URL` | P | metadataBase, canonicals, emails | absolute, no trailing slash |
| `NEXT_PUBLIC_ADMIN_URL` | P | links in admin emails/notifications | |
| `ADMIN_HOST` | plain | middleware host match (§2.1) | |
| `DATABASE_URL` | S | app (Neon pooled, `-pooler` host) | |
| `DATABASE_URL_UNPOOLED` | S | migrations, pg_dump | direct Neon host |
| `BETTER_AUTH_SECRET` | S | sessions, tokens | 32+ bytes; rotation ends all sessions |
| `BETTER_AUTH_URL` | plain | Better Auth base | equals site URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | plain / S | Google OAuth | redirect URIs per env registered in Google Cloud |
| `APP_ENCRYPTION_KEY` | S | AES-256-GCM for license keys, bank details (docs/09 §5.2) | versioned `v1:` prefix; rotation §8 |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | plain, S, S | `@aws-sdk/client-s3` | token scoped to this env's buckets |
| `R2_BUCKET_PUBLIC`, `R2_BUCKET_PRIVATE`, `R2_BUCKET_DOCUMENTS`, `R2_BUCKET_BACKUPS` | plain | media, downloads, PDFs, dumps | §5 |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | P | `next/image` remote pattern, video `src` | `https://media.<domain>` |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` | S | email, bounce webhook | |
| `EMAIL_FROM`, `EMAIL_REPLY_TO` | plain | headers | `CodeKraft <hello@<domain>>` |
| `EMAIL_ALLOWLIST`, `EMAIL_TRANSPORT` | plain | non-production guard | comma list / `resend` or `log` |
| `ANTHROPIC_API_KEY` | S | `AnthropicProvider` (arch §9) | separate key per env with spend cap |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET` | P / S | forms (D-1204) | Cloudflare test keys (`1x0000…`) in local/preview |
| `NEXT_PUBLIC_UMAMI_SRC`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | P | analytics (D-1301) | unset in local/preview → script not rendered |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` | P, plain | Sentry client/server | |
| `SENTRY_AUTH_TOKEN` | S, C | source-map upload at build | never at runtime |
| `CRON_SECRET` | S | `/api/cron/*` bearer check (arch §6) | Vercel injects it into cron requests when named exactly `CRON_SECRET` |
| `RUN_SCHEDULER` | plain | `jobs/scheduler.ts` node-cron (container only) | `true` on exactly one container |
| `FX_API_URL` | plain | `open.er-api.com` (arch §4) | |
| `FEATURE_PHONE_OTP`, `FEATURE_WHATSAPP_CHANNEL`, `FEATURE_THEME_LIGHT_EDITORIAL`, `FEATURE_PROVIDER_RAZORPAY`, `FEATURE_PROVIDER_STRIPE`, `FEATURE_PROVIDER_PAYPAL`, `FEATURE_AUTOMATED_PROVISIONING`, `FEATURE_THREE_HERO`, `FEATURE_BUNDLES`, `FEATURE_VENDOR_MARKETPLACE` | plain | env overrides of `site_settings` flags (arch §7.9, MASTER_SPEC §4.11) | unset = DB value wins |
| `BACKUP_ENCRYPTION_KEY` | S, C | age/openssl encryption of dumps (§5.3) | held in GitHub secrets and the founders' password manager only |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_PROJECT_ID_STAGING` | S, C | CLI deploys | |
| `NEON_API_KEY`, `NEON_PROJECT_ID` | S, C | branch create/delete in CI | |
| `LHCI_GITHUB_APP_TOKEN` | S, C | Lighthouse CI status checks | optional |
| V1.1: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SMS_PROVIDER_*`, `WHATSAPP_*` | S | gateways, OTP, WhatsApp | added with their flags (docs/13) |

### 2.3 Cron configuration

Two consolidated endpoints, `GET /api/cron/frequent` (every 15 min) and `GET /api/cron/daily` (arch §4, MASTER_SPEC §7 "Cron on free tier"); every job is idempotent (FR-OPS-01). Vercel Hobby allows two crons at once-daily granularity, so while on Hobby **both endpoints are fired by the GitHub Actions workflow `scheduler.yml`** (`curl -H "Authorization: Bearer $CRON_SECRET"`); the Vercel Cron entries are kept only as a daily safety net. Job keys below are canonical (docs/06 §3.3 and docs/09 §5.3 repeat them).

| Endpoint | Hobby trigger | Pro / container schedule | Jobs (in order, each logged to `job_runs`) |
|----------|---------------|--------------------------|--------------------------------------------|
| `GET /api/cron/frequent` | `scheduler.yml` every 15 min (+ Vercel Cron daily safety net) | `*/15 * * * *` | `publish.scheduled` (A-302), `orders.expire` (BR-10 → `failed('expired')`), `quotes.expire` (D-520), `email.outbox_retry` (arch §10), `invoices.regenerate_pending` (§11.3), `retention.purge_tokens` |
| `GET /api/cron/daily` | `scheduler.yml` at `30 21 * * *` (03:00 IST) (+ Vercel Cron) | same | `subscriptions.remind_grace_suspend` (D-521), `entitlements.expire` (D-605), `fx.refresh` (D-515), `knowledge.reindex` (arch §9), `retention.purge` (D-1503, DB §12), `users.anonymise` (safety sweep only — anonymisation happens in the delete transaction, BR-18), `admin.overdue_digest` (R-701), `finance.reconcile` (NFR-DATA-04), `queries.auto_close` (FR-LEAD-09), `vitals.rollup` (docs/11 §B13), `backups.verify` (checks yesterday's dump exists in R2, else notifies), `audit.export` (Sundays, docs/09 §5.3), `health.jobs_check` (§7) |

`job_runs` gets one row per job per invocation; a job that already ran for the current window (`job` + `started_at::date` + window key) returns early. The admin System widget shows last success per job and turns red at 2× the expected interval. On the container the same endpoints are called by `jobs/scheduler.ts` (node-cron) and the GitHub workflow is disabled. `partner_balances` is a plain view (DB §7); there is no refresh job.

## 3. Local development

| Item | Detail |
|------|--------|
| `docker-compose.yml` | services: `postgres:16-alpine` (port 5432, volume `pgdata`, `POSTGRES_DB=codekraft`), optional `minio` + `minio-mc` (creates the four buckets), optional `mailpit` (SMTP + web UI for email preview when `EMAIL_TRANSPORT=smtp`). |
| Scripts | `pnpm db:migrate` (drizzle-kit migrate + `drizzle/custom/*.sql`), `pnpm db:seed`, `pnpm db:reset` (drop + migrate + seed), `pnpm db:studio`, `pnpm dev`, `pnpm test`, `pnpm e2e`, `pnpm lhci` (local `next start` run). |
| Node | `.nvmrc` = 22; `packageManager` pinned in `package.json`; `corepack enable`. |
| Hooks | `lefthook`: pre-commit `gitleaks protect`, `eslint --fix` on staged, `prettier`; pre-push `tsc --noEmit`. |
| Admin locally | `http://admin.localhost:3000` with `ADMIN_HOST=admin.localhost:3000`. |

## 4. CI/CD — GitHub Actions (D-1607, FR-OPS-05)

### 4.1 Workflows and jobs

| Workflow | Trigger | Jobs (→ = needs) | Runtime target |
|----------|---------|------------------|----------------|
| `ci.yml` | push to any branch, PR | `setup` (pnpm cache) → `lint` (eslint, prettier check, gitleaks) · `typecheck` (`tsc --noEmit`) · `unit` (vitest project `unit`, coverage to artifact) · `integration` (vitest project `integration` with `services: postgres:16`, runs migrations + custom SQL + seed, finance invariants from docs/10) · `build` (`next build`, uploads `.next` + standalone artifact, `size-limit`, bundle analyzer report) → `e2e` (Playwright desktop Chrome + mobile Chrome on PRs per docs/10 §10; mobile WebKit in the nightly `@full` matrix; against `next start` + postgres service, seeded) · `axe` (Playwright + `@axe-core/playwright` over the screen inventory, both hosts) · `lhci` (docs/11 §B10; against the Vercel preview URL when the PR has one, else local `next start`) | ≤ 12 min wall clock via parallel jobs |
| `preview-db.yml` | PR opened / synchronize / closed | `create-branch` (Neon `preview/pr-<n>` from `staging`, migrate, seed, write `DATABASE_URL` to the Vercel preview via `vercel env add … preview <branch>`) · `delete-branch` on close | |
| `staging.yml` | push to `main` | `migrate-staging` (`drizzle-kit migrate` against Neon `staging` with `DATABASE_URL_UNPOOLED`) → Vercel Git deploy proceeds (Vercel waits on nothing; migrations are additive-first, §5.2) → `smoke` (Playwright `@smoke` tag against staging) | |
| `release.yml` | push of tag `v[0-9]+.[0-9]+.[0-9]+` | `verify-tag` (tag commit is on `main`; `ci.yml` succeeded for that SHA via `gh api checks`) → `backup-pre-deploy` (§5.3 dump labelled `pre-v1.2.3`) → `migrate-production` → `deploy-production` (`vercel pull --environment=production`, `vercel build --prod`, `vercel deploy --prebuilt --prod`; GitHub Environment `production` requires **approval by the other founder** — mirrors BR-13 dual control) → `docker-image` (GHCR `ghcr.io/<org>/codekraft:v1.2.3` + `:latest`, §9) → `smoke-production` (read-only Playwright: `/`, `/products`, product page, login page, admin login page, `/api/health`) → `github-release` (auto-generated notes) | |
| `scheduler.yml` | `schedule: */15 * * * *` and `30 21 * * *` | `tick` → `curl /api/cron/frequent` every 15 min and `/api/cron/daily` once a day on production and staging (§2.3) | disabled after VPS migration |
| `backup.yml` | `schedule: 0 21 * * *` (02:30 IST) + manual | `dump` (§5.3) · weekly `offsite` on Sundays | |
| `lhci-weekly.yml` | `schedule: 0 2 * * 1` | Lighthouse against production public routes, artifact + notification on regression (docs/11 §B13) | |

### 4.2 Caching, concurrency, required checks

| Item | Detail |
|------|--------|
| Caching | `actions/setup-node` with `cache: pnpm`; `actions/cache` on `.next/cache` keyed `${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('src/**') }}` with lockfile-only restore key; Playwright browsers cached by version. |
| Concurrency | `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` on `ci.yml`; `release.yml` never cancels. |
| Required checks on `main` (branch protection) | `lint`, `typecheck`, `unit`, `integration`, `build`, `e2e`, `axe`; `lhci` required when paths under `src/app/(site)`, `src/components/{site,motion,three}`, `src/styles` change (path filter sets a `lhci-required` output). One approving review; both founders are CODEOWNERS of `drizzle/`, `src/modules/finance`, `src/modules/approvals`, `.github/`. |
| Minutes budget | GitHub Free (private repo) = 2 000 min/month. Full `ci.yml` ≈ 25 job-minutes; agents pushing 10×/day exhaust it in ~8 days. Mitigation: `e2e`, `axe`, `lhci` run only on PRs marked ready-for-review and on `main`; pushes to draft branches run `lint/typecheck/unit/integration/build` (≈ 9 min). If still short, GitHub Pro (USD 4/month, 3 000 min) — see §12. |
| Release tagging | Semantic versions `v1.0.0` (release 1 launch), `v1.0.x` fixes, `v1.1.0` for V1.1 items as they ship (docs/13). Tags are annotated (`git tag -a`) by a founder; `verify-tag` rejects tags on non-`main` commits. Changelog from Conventional Commits (`feat:`, `fix:`, `db:`). |

## 5. Database operations (Neon)

### 5.1 Branches

| Neon branch | Env | Created by | Lifetime | Notes |
|-------------|-----|------------|----------|-------|
| `main` | production | founder at project creation | permanent | PITR source; protected (no delete) |
| `staging` | staging | founder | permanent; **reset weekly** from `main` snapshot then `pnpm db:anonymise` (emails → `user-<id>@example.test`, names, phone, bank details, license keys replaced) | keeps staging realistic without PII |
| `preview/pr-<n>` | preview | `preview-db.yml` from `staging` | PR lifetime | Free plan allows 10 branches → CI fails PR creation past 8 open previews with a clear message; close stale PRs |
| `restore-<ts>` | ad hoc | runbook §11.5 | until verified | |

Connection strings use the pooled host for the app (`-pooler`, PgBouncer transaction mode → no `LISTEN/NOTIFY`, no session-level advisory locks; the invoice sequence uses row locks inside a transaction, DB §12, which is fine) and the direct host for migrations and dumps.

### 5.2 Migrations (DB §15)

| Step | Where | Detail |
|------|-------|--------|
| Author | dev | `drizzle-kit generate` → `drizzle/NNNN_<name>.sql`; triggers/views in `drizzle/custom/NNNN_<name>.sql`; one migration per implementation task |
| Test | `integration` job | fresh Postgres → all migrations → seed → tests; a dedicated test asserts append-only triggers reject UPDATE/DELETE (DB §12) |
| Apply | `staging.yml`, `release.yml` | `pnpm db:migrate` with `DATABASE_URL_UNPOOLED` **before** the deploy; migrations must be **expand-first** (add columns nullable / new tables / new enum values) so the previous app version keeps running during the deploy; destructive steps (drop, rename, `NOT NULL` backfill) ship one release later ("contract") |
| Locking | runner | `drizzle-kit migrate` takes an advisory lock; two concurrent releases are prevented by `concurrency: release` in the workflow |
| Rollback | — | forward-only; a bad migration is reverted by a new migration or by restore (§11.5). The `backup-pre-deploy` job makes this safe |
| Seed | `pnpm db:seed [--production]` | idempotent upserts keyed by natural keys (role key, setting key, product slug); production seed run once by `release.yml` when `site_settings.seeded_at` is null |

### 5.3 Backups (A-1401) and restore drill

| Layer | Mechanism | Retention | Notes |
|-------|-----------|-----------|-------|
| Neon PITR | built-in history on `main` | Free plan: hours (currently 6 h; **not** the 7 days A-1401 assumes — the 7-day retention comes from the nightly dump below, MASTER_SPEC §7 "Backups"); Launch plan 7 days | fastest restore for "I deleted the wrong thing an hour ago" |
| Nightly logical dump | `backup.yml`: `pg_dump -Fc --no-owner` via `DATABASE_URL_UNPOOLED` → `age -r <founders' public keys>` (or `openssl enc -aes-256-cbc -pbkdf2` with `BACKUP_ENCRYPTION_KEY`) → `codekraft-backups/daily/codekraft-<date>.dump.age` in R2 | 7 days (R2 lifecycle rule) | satisfies "daily, 7-day retention" |
| Weekly off-site | Sunday job copies the day's dump to `weekly/` in a **second R2 bucket in a different Cloudflare account** (the other founder's) or to Backblaze B2 (10 GB free); | 8 weeks | satisfies "weekly off-site copy" (Neon and Cloudflare are already different providers; the second account protects against a compromised Cloudflare login) |
| Pre-deploy | `release.yml` dump labelled `pre-<tag>` | 30 days | rollback anchor |
| Documents | invoice/credit-note PDFs live in `codekraft-documents` (7-year retention, BR-18) and can be regenerated from immutable `invoices` rows | never deleted | |
| Verification | `backups.verify` daily job checks object exists and size > 100 KB; **monthly restore drill** (first Monday): restore latest dump into Neon branch `restore-drill`, run `pnpm db:verify` (row counts vs production, `partner_balances` totals, append-only triggers present, latest invoice number matches), record result in `docs/ops/restore-log.md`, delete branch | RTO 1 h; RPO 24 h (nightly) or minutes inside the PITR window |

## 6. Object storage — Cloudflare R2 (D-1402, R-1402)

| Bucket | Visibility | Contents | Access path | Lifecycle |
|--------|-----------|----------|-------------|-----------|
| `codekraft-public` | public via `media.<domain>` (custom domain, Cloudflare cache on) | product images, gallery, posters, client logos, OG uploads, self-hosted video (A-1402) | direct URL; keys `media/<yyyy>/<mm>/<uuid>.<ext>` are content-addressed → `Cache-Control: public, max-age=31536000, immutable` | `tmp/` prefix expires after 1 day; abort incomplete multipart after 1 day |
| `codekraft-private` | private | downloadable release files (T-release_files), product attachments, query attachments | presigned GET 5 min (NFR-SEC-04) after entitlement + cap check (BR-15) | abort multipart 1 day; nothing auto-deleted (release files live as long as the product) |
| `codekraft-documents` | private | invoices, credit notes, partner statements (PDF) | presigned GET 5 min; keys `invoices/<fy>/<invoice_no with '/'→'-'>.pdf` | none (7 years, BR-18) |
| `codekraft-backups` | private | encrypted dumps | CI only | `daily/` 7 days, `pre-*/` 30 days, `weekly/` 56 days |

CORS (public and private buckets): `AllowedOrigins` = the env's site and admin origins + `http://localhost:3000`; `AllowedMethods` = `PUT, GET, HEAD`; `AllowedHeaders` = `Content-Type, Content-Length, Content-MD5`; `MaxAgeSeconds` 3600. Uploads are presigned PUTs with a fixed `Content-Type` and `Content-Length` range (FR-CONT-06 caps), recorded in `files_upload_intents` and confirmed by the server (`HEAD` the object, verify size and MIME sniff) before a `media` row exists. API token: one per environment, scoped to that environment's buckets, object read/write only (docs/09 §8). Storage widget: daily job sums `media.size_bytes` per bucket and warns at 7 GB (70 % of free tier, NFR-OPS-03).

## 7. Email — Resend (D-1403)

| Item | Detail |
|------|--------|
| Domain | Resend can only deliver to the account owner's address until a domain is verified. **A sending domain is therefore a launch prerequisite** even while hosting stays on Vercel (MASTER_SPEC §7 "Domain before launch", docs/13 E-06). Verify `<domain>` (or a subdomain the founder already owns) in Resend; sending subdomain `send.<domain>`. |
| DNS records | DKIM: TXT `resend._domainkey.<domain>` (value from Resend). SPF: TXT `send.<domain>` = `v=spf1 include:amazonses.com ~all`. Return-path: MX `send.<domain>` → `feedback-smtp.<region>.amazonses.com` priority 10. DMARC: TXT `_dmarc.<domain>` = `v=DMARC1; p=none; rua=mailto:dmarc@<domain>` → raise to `p=quarantine` after two clean weeks. |
| Sender | `CodeKraft <hello@<domain>>`; reply-to a founder mailbox (never published on the site — D-808; it is fine inside transactional mail and on invoices, D-406). |
| Templates (`src/emails/`, react-email) | `verify-email`, `reset-password`, `one-time-login`, `order-created-instructions` (UPI QR / bank details, A-601), `payment-submitted-ack`, `payment-confirmed-invoice` (PDF attached), `delivery-saas-credentials`, `delivery-license-key` (dashboard link only; the key is never in the email — MASTER_SPEC §7 "License key delivery", docs/09 TM-05), `delivery-download-ready`, `service-step-update`, `subscription-reminder` (T-7, T-1), `subscription-grace`, `subscription-suspended`, `query-reply`, `refund-credit-note`, `quote-sent`, `account-deleted`, `admin-overdue-digest` (R-701), `admin-invite`. Emails are always ink-on-white, independent of the site theme (MASTER_SPEC §7 "Print/PDF/email theming"), as plain, table-based HTML. |
| Delivery | `email_outbox` row written in the domain transaction; `notifications/channels/email.ts` sends immediately and marks `sent`; failures retried by `email.outbox_retry` with backoff (5 attempts). Free tier: 3 000/month, **100/day** — `NFR-OPS-02`; the outbox defers non-urgent mail (digests, reminders) when the daily counter reaches 90. |
| Webhook | `POST /api/webhooks/resend` (`RESEND_WEBHOOK_SECRET`, Svix signature) → `webhook_events` (DB §11) → bounce/complaint marks `email_outbox.status='failed'`, flags the user, and raises an admin notification. |

## 8. Monitoring, logging, secrets

### 8.1 Monitoring (A-1401)

| Signal | Tool | Configuration | Alert path |
|--------|------|---------------|------------|
| Errors | Sentry (free Developer plan; one seat) | `@sentry/nextjs` client + server + edge configs; `release = tag`, `environment = APP_ENV`; `tracesSampleRate 0.1`, no Replay; `beforeSend` scrubs cookies, headers, bodies, emails (docs/09 TM-23); source maps uploaded in `build` with `SENTRY_AUTH_TOKEN`; ignore `ResizeObserver loop`, WebGL context-loss handled in app | Sentry email alert to both founders on new issue or > 10 events/h |
| Uptime | UptimeRobot / Better Stack free tier (5-min interval) | monitors: `https://<site>/api/health` (returns `{ok, version, db:'ok', time}` after `SELECT 1`, `Cache-Control: no-store`), `https://<admin>/api/health`, `https://<site>/` (keyword "CodeKraft"); staging monitored without alerts | email + push to both founders; this is an ops alert, outside D-707's in-app-only admin alerts, which cover business events |
| Jobs | `job_runs` + `health.jobs_check` | each job has `expected_interval`; missed → in-app notification to super admins + red on System widget (arch §10) | in-app (D-707) |
| Vitals | docs/11 §B10 | p75 per route in System widget | in-app after 7 bad days |
| Business | admin widgets | payments awaiting confirmation > 48 h, approvals pending > 72 h, email outbox failures, R2 usage > 70 %, Neon storage > 400 MB, chat cap hits | in-app |
| Error budget | 99.5 % monthly availability for public routes (≈ 3 h 36 min); 99 % for `/api/cron` on-time execution; INP/LCP per docs/11 | Budget exhausted → freeze feature releases until fixed (founders' rule) |

### 8.2 Logging (docs/09 §10)

`lib/logger` = pino, JSON lines to stdout, fields `ts, level, env, requestId, route, method, status, durationMs, userId (uuid, never email), module, msg`. Vercel keeps Hobby logs 1 h (Pro 1 day) — Sentry breadcrumbs and `audit_logs`/`job_runs` in Postgres are the durable records. Redaction list (pino `redact`): `password, token, secret, authorization, cookie, set-cookie, license_key, licenseKey, bank, account_number, ifsc, upi, otp, apiKey, x-api-key, presignedUrl, url.query.token`. Never logged: request bodies on `/api/auth/*`, checkout and payment actions, chat message text (token counts only), presigned URLs, Anthropic prompts. On the VPS, Docker `json-file` driver with `max-size 50m, max-file 5`; optional Grafana Loki later.

### 8.3 Secrets management and rotation (docs/09 §8)

| Secret | Store | Rotate | Procedure |
|--------|-------|--------|-----------|
| `DATABASE_URL*` | Vercel (Sensitive) / GitHub env / server `.env` | quarterly or on exposure | Neon → reset role password → update both URLs in every env → redeploy; old password valid until reset so no downtime |
| `BETTER_AUTH_SECRET` | same | on exposure only | schedule at low traffic, announce (all sessions end), update, redeploy |
| `APP_ENCRYPTION_KEY` | same + founders' password manager | on exposure; otherwise never casually | add `v2:` key alongside `v1:`; run `pnpm keys:reencrypt` (re-encrypts `license_key_enc`, `payout_bank_details_enc`, `two_factor.secret`); remove `v1:` next release |
| R2 token | Cloudflare | quarterly | create new token → deploy → delete old |
| `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET`, `SENTRY_AUTH_TOKEN`, `CRON_SECRET`, `RESEND_WEBHOOK_SECRET` | provider dashboards | quarterly | create → deploy → revoke old; `CRON_SECRET` also updated in `scheduler.yml` secrets |
| Google OAuth client secret | Google Cloud | yearly | add second secret → deploy → delete first |
| `BACKUP_ENCRYPTION_KEY` / age keys | GitHub secret + password manager (both founders) | never rotate without re-encrypting retained dumps | |
| GitHub Environments | `staging` (no reviewers), `production` (required reviewer: the other founder; secrets only readable by `release.yml`) | | |

`.env.example` lists every variable name with an empty value; `gitleaks` runs pre-commit and in `lint`.

## 9. Migration to purchased hosting (D-1401, D-1606, FR-OPS-02)

### 9.1 Target

A Node-capable host (R-1401): a VPS with 2 vCPU / 4 GB RAM / 40 GB SSD, Ubuntu 24.04, Docker + Compose plugin (Hetzner CX22-class ≈ EUR 4–8/month, or DigitalOcean/Linode equivalent; an Indian provider is acceptable if it offers plain Ubuntu VMs). Managed alternatives (Render, Railway, Fly.io) run the same image but cost more at idle. Neon, R2, Resend, Sentry, Umami stay as they are — only compute moves. Moving Postgres onto the VPS is a separate, later decision (§9.6).

### 9.2 Image and compose

| File | Content |
|------|---------|
| `Dockerfile` | multi-stage: `deps` (`node:22-alpine`, `pnpm fetch`), `build` (`pnpm build` with `output: 'standalone'`, `NEXT_TELEMETRY_DISABLED=1`, build args for `NEXT_PUBLIC_*`), `runner` (copies `.next/standalone`, `.next/static`, `public`; user `node`; `HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/api/health`; `CMD ["node","server.js"]`). Built by `release.yml`, pushed to GHCR (private; 500 MB storage on GitHub Free → keep the two latest tags). |
| `docker-compose.prod.yml` | `app` (image `ghcr.io/<org>/codekraft:<tag>`, `env_file: /srv/codekraft/.env`, `restart: unless-stopped`, volume `next-cache:/app/.next/cache` for ISR and image-optimizer cache, `expose: 3000`); `scheduler` (same image, `command: ["node","scheduler.js"]`, `RUN_SCHEDULER=true`, `deploy.replicas: 1`); `caddy` (`caddy:2`, ports 80/443, volumes `caddy_data`, `Caddyfile`). |
| `Caddyfile` | `<domain>, admin.<domain> { encode zstd gzip; reverse_proxy app:3000; header { Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" } }` and `www.<domain> { redir https://<domain>{uri} permanent }`. Security headers and CSP stay in `next.config.ts` (docs/09 §9) so both hosts behave identically; Caddy only adds HSTS and compression. TLS via Let's Encrypt automatically. |
| Deploy script | `/srv/codekraft/deploy.sh <tag>`: `docker compose pull` → run migrations in a one-off container (`docker compose run --rm app node migrate.js`) → `docker compose up -d` → wait for healthcheck → `curl /api/health`. Called by `release.yml` over SSH (`appleboy/ssh-action`) once `DEPLOY_TARGET=vps` is set in the `production` environment. |

### 9.3 Env parity

| Concern | Vercel | Container | Action |
|---------|--------|-----------|--------|
| Cron | Vercel Cron + `scheduler.yml` | `scheduler` container (node-cron) | set `RUN_SCHEDULER=true` on one container; delete Vercel crons and disable `scheduler.yml` **before** cutover to avoid double runs (jobs are idempotent, but email digests would duplicate) |
| Image optimisation | Vercel optimizer | in-process sharp, cache on `next-cache` volume | `images.minimumCacheTTL` 86400; disk watch |
| ISR cache | Vercel data cache | filesystem in `.next/cache` (single instance, fine) | volume mounted |
| OG images, PDFs | Node runtime functions | same (no `runtime='edge'` anywhere — arch §11) | lint rule forbids `export const runtime = 'edge'` |
| Logs | Vercel | Docker json-file | §8.2 |
| Secrets | Vercel env | `/srv/codekraft/.env` (mode 600, owned by deploy user) written from the founders' password manager; or `sops` + age | same variable names (§2.2) |
| Function timeout | 60 s | none | PDF generation and chat streaming unaffected |
| Host detection | `ADMIN_HOST` | `ADMIN_HOST` | unchanged |
| Health | `/api/health` | `/api/health` + Docker healthcheck | |

### 9.4 DNS cutover steps

1. The domain was bought before release 1 (E-06) and its DNS is already on Cloudflare (R2 custom domain `media.<domain>`, Resend records §7). It was added to Vercel at launch (§2.1) so canonical URLs, Resend, Google OAuth, Turnstile hostnames, Umami and Sentry allowed domains are already on `<domain>` while still on Vercel — the VPS move then changes only A/AAAA records.
2. 24 h before: set TTL 300 s on `@`, `www`, `admin`.
3. Provision VPS; `ufw` allow 22/80/443; create deploy user; install Docker; copy `.env`, `docker-compose.prod.yml`, `Caddyfile`; `docker login ghcr.io`.
4. `deploy.sh <current production tag>` with `RUN_SCHEDULER=false`; verify with `curl --resolve <domain>:443:<ip> https://<domain>/api/health` and the smoke checklist (§9.5) via `--resolve` for both hosts (Caddy can be pointed at a staging cert issuer first to avoid Let's Encrypt rate limits).
5. Freeze: announce a 30-min window to the other founder; no admin mutations; delete Vercel crons; disable `scheduler.yml`.
6. Flip A/AAAA for `@`, `www`, `admin` to the VPS (Cloudflare proxy **off** initially so Caddy can complete ACME; turn the orange cloud on later if wanted). Caddy obtains certificates within a minute.
7. Set `RUN_SCHEDULER=true` and `docker compose up -d scheduler`; run the smoke checklist on the live hostnames; check `job_runs` gets a `frequent` row within 15 min.
8. Keep the Vercel deployment alive for 48 h as rollback (same Neon DB, so no data divergence; Vercel serves nothing once DNS moves).
9. After 48 h: set `DEPLOY_TARGET=vps` in the `production` GitHub Environment so `release.yml` deploys over SSH; remove the Vercel production project (keep `codekraft-staging` for previews or move staging to a second compose stack on the same VPS with `staging.<domain>`).

### 9.5 Smoke-test checklist (run on every production deploy, either host)

| # | Check | Expect |
|---|-------|--------|
| 1 | `GET /api/health` on site and admin hosts | 200, `db: ok`, version = tag |
| 2 | `/` renders, LCP poster visible, no console errors, Umami beacon sent | |
| 3 | `/products` lists published, hides unlisted; `/products/<seeded>` shows offerings and JSON-LD validates | |
| 4 | `/sitemap.xml`, `/robots.txt` correct for host; admin host returns `Disallow: /` and `X-Robots-Tag` | |
| 5 | Register test account → verification email arrives (Resend) → login → single-session enforced | |
| 6 | Google OAuth round trip on `<domain>` | |
| 7 | Checkout a seeded offering → order `pending_payment`, UPI QR renders, instructions email sent | |
| 8 | Admin login on admin host, TOTP prompt, dashboard widgets load, notification poll returns 200 | |
| 9 | Admin confirms the test payment → order `paid`, ledger entries and allocations written, invoice PDF in R2, presigned download works, email with PDF sent | |
| 10 | Download a release file → 5-min presigned URL, `downloads` row, cap decremented | |
| 11 | Chatbot answers a menu intent and one AI question (or falls back cleanly) | |
| 12 | Upload an image in admin → presigned PUT to R2 → appears via `media.<domain>` through `next/image` | |
| 13 | Trigger `/api/cron/frequent` with the secret → 200, `job_runs` rows; without secret → 401 | |
| 14 | Security headers present (CSP, HSTS, `frame-ancestors`) on both hosts (docs/09 SA-18) | |
| 15 | Refund the test order via approval flow (second founder approves) → credit note, entitlement revoked; then cancel the test account | |

### 9.6 Later options

Moving Postgres to the VPS (`postgres:16` service with a volume, nightly `pg_dump` continues) removes the Neon dependency and cold starts but makes the founders responsible for durability; do it only after two clean restore drills. Umami can be self-hosted in the same compose file (`ghcr.io/umami-software/umami`) if the Cloud free tier is exceeded.

## 10. Rollback procedure

| Situation | On Vercel | On VPS |
|-----------|-----------|--------|
| Bad release, no DB change | Vercel dashboard *Instant Rollback* to the previous production deployment, or `release.yml` re-run on the previous tag | `deploy.sh <previous tag>` (image still in GHCR) |
| Bad release with additive migration | roll back the app only; the extra columns/tables are harmless (§5.2) | same |
| Bad release with data corruption | restore per §11.5 from `pre-<tag>` dump into a new Neon branch, verify, switch `DATABASE_URL`, redeploy previous tag; **reconcile invoices issued after the dump** against `codekraft-documents` PDFs and email log because invoice numbers are gapless (BR-16) | same |
| Bad DNS cutover | flip A/AAAA back to Vercel (TTL 300 s) | — |
| Bad feature | turn its flag off in admin settings (arch §7.9) — no deploy | same |

Every rollback is recorded as an `audit_logs` row (`action='ops.rollback'`) by the founder through the admin System page, plus a GitHub issue.

## 11. Runbooks

| # | Runbook | Symptoms | Steps |
|---|---------|----------|-------|
| 11.1 | **Payment confirmation stuck** | Customer submitted a UTR but admin queue is empty, or "Confirm" fails | (1) `SELECT id,status,customer_reference FROM payments WHERE order_id=…` — if `submitted`, check `notifications` for the admin row and `email_outbox`; (2) if confirm fails, read the Sentry event: most common cause is no `active` `product_ownerships` version for the product (BR-05) → create and approve the ownership, retry; second cause is `invoice_sequences` lock timeout → retry; (3) never edit `payments`/`ledger_entries` by hand (BR-17); if a wrong confirmation happened, use refund + re-confirm via approval; (4) reply to the customer from the order's query thread. |
| 11.2 | **Cron missed** | System widget shows a job red; orders not expiring; reminders late | (1) check `job_runs` for the last row per job; (2) Vercel → *Cron Jobs* log, or GitHub → `scheduler.yml` runs, or `docker logs codekraft-scheduler`; (3) trigger manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/daily`; jobs are idempotent (FR-OPS-01); (4) if `CRON_SECRET` mismatch (401) → rotate per §8.3; (5) if Hobby cron quota hit → rely on `scheduler.yml` or move to Pro. |
| 11.3 | **R2 outage** | uploads fail, downloads 5xx, invoice PDF missing | (1) confirm on cloudflarestatus.com; (2) catalog keeps rendering from `next/image` cache; (3) `invoices` rows with `pdf_media_id IS NULL` are regenerated by `invoices.regenerate_pending` on the next `frequent` run (§2.3) — customers are emailed when the PDF exists; (4) put the admin banner "Uploads temporarily unavailable" (site setting `ops_banner`); (5) no data loss: every object is re-creatable except customer query attachments — those are retried from the browser. |
| 11.4 | **Anthropic outage / key exhausted** | chatbot replies with menus only; Sentry shows `AnthropicProvider` errors | (1) nothing breaks — fallback is by design (arch §10); (2) check console.anthropic.com for status/spend cap; (3) optionally switch `site_settings.ai_model` to the cheaper model; (4) if the key leaked, rotate (§8.3); (5) `chat_usage_daily` is not incremented for failed calls — verify. |
| 11.5 | **DB restore** | data loss, corruption, bad migration | (1) freeze admin mutations (announce); (2) inside PITR window: Neon → *Restore* → branch `main` at timestamp → verify on the new branch (`pnpm db:verify`) → set it as primary or point `DATABASE_URL` at it; (3) outside window: download latest `daily/` or `pre-<tag>` dump, `age -d` / `openssl dec`, `pg_restore -d <new branch URL> --no-owner`, verify, switch, redeploy; (4) reconcile: invoices emailed after the restore point (compare `codekraft-documents` listing vs `invoices`), payments confirmed after it (bank statement), audit entries; post `adjustment` ledger entries with dual approval where money moved; (5) write the incident note. |
| 11.6 | **Rotate keys** | quarterly reminder, exposure, founder change | follow §8.3 row by row; for a departing partner also: revoke `user_roles` via `admin.user_change` approval, delete sessions, rotate R2/Resend/Anthropic keys they could have seen, remove them from GitHub, Vercel/VPS SSH, Cloudflare, Neon, Sentry. |
| 11.7 | **Neon free-tier limits hit** | `compute hours exhausted` or storage 0.5 GB reached → connections refused | (1) upgrade Neon to Launch (USD 19/month) — fastest; or (2) reduce compute: increase admin poll interval to 30 s (arch §7.5 allows), confirm `suspend after 5 min` is on; (3) storage: run `retention.purge`, check `analytics_events` growth (add monthly rollup + purge > 13 months). |
| 11.8 | **Resend daily cap (100) reached** | outbox rows stay `queued` | expected behaviour; digests deferred; verification/reset mails are prioritised by the outbox (priority column); if this recurs, upgrade Resend or move admin digests to in-app only. |
| 11.9 | **Approval stalled (one admin unreachable)** | approval request pending > 72 h | there is no bypass by design (BR-13); notify the other founder out of band; the System widget shows pending age. |

## 12. Cost table — free tiers and exhaustion points

| Service | Free tier (verify at signup; figures as of 2026-09) | Exhausted when | Next step / cost |
|---------|------------------------------------------------------|----------------|------------------|
| Vercel Hobby | 100 GB bandwidth, 1 M function invocations-class limits, 2 daily crons, 1 member, no commercial use | **immediately for commercial use** (R-1401); second founder needs access; hourly cron | Pro USD 20/member/month, or VPS (§9) |
| Neon Free | 0.5 GB storage, 190 CU-hours/month (≈ always-on at 0.25 CU with autosuspend), 10 branches, PITR ≈ 6 h | storage > 0.5 GB (analytics/audit growth, ~2–3 years at this volume) or > 8 open preview branches | Launch USD 19/month (7-day PITR, 10 GB) |
| Cloudflare R2 | 10 GB storage, 1 M Class A + 10 M Class B ops/month, no egress fees | video uploads (R-1402): ~50 videos at 200 MB | USD 0.015/GB-month; enforce embed-first |
| Resend | 3 000 emails/month, 100/day, 1 domain | > 100 mails in a day (mass reminder) | Pro USD 20/month (50 k) |
| Umami Cloud Hobby | ~100 k events/month, 3 websites | traffic spike or many custom events | USD 20/month or self-host on the VPS |
| Cloudflare Turnstile | free | — | — |
| Sentry Developer | 5 k errors, limited spans, 1 seat | an error loop; second seat | Team USD 26/month |
| Anthropic API | **no free tier**; prepaid credits (min USD 5) | never at D-708 caps (arch §9: well under USD 1–5/month) | pay as you go; set spend cap |
| open.er-api.com | 1 500 requests/month | never (1 request/day) | — |
| Google OAuth | free | — | — |
| GitHub Free (private repo) | 2 000 Actions min/month, 500 MB Packages, 2 GB LFS | heavy agent activity (§4.2) | Pro USD 4/month (3 000 min) or trim CI |
| UptimeRobot free | 50 monitors, 5-min checks | — | — |
| Domain | — | at purchase | ≈ INR 800–1 500/year (.com/.in) |
| VPS | — | at migration | ≈ INR 400–800/month (EUR 4–8) |
| **Interim monthly total** | **USD 0 + Anthropic credits** | | **After V1.1 migration: ≈ USD 8–12/month + domain; without VPS but on Vercel Pro: USD 20–40/month** |

---

## Open inconsistencies

1. Resolved: `ADMIN_HOST` is matched exactly (no prefix fallback) — docs/04 §8, docs/09 §3.5 and MASTER_SPEC §7 "Admin host during interim" now say so; §2.1 updated.
2. Resolved: MASTER_SPEC §7 "Backups" states that the 7-day retention comes from the nightly encrypted `pg_dump` to R2 (§5.3), not from Neon Free PITR.
3. Resolved: the domain is a release-1 entry criterion (MASTER_SPEC §7 "Domain before launch", docs/13 E-06); hosting migration stays in V1.1. Header, §2.1 and §9.4 updated.
4. Resolved: docs/04 §4 and MASTER_SPEC §7 "Cron on free tier" name the GitHub Actions scheduler as the trigger for `frequent`/`daily` on Vercel Hobby (§2.3).
5. Resolved: MASTER_SPEC §7 records that Vercel Hobby is single-member, so only one founder has dashboard access until Pro or the VPS (§2.1).
6. Resolved: FR-CONT-06 keeps the 200 MB per-file video ceiling; docs/11 §B5 recommends ≤ 50 MB in the admin UI; §12 uses the ceiling for the exhaustion estimate. No contradiction.
7. Resolved (decision recorded here): Neon Singapore (`ap-southeast-1`) with Vercel `bom1`; docs/04 leaves the region open, so this is the operative choice; revisit if traffic is mostly non-Indian.
8. Resolved: anonymisation is immediate in the delete transaction (MASTER_SPEC §7 "Anonymisation timing"); `users.anonymise` is a safety sweep only (§2.3).

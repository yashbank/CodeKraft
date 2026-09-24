# PHASE-01 — Foundation & tooling

**Wave:** W1 (solo, 1 senior + 1 support) · **Roadmap items:** R1-01, R1-03, R1-04 (auth core), R1-24 (health) · **Master plan §6 gate:** lint, typecheck, unit smoke, e2e: login/logout, admin host isolation, theme attribute present.

## Phase objective

Produce a runnable, deployable Next.js 15 skeleton that every later phase builds on without touching the foundation again: strict TypeScript, design tokens with Theme 1 live and Theme 2 present-but-flagged, shadcn primitives proven on a kitchen-sink page, Postgres + Drizzle client, Better Auth (email/password + verification, Google, TOTP, single session, idle timeouts, argon2id), RBAC library with the exact permission list of `docs/06` §1.2, `ADMIN_HOST` middleware, shared libs (money, env, logger, flags, errors, email transport, crypto), Sentry, the full test harness (Vitest unit/integration, Testcontainers, Playwright with two hosts, axe, LHCI, size-limit, fast-check) and `ci.yml`. After P1 the repo answers "can an agent clone, run, test and deploy this?" with yes.

## Prerequisites

- Docs frozen: `MASTER_SPEC.md`, `docs/04`, `docs/05`, `docs/06` §1, `docs/08`, `docs/09` §3–§4, `docs/10` §1–§4, `docs/12` §2–§4, `ui/theme-01/*`, `ui/theme-02/*`.
- Roadmap entry criteria E-02 (accounts) at least for GitHub, Neon (optional for P1 — local Docker suffices), Google OAuth client (test), Sentry DSN (may be empty in local).
- Env/secrets available locally via `.env.local`: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID/SECRET` (may be dummy in CI with mocked OAuth), `APP_ENCRYPTION_KEY`, `ADMIN_HOST=admin.localhost:3000`, `APP_ENV=local`, `EMAIL_TRANSPORT=log`, `CRON_SECRET`.
- No earlier phase.

## Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P1.1 | Repository scaffold, toolchain, Docker | domain-standard | — |
| P1.2 | Design tokens, Theme 1 live, Theme 2 sheet, Tailwind v4 bridge | UI builder | P1.1 |
| P1.3 | shadcn base components + `/dev/ui` kitchen sink | UI builder | P1.2 |
| P1.4 | Database client, env validation, core libs (money, logger, errors, flags, crypto, fx stub, rate-limit stub) | domain-critical | P1.1 |
| P1.5 | Better Auth integration (email/password + verify, Google, TOTP, single session, idle timeouts, argon2id, audit hooks) | domain-critical | P1.4 |
| P1.6 | RBAC library, permission list, `requireContext`, action envelope | domain-critical | P1.4 |
| P1.7 | `middleware.ts` ADMIN_HOST rewrite, route-group layouts, theme attribute resolution, health endpoint | domain-critical | P1.5, P1.6, P1.2 |
| P1.8 | Sentry, email transport (react-email + Resend + outbox/log transports), analytics/Umami placeholder | domain-standard | P1.4 |
| P1.9 | Test harness (Vitest projects, Testcontainers, Playwright two-host, axe, LHCI, size-limit, fast-check) | domain-standard | P1.1 |
| P1.10 | GitHub Actions `ci.yml` + lefthook + branch-protection doc | domain-standard | P1.9 |
| P1.11 | `PROGRESS.md`, `ISSUES.md`, `CHANGELOG.md`, `scripts/seed.ts` skeleton (roles + permissions only) | domain-standard | P1.6 |
| P1.12 | Phase-1 e2e gate + reviewer audit | reviewer | all |

### P1.1 Repository scaffold, toolchain, Docker
- Owner profile: domain-standard
- Requirement IDs: FR-OPS-02, NFR-PORT-01, NFR-DATA-03 (lint rule), D-1401, D-1404, D-1607, R1-01
- Description: Create the pnpm workspace (`packageManager` pinned, `.nvmrc`=22, `corepack`), Next.js 15 App Router with React 19, TypeScript `strict` + `noUncheckedIndexedAccess`, `next.config.ts` with `output: 'standalone'`, `images.remotePatterns` for `NEXT_PUBLIC_MEDIA_BASE_URL`, `experimental.serverActions.allowedOrigins` for both hosts. ESLint (`next/core-web-vitals`, `jsx-a11y`, `@typescript-eslint` strict) plus three custom rules: no `Number`/float arithmetic in `src/modules/finance|payments|orders|invoices` (NFR-DATA-03), no `export const runtime = 'edge'` (docs/12 §9.3), no hardcoded colour literals in `src/components/**` (docs/10 §7). Prettier. Directory skeleton exactly per `docs/04` §5 (`src/app/(site)|(auth)|(account)|(admin)|api`, `src/modules`, `src/components/{ui,site,account,admin,motion,three}`, `src/styles`, `src/lib`, `src/emails`, `src/pdf`, `src/jobs`, `drizzle`, `tests`). `Dockerfile` (multi-stage `deps/build/runner`, user `node`, `HEALTHCHECK` on `/api/health`) and `docker-compose.yml` with `postgres:16-alpine`, optional `minio` + `minio-mc` (creates the four buckets) and `mailpit` per docs/12 §3. `.env.example` listing every variable in docs/12 §2.2 with empty values. Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:unit`, `test:integration`, `e2e`, `lhci`, `db:migrate`, `db:seed`, `db:reset`, `db:studio`, `size`.
- Owned paths: `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `.nvmrc`, `.env.example`, `.gitignore`, `Dockerfile`, `docker-compose.yml`, `docker/**`, `src/app/layout.tsx` (placeholder), `src/app/page.tsx` (placeholder), `README.md`. Forbidden: `src/modules/**`, `drizzle/**`, `.github/**` (P1.10).
- Dependencies: none.
- Expected files/modules: all of the above plus `docker/postgres/init.sql` (creates `codekraft` db + `app` role without TRUNCATE, docs/09 TM-14), `eslint-rules/no-float-money.js`, `eslint-rules/no-edge-runtime.js`, `eslint-rules/no-hardcoded-colors.js`.
- Tests required: `tests/unit/lint-rules/no-float-money.test.ts`, `no-edge-runtime.test.ts`, `no-hardcoded-colors.test.ts` (rule fixtures pass/fail); `pnpm build` succeeds; `docker build` succeeds in CI `build` job.
- Acceptance criteria:
  - [ ] `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm build` green on a clean clone
  - [ ] `docker compose up -d postgres` gives a reachable Postgres 16 on 5432 with db `codekraft`
  - [ ] `docker build .` produces an image that starts and answers `/api/health` (after P1.7)
  - [ ] the three custom lint rules fail on their negative fixtures
  - [ ] `.env.example` contains every name from docs/12 §2.2 (unit test diffs against a list)
- Definition of Done: code + rule tests + README quick-start + PROGRESS row + CI green (once P1.10 lands, retro-run).
- Potential risks and mitigations: Next 15 / React 19 peer-dependency churn with shadcn and react-grid-layout → pin exact versions in `package.json` and record them in `CHANGELOG.md`; agents adding Vercel-only APIs → lint rule + review checklist.

### P1.2 Design tokens, Theme 1 live, Theme 2 sheet, Tailwind v4 bridge
- Owner profile: UI builder
- Requirement IDs: NFR-THEME-01, FR-A11Y-01, FR-A11Y-02, D-011, D-902, D-903, D-905, D-907, R1-03, MASTER_SPEC §4.6, §7 "Theme 2 in release 1"
- Description: Implement `docs/08` §4–§5 and §14: `src/styles/tokens.css` (primitive palette on `:root`, `@theme inline` Tailwind v4 bridge, shadcn alias variables, global reduced-motion rule), `src/styles/themes/dark-cinematic.css` and `src/styles/themes/light-editorial.css` copied verbatim from `ui/theme-01/dark-cinematic.md` §6 and `ui/theme-02/light-editorial.md` §6, both under `[data-theme="…"]` selectors with `color-scheme`. `src/styles/motion.ts` typed motion tokens; `src/lib/status-tone.ts` enum → tone map from docs/08 §6.8. Fonts via `next/font` (≤ 2 families, `display: swap`). Both theme sheets ship in the single CSS bundle; only the toggle is flagged (P7). Add `tests/unit/tokens.test.ts` asserting token parity (every semantic token defined in both themes) and contrast ≥ 4.5:1 for text/background pairs listed in docs/08 §5.2.
- Owned paths: `src/styles/**`, `src/lib/status-tone.ts`, `src/app/globals.css`, `public/brand/**`, `public/noise.png`, `tests/unit/tokens.test.ts`. Forbidden: `src/components/**` (P1.3), `middleware.ts`.
- Dependencies: P1.1.
- Expected files/modules: `src/styles/tokens.css`, `src/styles/themes/dark-cinematic.css`, `src/styles/themes/light-editorial.css`, `src/styles/motion.ts`, `src/lib/status-tone.ts`, `src/lib/fonts.ts`.
- Tests required: `tests/unit/tokens.test.ts` (parity + contrast); lint rule from P1.1 passes on `src/styles`.
- Acceptance criteria:
  - [ ] every semantic token in docs/08 §5.2 exists in both theme files with identical names
  - [ ] contrast test passes for both themes
  - [ ] `[data-theme="light-editorial"]` renders correctly on `/dev/ui` when the attribute is forced manually (no toggle yet)
  - [ ] no component or stylesheet references a theme name outside the two theme files
- Definition of Done: code + tokens test + docs/08 §15 corrections if any + PROGRESS row + CI green.
- Potential risks and mitigations: Tailwind v4 `@theme inline` and shadcn CSS-variable expectations drift → keep the shadcn alias block exactly as docs/08 §4.4; token names typo'd across themes → parity test.

### P1.3 shadcn base components + `/dev/ui` kitchen sink
- Owner profile: UI builder
- Requirement IDs: NFR-THEME-01, FR-A11Y-01, NFR-A11Y-01, docs/08 §6, master plan §7 "UI agents drift from design tokens"
- Description: Install the shadcn set listed in docs/08 §14 (button, input, textarea, select, checkbox, radio-group, switch, dialog, sheet, tabs, table, badge, sonner, tooltip, popover, dropdown-menu, command, accordion, progress, skeleton, avatar, separator, sidebar, breadcrumb, pagination) unmodified except the size/variant additions in docs/08 §6.1–§6.18. Build `src/app/dev/ui/page.tsx` (route `/dev/ui`, returns 404 when `APP_ENV === 'production'`) rendering every component in every variant/state, a `data-theme` switcher, a money/date formatting panel (uses P1.4 `lib/money`) and the status-badge matrix from docs/08 §6.8. P7/P8 may only use components present here.
- Owned paths: `src/components/ui/**`, `src/app/dev/**`, `components.json`. Forbidden: `src/components/{site,account,admin,motion,three}/**`.
- Dependencies: P1.2 (tokens), P1.4 (`lib/money` for the formatting panel; stub until it lands).
- Expected files/modules: `src/components/ui/*.tsx` (≥ 25 files), `src/app/dev/ui/page.tsx`, `src/app/dev/ui/sections/*.tsx`.
- Tests required: `tests/unit/components/ui/*.test.tsx` (Testing Library, jsdom): each component renders, exposes role/label, keyboard operable (dialog Escape closes, tabs arrow keys); `tests/e2e/dev-ui.spec.ts` axe scan of `/dev/ui` in both themes (zero serious/critical).
- Acceptance criteria:
  - [ ] `/dev/ui` renders every listed component in both themes with no console errors
  - [ ] axe clean on `/dev/ui` in both themes
  - [ ] `/dev/ui` returns 404 in production builds
  - [ ] no hardcoded colour literal in `src/components/ui` (lint)
- Definition of Done: code + unit + axe e2e + PROGRESS row + CI green.
- Potential risks and mitigations: shadcn generator writes Tailwind v3 syntax → post-install codemod checked into `scripts/shadcn-postfix.ts`; component count creep → limit to the docs/08 list.

### P1.4 Database client, env validation, core libs
- Owner profile: domain-critical
- Requirement IDs: NFR-DATA-03, NFR-SEC-06, FR-SEC-05, FR-OPS-03, FR-SEC-03, NFR-I18N-01, D-515, D-518, docs/04 §7.9, docs/09 §5.2, §8, §10, docs/12 §1 (env guard), §8.2
- Description: `src/lib/env.ts` Zod schema for every variable in docs/12 §2.2 with the production guards (refuse `*-dev-*` bucket names and non-`main` Neon branch when `APP_ENV=production`), `src/lib/db.ts` Drizzle client over `postgres` driver (pooled URL for app, unpooled for migrations), `withTx` helper exposing `TxCtx`. `src/lib/money.ts`: `Money` type `{ amountMinor: number; currency: Currency }`, `add`, `sub`, `mulBps`, `allocateLargestRemainder(total, weightsBps[])`, `toInr(amount, fxRate)` (round half-up via bigint math), `format(money, locale)` with lakh grouping for INR; no floats anywhere (lint). `src/lib/errors.ts`: `AppError` + `ErrorCode` enum exactly as docs/06 §1.4 with HTTP mapping. `src/lib/logger.ts` pino with the redact list of docs/12 §8.2. `src/lib/feature-flags.ts` with the ten flag keys of docs/13 §6, precedence env `FEATURE_*` > DB (`site_settings`, read via an injected loader so P1 has no schema dependency) > default. `src/lib/crypto.ts` AES-256-GCM `encrypt/decrypt` with versioned `v1:` key prefix (docs/12 §8.3). `src/lib/fx.ts` stub interface `getRate(base, quote, asOf)` returning a fixed test table until P3.12. `src/lib/rate-limit.ts` interface `rateLimit(key, limit, windowMs)` with an in-memory implementation and a `RateLimitStore` port that P2 (table) and P9 (enforcement) plug into. `src/lib/ids.ts` (uuid v4, order/invoice number formatters), `src/lib/dates.ts` (Asia/Kolkata FY helper `fyFor(date)` → `2026-27`).
- Owned paths: `src/lib/**` (except `status-tone.ts`, `fonts.ts` from P1.2 and `src/lib/email/**`, `src/lib/sentry*` from P1.8). Forbidden: `src/modules/**`, `drizzle/**`.
- Dependencies: P1.1.
- Expected files/modules: `src/lib/{env,db,money,errors,logger,feature-flags,crypto,fx,rate-limit,ids,dates}.ts`.
- Tests required: `tests/unit/lib/money.test.ts` (add/sub/mulBps/format; largest-remainder property with fast-check: Σ parts = total, |part − ideal| < 1 minor unit), `env.test.ts` (missing secret fails; production guard rejects dev bucket), `feature-flags.test.ts` (precedence), `crypto.test.ts` (round-trip, wrong key fails, `v1:` prefix), `dates.test.ts` (FY boundary 31 Mar/1 Apr IST, FI-09 precursor), `rate-limit.test.ts` (window rollover), `errors.test.ts` (code→HTTP table matches docs/06 §1.4). Coverage 100 % on `lib/money` (docs/10 §12).
- Acceptance criteria:
  - [ ] `lib/money` has 100 % line/branch coverage and no float operations
  - [ ] `lib/env` refuses to boot production with `codekraft-dev-public`
  - [ ] `lib/crypto` output differs from plaintext and decrypts with the key (SA-14 precursor)
  - [ ] `fyFor('2027-03-31T18:29:59Z')` = `2026-27`, `fyFor('2027-03-31T18:30:00Z')` = `2027-28`
- Definition of Done: code + unit tests at thresholds + PROGRESS row + CI green.
- Potential risks and mitigations: Neon pooled connections and transaction-mode PgBouncer → `withTx` never uses session-level advisory locks (docs/12 §5.1); money rounding ambiguity → the largest-remainder helper is the single implementation P4 must call.

### P1.5 Better Auth integration
- Owner profile: domain-critical
- Requirement IDs: FR-AUTH-01, FR-AUTH-03, FR-AUTH-04, FR-AUTH-05, FR-AUTH-06, FR-AUTH-07, FR-AUTH-11 (flag-off path), FR-AUTH-12, FR-AUTH-13, NFR-SEC-01, NFR-SEC-02, NFR-SEC-05, FR-SEC-03, API-AUTH-01, API-AUTH-02, API-AUTH-05, API-AUTH-06, API-AUTH-07, D-1201, D-1202, D-1203, A-1202, SA-01, SA-02, SA-03, SA-04, SA-06, MASTER_SPEC §7 "Password hashing", "Single session", "Audit atomicity"
- Description: Configure Better Auth with the Drizzle adapter on the Better-Auth-owned tables (`sessions`, `accounts`, `verifications`, `two_factor`; the DDL for these plus `users` is authored here as `drizzle/0000_auth.sql` because P2 depends on it — P2 extends `users` with the CodeKraft columns). Email/password with `argon2id` (explicit `password.hash/verify`), password policy ≥ 10 chars + breached-password check (`hibp` k-anonymity, fail-open when offline), email verification 24 h single-use, reset 60 min, Google OAuth with account linking on verified email, `twoFactor` plugin (TOTP + backup codes) restricted to admin-class roles via a `before` hook, phone-number plugin registered only when `phone_otp` flag is on (404 otherwise). Hooks: on session create delete other sessions of the user (D-1203, returns `SESSION_REPLACED` to the old device); `expiresIn`/`updateAge` 30 min on admin host and 60 min on site host (host-aware config), absolute maximum 7 days customer / 12 h admin (docs/09 §3.4 **proposed**, founder confirms — `ISSUES.md` I-019; implemented behind a config constant); `__Host-` cookie prefix, `HttpOnly; Secure; SameSite=Lax`, host-only; refuse `status ∈ {suspended, deleted}`. Auth events written to `audit_logs` via `audit.log` port (P1 defines the port in `src/lib/audit-port.ts`; P3.1 provides the implementation; until then a console sink). Route `src/app/api/auth/[...all]/route.ts`. `src/modules/auth/{service,hooks,config}.ts` and a typed client `src/modules/auth/client.ts`.
- Owned paths: `src/modules/auth/**`, `src/app/api/auth/**`, `drizzle/0000_auth.sql`, `src/lib/audit-port.ts`. Forbidden: `src/modules/authz/**` (P1.6), `middleware.ts` (P1.7).
- Dependencies: P1.4.
- Expected files/modules: `src/modules/auth/config.ts`, `hooks.ts`, `service.ts`, `client.ts`, `password-policy.ts`, `src/app/api/auth/[...all]/route.ts`, `drizzle/0000_auth.sql`.
- Tests required: unit `tests/unit/auth/password-policy.test.ts` (reject email local part, < 10 chars), `hooks.test.ts`; integration (Testcontainers) `tests/integration/auth/single-session.test.ts` (second login deletes first, SA-02), `idle-timeout.test.ts` (30/60 min with injected clock, SA-03), `suspended-login.test.ts` (FR-AUTH-12), `totp.test.ts` (enable/verify/backup/disable audited, SA-06), `google-link.test.ts` (links existing unverified account and marks verified); cookie attributes test SA-04.
- Acceptance criteria:
  - [ ] password hash rows start with `$argon2id$`
  - [ ] second login ends the first session on both hosts
  - [ ] idle timeouts are 30 min admin host / 60 min site host
  - [ ] TOTP endpoints return `FORBIDDEN` for customers
  - [ ] every auth event listed in FR-AUTH-13 produces an audit row through the port
  - [ ] `/api/auth/phone-number/*` is 404 with the flag off
- Definition of Done: code + unit + integration tests + docs/09 §3 corrections if any + PROGRESS row + CI green.
- Potential risks and mitigations: Better Auth plugin API changes → pin version, wrap all calls in `modules/auth/service.ts`; host-aware session config not supported natively → two `auth` instances selected by host in the route handler, tested.

### P1.6 RBAC library, permission list, `requireContext`, action envelope
- Owner profile: domain-critical
- Requirement IDs: FR-AUTH-08, FR-AUTH-09, FR-AUTH-10, FR-ADM-15, FR-FIN-12, FR-LEAD-10, API-AUTH-02, docs/06 §1.1–§1.4, docs/09 §4, SA-05, SA-07, D-512, D-1103, A-201, master plan §5 "Permission string list"
- Description: `src/modules/authz/permissions.ts` exports the permission string list and role matrix verbatim from docs/06 §1.2 (every row, including scope column as typed `Scope` descriptors). `authz.assert(ctx, permission, scope?)` throws `FORBIDDEN`; scope resolvers for the `◐` cells (`ownProducts`, `ownPartner`, `assignedOrPool`, `ownRows`). `requireContext(opts)` builds `{ user, roles, permissions, partnerId?, ip, userAgent, requestId, host }` from the Better Auth session, loads `user_roles` per request (no roles in token), enforces admin-host rule (admin-class action from the site host → `FORBIDDEN`), `EMAIL_UNVERIFIED` and `ACCOUNT_SUSPENDED` gates. `src/lib/action.ts` wrapper `defineAction(schema, permission, handler)` producing `ActionResult<T>` (docs/06 §1.4), never throwing to the client, mapping `AppError` codes, attaching Sentry event id on `INTERNAL`, `IDEMPOTENT_REPLAY` support hook. A static test (SA-07) asserts every `src/modules/*/actions.ts` export is created through `defineAction` (grep-based, runs in `unit`).
- Owned paths: `src/modules/authz/**`, `src/lib/action.ts`, `src/lib/context.ts`. Forbidden: `src/modules/auth/**` (reads only).
- Dependencies: P1.4, P1.5 (session).
- Expected files/modules: `src/modules/authz/{permissions,roles,assert,scopes,index}.ts`, `src/lib/context.ts`, `src/lib/action.ts`, `tests/static/actions-use-define-action.test.ts`.
- Tests required: `tests/unit/authz/matrix.test.ts` table-driven role × permission × scope (100 % coverage, docs/10 §12), `tests/unit/authz/scopes.test.ts`, `tests/unit/lib/action.test.ts` (envelope, thrown error → `INTERNAL`, Zod → `VALIDATION` with `fieldErrors`), `tests/integration/authz/require-context.test.ts` (admin action from site host refused; roles revoked mid-session take effect next request), static SA-07 test.
- Acceptance criteria:
  - [ ] permission list equals docs/06 §1.2 (test diffs the exported list against a fixture copied from the doc)
  - [ ] `authz` coverage 100 % lines/branches
  - [ ] admin-class action from the site host returns `FORBIDDEN`
  - [ ] SA-07 static test passes on an empty `modules/` and fails on a fixture action that bypasses `defineAction`
- Definition of Done: code + tests at 100 % + PROGRESS row + CI green.
- Potential risks and mitigations: permission drift between doc and code over later phases → the fixture-diff test is the tripwire; scope resolvers need tables not yet present → resolvers accept injected query functions, wired in P2.

### P1.7 `middleware.ts`, route-group layouts, theme attribute, health endpoint
- Owner profile: domain-critical
- Requirement IDs: FR-AUTH-08, FR-SEO-01 (layout groundwork), FR-A11Y-02, NFR-RT-01 (poll route reserved), API-AUTH-09 (stub), docs/04 §8, docs/06 §3.7, docs/08 §10, docs/12 §2.1, §8.1, MASTER_SPEC §7 "Admin host during interim", "Theme attribute on ISR pages", SA-05
- Description: `middleware.ts`: when `request.headers.host === process.env.ADMIN_HOST` (exact match, no prefix fallback — docs/12 §2.1, MASTER_SPEC §7 "Admin host during interim") rewrite `/x` → `/admin/x` and set `X-Robots-Tag: noindex, nofollow`; on any other host `/admin/*` → 404; generate a per-request CSP nonce and pass it via header (headers themselves are enforced in P9.1, report-only skeleton here); `*.vercel.app` → 308 to `NEXT_PUBLIC_SITE_URL` when the domain is set; `APP_ENV=staging` adds `noindex`. Root `src/app/layout.tsx` resolves `data-theme` server-side per docs/08 §10 (user pref → `ck_theme` cookie → default → `dark-cinematic`, flag check) and renders the ≤ 300-byte nonce'd inline head script for cached public routes; sets `suppressHydrationWarning`, `<meta name="theme-color">`. Group layouts `(site)/layout.tsx`, `(auth)/layout.tsx`, `(account)/layout.tsx` (session required, customer role), `(admin)/layout.tsx` (session + admin-class role, else 403 page; TOTP-pending → `/login/totp`). `src/app/api/health/route.ts` per docs/06 §3.7 (`SELECT 1`, version from `package.json`/git SHA, `Cache-Control: no-store`). Placeholder pages: `/`, `/auth/login` (minimal form using Better Auth client), `/account` (shows "signed in as"), admin `/login`, `/dashboard` (shell text). P7/P8 replace the placeholders.
- Owned paths: `middleware.ts`, `src/app/layout.tsx`, `src/app/(site)/layout.tsx`, `src/app/(auth)/layout.tsx`, `src/app/(account)/layout.tsx`, `src/app/(admin)/layout.tsx`, `src/app/api/health/**`, placeholder `page.tsx` files listed above, `src/app/not-found.tsx`, `src/app/error.tsx`. Forbidden: any other page, `src/components/**`.
- Dependencies: P1.2, P1.5, P1.6.
- Expected files/modules: as listed plus `src/lib/theme.ts` (`resolveTheme(session, cookies, settings, flags)`), `src/lib/nonce.ts`.
- Tests required: unit `tests/unit/lib/theme.test.ts` (resolution order, flag-off fallback), `tests/unit/middleware.test.ts` (host matrix: admin host rewrite, site host 404, vercel redirect, staging noindex); e2e `tests/e2e/foundation/host-isolation.spec.ts` (S-19 step 1; SA-05), `tests/e2e/foundation/login-logout.spec.ts` (site + admin hosts), `tests/e2e/foundation/theme-attribute.spec.ts` (`html[data-theme="dark-cinematic"]` present before hydration; cookie `ck_theme=light-editorial` with flag off still renders dark), `tests/integration/api/health.test.ts` (200 / 503 when DB down).
- Acceptance criteria:
  - [ ] `GET http://localhost:3000/admin` → 404; `GET http://admin.localhost:3000/` → admin login
  - [ ] non-admin account on admin host → 403 page + audit row via port
  - [ ] `data-theme` attribute present in the server HTML of `/` and `/account`
  - [ ] `/api/health` returns `{status:'ok', db:'ok', version, time}`
  - [ ] inline theme script is ≤ 300 bytes and carries the nonce
- Definition of Done: code + unit + integration + e2e + PROGRESS row + CI green; master plan §6 P1 gate satisfied.
- Potential risks and mitigations: `*.localhost` host resolution differs per browser in Playwright → use `extraHTTPHeaders.Host` per docs/10 §4; nonce lost on ISR pages → nonce only on dynamic responses, inline script hash allow-listed for cached routes (engineering decision, applied by P9.1; no founder input needed).

### P1.8 Sentry, email transport, analytics placeholder
- Owner profile: domain-standard
- Requirement IDs: NFR-AVAIL-02, NFR-OPS-02, FR-NOTIF-05 (transport only), FR-SEO-06 (script placeholder), docs/04 §10, docs/12 §7, §8.1, docs/09 TM-23
- Description: `@sentry/nextjs` client/server/edge configs with `beforeSend` scrubbing (cookies, headers, bodies, emails), `tracesSampleRate 0.1`, release/environment tags, source-map upload wired for the `build` job (token CI-only). `src/lib/email/transport.ts` with three transports selected by `EMAIL_TRANSPORT`: `log` (console), `outbox` (writes a row through an injected `EmailOutboxPort` — P2 supplies the table, P6 the channel), `resend` (Resend SDK, honours `EMAIL_ALLOWLIST` outside production, daily counter guard at 90/100). `src/lib/email/render.tsx` react-email base layout (ink-on-white, brand mark, MASTER_SPEC §7 "Print/PDF/email theming") used by all P6 templates. `src/components/site/UmamiScript.tsx` placeholder that renders nothing unless `NEXT_PUBLIC_UMAMI_SRC` and `site_settings.launched_at` (port) are set.
- Owned paths: `sentry.*.config.ts`, `src/lib/sentry.ts`, `src/lib/email/**`, `src/components/site/UmamiScript.tsx`, `instrumentation.ts`. Forbidden: `src/emails/**` (P6), `src/modules/notifications/**` (P6).
- Dependencies: P1.4.
- Expected files/modules: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `src/lib/email/{transport,render,types}.ts(x)`, `src/components/site/UmamiScript.tsx`.
- Tests required: `tests/unit/lib/email/transport.test.ts` (allowlist blocks non-founder recipient in preview; `log` transport never sends; outbox port called once), `tests/unit/lib/sentry.test.ts` (`beforeSend` strips `cookie`, `authorization`, email addresses), `tests/unit/components/umami-script.test.tsx` (absent without env).
- Acceptance criteria:
  - [ ] a thrown error in a Server Action produces a Sentry event with no cookie/header/email in the payload (mock transport)
  - [ ] `EMAIL_TRANSPORT=log` in `pnpm test` sends nothing
  - [ ] Umami script absent in local/preview
- Definition of Done: code + unit tests + PROGRESS row + CI green.
- Potential risks and mitigations: Sentry SDK pulling `edge` runtime config into `middleware.ts` → keep edge config minimal; Resend allowlist misconfigured in staging → refuse to start with `EMAIL_TRANSPORT=resend` and empty allowlist when `APP_ENV≠production` (env test).

### P1.9 Test harness
- Owner profile: domain-standard
- Requirement IDs: FR-OPS-05, NFR-OPS-01, NFR-A11Y-01, NFR-PERF-01..03, D-1607, docs/10 §1, §3, §4, §9, §11, §12, docs/11 §B10
- Description: Vitest workspace with projects `unit` (node + jsdom per glob), `property`, `integration` (Testcontainers `postgres:16` locally / `services:` in CI, migrations + `drizzle/custom/*.sql` applied in `globalSetup`, per-test transaction rollback helper `withRollback`), coverage thresholds per docs/10 §12 (global 80/70/80; finance/approvals/payments/entitlements/invoices 95/90/95; authz + lib/money 100). `tests/factories/README.md` conventions (faker seed 1207). Playwright config: projects `chromium-desktop`, `mobile-chrome` (PR) and `webkit`, `firefox`, `mobile-safari` (nightly tag `@full`), `extraHTTPHeaders.Host` for `codekraft.test` and `admin.codekraft.test`, `webServer` = `next start` on the standalone build, DB snapshot reset per spec file (`tests/e2e/global-setup.ts`), `@axe-core/playwright` helper `expectAxeClean(page, { themes: ['dark-cinematic','light-editorial'] })`, reduced-motion helper, `@security` / `@smoke` / `@flaky` tag conventions with the lint rule "no `test.skip` without issue + date". `lighthouserc.json` with the assertions of docs/11 §B10 and the eight URLs. `.size-limit.json` entries for each public route chunk, `three-hero`, `chapter-scroller`, `pdf-viewer` with docs/11 §B2 budgets (entries present now, budgets enforced from P7). fast-check installed with a `tests/property/README.md` describing the finance arbitraries of docs/10 §5.
- Owned paths: `vitest.config.ts`, `vitest.workspace.ts`, `playwright.config.ts`, `lighthouserc.json`, `.size-limit.json`, `tests/setup/**`, `tests/e2e/global-setup.ts`, `tests/e2e/helpers/**`, `tests/factories/README.md`, `tests/property/README.md`. Forbidden: `tests/e2e/*.spec.ts` beyond P1 gates (P7/P8/P9), `tests/factories/*.ts` (P2).
- Dependencies: P1.1.
- Expected files/modules: as listed plus `tests/setup/testcontainers.ts`, `tests/setup/with-rollback.ts`, `tests/e2e/helpers/{axe,hosts,clock,outbox}.ts`.
- Tests required: a smoke test per project proving the harness works: `tests/unit/smoke.test.ts`, `tests/property/smoke.test.ts`, `tests/integration/smoke.test.ts` (connects, runs migration 0000, rolls back), `tests/e2e/foundation/smoke.spec.ts` (home 200 on both hosts).
- Acceptance criteria:
  - [ ] `pnpm test:unit`, `pnpm test:integration`, `pnpm e2e` each run green locally with Docker present
  - [ ] coverage thresholds configured and enforced (a deliberately uncovered fixture fails the job in a dry run)
  - [ ] Playwright runs the same spec against both hosts via Host header
  - [ ] `lhci autorun` executes locally against `next start` (scores informational until P7)
- Definition of Done: harness + smoke tests + `tests/README.md` + PROGRESS row + CI green.
- Potential risks and mitigations: Testcontainers unavailable on an agent's machine → `DATABASE_URL_TEST` override uses the compose Postgres; e2e DB reset slow → snapshot via `pg_dump -Fc` once per run, `pg_restore` per spec file.

### P1.10 GitHub Actions `ci.yml`, lefthook, branch protection
- Owner profile: domain-standard
- Requirement IDs: FR-OPS-05, NFR-OPS-01, D-1404, D-1607, docs/10 §2, docs/12 §3 (hooks), §4.1–§4.2
- Description: `.github/workflows/ci.yml` with the job names of docs/12 §4.1: `setup` → `lint` (eslint, prettier check, gitleaks), `typecheck`, `unit` (coverage artifact + ratchet file), `integration` (`services: postgres:16`, MinIO service, migrations + custom SQL + seed), `build` (`next build` standalone, `size-limit`, bundle-analyzer artifact, `docker build`) → `e2e` (Playwright PR projects per docs/10 §10), `axe`, `lhci` (preview URL when present else `next start`), plus the `security-acceptance` report step of docs/10 §2 (collects `@security`-tagged results from the jobs above). Concurrency group per ref with cancel-in-progress; caching per docs/12 §4.2; draft-PR path runs only lint/typecheck/unit/integration/build (minutes budget). `pnpm audit --prod --audit-level=high` and `drizzle-kit check` in `lint`. `lefthook.yml`: pre-commit gitleaks protect + eslint --fix + prettier on staged; pre-push `tsc --noEmit`. `docs/ops/branch-protection.md` listing required checks and CODEOWNERS (`drizzle/`, `src/modules/finance`, `src/modules/approvals`, `.github/` → both founders) and `CODEOWNERS` file.
- Owned paths: `.github/workflows/ci.yml`, `.github/CODEOWNERS`, `lefthook.yml`, `.gitleaks.toml`, `docs/ops/branch-protection.md`. Forbidden: other workflows (P9.9).
- Dependencies: P1.9.
- Expected files/modules: as listed.
- Tests required: workflow runs green on the P1 branch; `act`-style dry run not required; a `tests/static/ci-jobs.test.ts` asserts job names match docs/12 §4.1 (`lint`, `typecheck`, `unit`, `integration`, `build`, `e2e`, `axe`, `lhci`; docs/10 §2 uses the same names).
- Acceptance criteria:
  - [ ] all jobs green on the P1 integration branch
  - [ ] draft PR runs the reduced job set
  - [ ] gitleaks blocks a fixture secret in pre-commit and in CI
  - [ ] CODEOWNERS present with the four protected paths
- Definition of Done: workflow + hooks + branch-protection doc + PROGRESS row + CI green.
- Potential risks and mitigations: 2 000 Actions minutes/month → draft-PR reduced set, Playwright browser cache, `e2e/axe/lhci` only on ready PRs and `main`; flaky first e2e → 1 retry policy with flaky report comment.

### P1.11 Progress board, issues, changelog, seed skeleton
- Owner profile: domain-standard
- Requirement IDs: FR-OPS-04 (skeleton), master plan §8, docs/05 §14 (roles/permissions only)
- Description: Create `implementation/PROGRESS.md` (already templated by this document set; P1 fills the P1 rows), `implementation/ISSUES.md`, root `CHANGELOG.md` (Keep-a-Changelog, sections "Added/Changed/Fixed/Documentation corrections"). `scripts/seed.ts` skeleton: idempotent upserts for `roles` and `permissions`/`role_permissions` generated from `src/modules/authz/permissions.ts` (single source of truth, TM-14 "diffed in CI"), `--production` flag parsing, `seeded_at` guard stub; P2.10 extends it with all other data.
- Owned paths: `implementation/PROGRESS.md` (rows), `implementation/ISSUES.md`, `CHANGELOG.md`, `scripts/seed.ts` (skeleton; P2.10 takes over), `scripts/lib/upsert.ts`. Forbidden: `drizzle/**`.
- Dependencies: P1.6 (permission list).
- Expected files/modules: as listed.
- Tests required: `tests/integration/seed/roles-permissions.test.ts` (runs seed twice; row counts stable; every permission in `permissions.ts` present; a permission removed from code and left in DB is reported by the diff check).
- Acceptance criteria:
  - [ ] `pnpm db:seed` is idempotent for roles/permissions
  - [ ] permission diff check fails when DB and code disagree
  - [ ] `CHANGELOG.md` has a `[Unreleased]` section with the P1 entries
- Definition of Done: files + seed test + PROGRESS row + CI green.
- Potential risks and mitigations: P2 rewriting the seed file wholesale and losing the diff check → P2.10 must keep `seedRolesAndPermissions()` exported and tested.

### P1.12 Phase-1 e2e gate and reviewer audit
- Owner profile: reviewer
- Requirement IDs: master plan §6 (P1 gate), docs/10 §13 (P0 row), SA-04, SA-05, SA-18 (headers subset: `X-Robots-Tag` on admin, `nosniff`)
- Description: Run the full P1 gate (lint, typecheck, unit, integration, e2e login/logout, host isolation, theme attribute, axe on `/auth/login` and `/dev/ui`), audit every P1 task's acceptance boxes, verify ownership map compliance (no file written outside owned paths), verify docs corrections were recorded in `CHANGELOG.md` "Documentation corrections", and produce `implementation/reviews/P1-review.md`.
- Owned paths: `implementation/reviews/P1-review.md`, `implementation/PROGRESS.md` (status only). Forbidden: any source file (read-only).
- Dependencies: P1.1–P1.11.
- Expected files/modules: `implementation/reviews/P1-review.md`.
- Tests required: all P1 suites green; `tests/e2e/foundation/*.spec.ts` tagged `@security` where they cover SA-04/05.
- Acceptance criteria:
  - [ ] every P1 acceptance box ticked with evidence links (CI run URL)
  - [ ] ownership violations: none (or listed with orchestrator sign-off)
  - [ ] review file committed
- Definition of Done: review file + PROGRESS statuses + CI green on the merge commit.
- Potential risks and mitigations: reviewer rubber-stamps → review must quote test names per criterion.

## Parallelisation map

```
P1.1 ──┬── P1.2 ── P1.3
       ├── P1.4 ──┬── P1.5 ──┐
       │          ├── P1.6 ──┼── P1.7 ──┐
       │          └── P1.8   │          ├── P1.12
       └── P1.9 ── P1.10 ────┘          │
                   P1.11 (after P1.6) ──┘
```

- Concurrent after P1.1: {P1.2 → P1.3}, {P1.4 → P1.5, P1.6, P1.8}, {P1.9 → P1.10}. They touch disjoint paths (styles/components vs lib/modules vs tests/workflows).
- Sequential: P1.5 and P1.6 both depend on P1.4 and P1.6 reads P1.5's session type — run P1.5 first or P1.6 against a typed stub, then integrate. P1.7 needs P1.2, P1.5, P1.6 because it wires layouts to theme, session and role checks. P1.11 needs the permission list. P1.12 last.
- No two concurrent tasks write `package.json` after P1.1: dependency additions go through the P1.1 owner (single PR) or are appended by the orchestrator.

## Phase Definition of Done

- All 12 tasks `done` in `PROGRESS.md` with CI run links.
- `ci.yml` green on the integration branch: lint, typecheck, unit (thresholds), integration (migration 0000 + auth tables), build (standalone + docker), e2e (login/logout on both hosts, admin host isolation, theme attribute), axe on `/dev/ui` and `/auth/login`.
- SA-02, SA-03, SA-04, SA-05, SA-06 tests exist and pass (SA-07 static test in place).
- `/dev/ui` shows every shadcn component in Theme 1 and, with the attribute forced, Theme 2.
- `CHANGELOG.md` `[Unreleased]` lists P1 work; `ISSUES.md` reviewed (no P1 founder question is expected: the ISR theme-script hash and the CI job names are settled engineering decisions — docs/12 §4.1 names, docs/10 §2 aligned).
- Docker image builds and serves `/api/health`.

## Phase risks

| Risk | Mitigation |
|------|------------|
| Better Auth host-aware sessions (30/60 min) not expressible in one instance | two instances keyed by host; integration test locks the behaviour |
| `users` table split between P1 (auth columns) and P2 (domain columns) causes a migration conflict | P1 owns `drizzle/0000_auth.sql` only; P2 alters `users` in `0001_*`; `drizzle-kit check` in CI |
| Tailwind v4 + shadcn generator mismatch | codemod script + `/dev/ui` visual check + axe |
| Agents add packages concurrently → lockfile conflicts | dependency additions batched through the orchestrator |
| CI minutes exhausted during P1 iteration | draft-PR reduced pipeline from day one |
| CI job names drift between `ci.yml` and the docs | docs/12 §4.1 names are canonical (docs/10 §2 and §13 use them); `tests/static/ci-jobs.test.ts` diffs `ci.yml` against that list |

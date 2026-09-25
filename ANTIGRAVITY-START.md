# CodeKraft — Start here in Antigravity (or any agent IDE)

This repository is a fully specified, partially built product. Phases 1 and 2 are done. Your job is to
**continue Phases 3–9 without re-deciding anything** and to keep the UI exactly as previewed.

Paste the prompt in §5 into your orchestrator agent. It tells the agent to onboard the founder first
(accounts, storage, deployment), then run the remaining phases with sub-agents.

## 1. What is already decided (do not re-open)

| Topic | Source of truth |
|-------|-----------------|
| Requirements, rules, scope, resolutions | `MASTER_SPEC.md` (entry point), `discovery/01-REQUIREMENTS-BASELINE.md`, `discovery/00-DECISION-LOG.md` |
| Architecture, database, API, security, QA, SEO, DevOps | `docs/01`–`docs/13` |
| **UI** — every screen and both themes | `ui/screens/**` (specs), `ui/theme-01`, `ui/theme-02`, `docs/08-DESIGN-SYSTEM.md`, and the **built previews** in `src/app/dev/screens/**` + components in `src/components/{site,account,admin,ui}/**`; PNGs of every screen in `ui/screenshots/**` |
| Phase plan, task acceptance criteria | `implementation/IMPLEMENTATION-MASTER-PLAN.md`, `implementation/PHASE-0n.md`, status in `implementation/PROGRESS.md` |
| Agent contract | `prompts/ANTIGRAVITY-ORCHESTRATOR.md` |
| Open founder decisions | `implementation/ISSUES.md` |

**UI rule:** Phases 7 and 8 must *wire data into the existing preview components*, not redesign them.
The founder reviewed the previews at `/dev/screens`. If a screen needs to change, change the shared
component so the preview and the real page stay identical.

## 2. What is built

- Phase 1: Next.js 15 app, tokens for both themes, 28 UI components + `/dev/ui`, core libs, RBAC (51 permissions), Better Auth (site + admin hosts), middleware, health endpoint, Sentry, email transport, seed, GitHub Actions CI.
- Phase 2: full database (81 tables, triggers, views) in `drizzle/`, typed contracts + NotImplemented service skeletons for all 27 modules in `src/modules/**`, test factories, full idempotent seed.
- Previews: all 61 designed screens under `/dev/screens` with fixture data.
- Branch `wip-wave-3-partial` (if present) holds *unverified, partial* output of stopped agents for Phases 3–6. Do not merge it; you may read it for ideas. Start Phases 3–6 from `main`.

Local gate on main: 522 unit/integration tests, 42 e2e, lint/typecheck/build clean.

## 3. Run it on a new machine (macOS, incl. Apple Silicon)

```bash
git clone <REPO_URL> CodeKraft && cd CodeKraft
nvm install 22 && nvm use 22
corepack enable pnpm && corepack prepare pnpm@12.6.0 --activate
pnpm install
cp .env.example .env.local
node -e "console.log('BETTER_AUTH_SECRET='+require('crypto').randomBytes(32).toString('base64'))" >> .env.local
node -e "console.log('APP_ENCRYPTION_KEY='+require('crypto').randomBytes(32).toString('base64'))" >> .env.local
node -e "console.log('CRON_SECRET='+require('crypto').randomBytes(24).toString('hex'))" >> .env.local
pnpm db:local            # terminal 1 — Postgres without Docker (downloads binaries once)
pnpm db:migrate && pnpm db:seed
pnpm dev                 # terminal 2 — http://localhost:3000
pnpm test && pnpm lint && pnpm typecheck && pnpm build   # must be green before any new work
```

See: `/dev/screens` (all screens), `/dev/ui` (components), `/auth/login` (seeded `ceo@codekraft.local` / `local-super-admin-passphrase-2026`), `http://admin.localhost:3000/`. Full details and troubleshooting in `AGENT-RUNBOOK.md`.

## 4. Services the founder must provide (the agent asks for these first)

| Need | Free option that fits the docs | Where it goes |
|------|-------------------------------|---------------|
| Postgres (prod/staging) | Neon free tier (or Supabase Postgres — same schema; use the direct connection string for migrations, pooled for the app) | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` |
| Object storage (media, downloads, PDFs, backups) | Cloudflare R2 free tier (S3-compatible); Supabase Storage is acceptable only via its S3 endpoint | `R2_*` variables |
| Transactional email | Resend free tier + a verified sending domain | `RESEND_API_KEY`, `EMAIL_FROM` |
| Domain | Any registrar; DNS for site, `admin.` subdomain, Resend records | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ADMIN_URL`, `ADMIN_HOST` |
| Hosting | Vercel (two projects: site + admin host) now; Docker/VPS later per `docs/12` | Vercel env + GitHub secrets |
| AI | Anthropic API key (chatbot) | `ANTHROPIC_API_KEY` |
| Forms, analytics, errors | Cloudflare Turnstile, Umami Cloud, Sentry (all free) | `TURNSTILE_*`, `NEXT_PUBLIC_UMAMI_*`, `*SENTRY*` |
| Payments (release 1) | None — manual UPI QR + bank transfer; founder's UPI VPA and bank details go into admin settings | seed env `SEED_UPI_VPA`, `SEED_BANK_DETAILS` |

Deployment pipeline is already defined: `.github/workflows/ci.yml` (lint, typecheck, unit, integration, build + Docker, e2e, axe, lhci) and `docs/12-DEVOPS-DEPLOYMENT.md` (Vercel projects, env matrix, Neon branches, backups, VPS migration). Set the GitHub secrets it lists before enabling the `e2e`/`lhci` jobs.

## 5. Orchestrator prompt (paste this)

```
You are the lead engineering orchestrator for CodeKraft. Read ANTIGRAVITY-START.md, then prompts/ANTIGRAVITY-ORCHESTRATOR.md, then MASTER_SPEC.md, then implementation/PROGRESS.md. Follow them exactly; never re-open decided requirements or redesign UI that exists under src/components and /dev/screens.

Step 0 — Environment check: run the commands in ANTIGRAVITY-START.md §3 and confirm all four gates are green on this machine. Fix environment issues only; do not change product code yet.

Step 1 — Founder onboarding interview: ask the founder, in one short batch of multiple-choice questions, for each item in ANTIGRAVITY-START.md §4 (database provider, storage, email domain, domain name, hosting/Vercel account, Anthropic key, Turnstile/Umami/Sentry, UPI VPA and bank details). Record answers in implementation/ISSUES.md under "Environment", create the .env matrix per docs/12 §2.2, and set up the deployment pipeline (Vercel projects for site and admin host, GitHub secrets, Neon branches). Verify a preview deployment builds without errors before continuing.

Step 2 — Phases 3 to 6 in parallel per implementation/IMPLEMENTATION-MASTER-PLAN.md wave W3: one sub-agent per task group with disjoint owned paths as listed in each PHASE file. Contracts in src/modules/*/contracts.ts are frozen; replace NotImplemented skeletons in service.ts; actions only via defineAction; tests per docs/10. After every task: pnpm typecheck && pnpm lint && pnpm test; commit with the task id; update implementation/PROGRESS.md.

Step 3 — Phases 7 and 8: wire real data into the existing preview components (src/components/site, account, admin) and route groups; keep /dev/screens working; add GSAP/Lenis, react-three-fiber hero, Recharts, react-grid-layout, Tiptap as the phase files specify.

Step 4 — Phase 9: hardening, full e2e, Lighthouse/axe gates, production deploy, FOUNDER-CHECKLIST.md.

Verification rule: a task is done only when its acceptance criteria are ticked and CI is green. If a sub-agent returns incomplete or red work, send it back with the exact failures until it passes. Ask the founder only for decisions listed in implementation/ISSUES.md or when two documents conflict.
```

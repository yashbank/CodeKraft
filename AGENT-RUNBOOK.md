# CodeKraft — Runbook for a new machine or a new agent

Read this first if you just cloned the repository and want to run it, or if you are an AI agent (Antigravity, Gemini, Claude Code) continuing the build.

## 1. What this repository is

- `MASTER_SPEC.md` + `docs/` + `discovery/` — the complete, approved engineering blueprint (read `MASTER_SPEC.md` first).
- `implementation/` — the phase plan; `implementation/PROGRESS.md` says exactly which tasks are done and which are next.
- `prompts/ANTIGRAVITY-ORCHESTRATOR.md` / `prompts/CLAUDE-CODE-ORCHESTRATOR.md` — the instructions an implementing agent must follow.
- `src/`, `tests/`, `drizzle/` — the Next.js 15 application being built phase by phase.

## 2. Prerequisites (local machine)

| Need | Version | How |
|------|---------|-----|
| Node.js | 22 LTS (required by jsdom 30 and the Dockerfile) | `nvm install 22 && nvm use 22` (`.nvmrc` is set) |
| pnpm | 12 | `corepack enable pnpm && corepack prepare pnpm@12.6.0 --activate` |
| PostgreSQL | 16 or 17 | **No Docker needed:** `pnpm db:local` downloads Postgres binaries once and runs them from `.pg/`. With Docker: `docker compose up -d postgres`. |
| Git | any | |
| Optional | Docker Desktop | only for MinIO/Mailpit profiles and Testcontainers |

Nothing else is required to run the app locally. All external services (Neon, R2, Resend, Anthropic, Turnstile, Umami, Sentry) are optional in local mode; the app falls back to log-only email, static FX rates and no analytics.

## 3. First run (copy-paste)

```bash
git clone https://github.com/yashbank/CodeKraft.git && cd CodeKraft
nvm use                       # Node 22
corepack enable pnpm && corepack prepare pnpm@12.6.0 --activate
pnpm install                  # build scripts for embedded-postgres/esbuild are pre-approved in pnpm-workspace.yaml
cp .env.example .env.local    # local defaults already work; fill secrets later
pnpm db:local                 # terminal 1: Postgres on localhost:5432 (user/pass codekraft)
pnpm db:migrate && pnpm db:seed   # once Phase 2 lands; safe to run when drizzle/migrations exists
pnpm dev                      # terminal 2: http://localhost:3000  (admin: http://admin.localhost:3000)
```

`admin.localhost` resolves to 127.0.0.1 automatically on macOS and most Linux distributions. On Windows add `127.0.0.1 admin.localhost` to the hosts file.

Generate secrets for `.env.local` when auth lands (Phase 1.5+):

```bash
node -e "console.log('BETTER_AUTH_SECRET='+require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('APP_ENCRYPTION_KEY='+require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('CRON_SECRET='+require('crypto').randomBytes(24).toString('hex'))"
```

## 4. Verify the machine is good

```bash
pnpm lint && pnpm typecheck    # static checks
pnpm test                      # unit + integration (integration auto-starts an embedded Postgres if Docker is absent)
pnpm build                     # production build (standalone output for Docker)
pnpm e2e                       # Playwright (first time: pnpm exec playwright install chromium)
```

All four must be green before you continue any phase.

## 5. Where the build currently stands

Check `implementation/PROGRESS.md` (single source of truth). Summary at the time of writing:

- Phase 1 (foundation) **complete** on 2026-09-25 and merged to `main`: scaffold, lint rules, tokens for both themes, 28 UI components + `/dev/ui`, core libs, RBAC, Better Auth (site + admin hosts), middleware, health endpoint, Sentry, email transport, seed, CI workflow. Local gate: 299 unit/integration tests, 42 e2e, first-load JS 101 KB.
- Next: Phase 2 (full database schema, module contracts, seeds) — `implementation/PHASE-02.md`. Phases 3–9 follow per `implementation/IMPLEMENTATION-MASTER-PLAN.md`.
- To see it: `pnpm db:local`, `pnpm db:migrate && pnpm db:seed`, `pnpm dev`, then `http://localhost:3000/dev/ui`, `/auth/login` (seeded: `ceo@codekraft.local` / `local-super-admin-passphrase-2026`), `http://admin.localhost:3000/`.

## 6. How an agent continues the work

1. Read `prompts/ANTIGRAVITY-ORCHESTRATOR.md` (or the Claude Code one) — it is the contract.
2. Open `implementation/PROGRESS.md`, find the first `todo` task whose dependencies are `done`.
3. Open its `implementation/PHASE-0n.md` section: owned paths, tests, acceptance criteria.
4. Build it, run the four commands in §4, tick the acceptance criteria in `PROGRESS.md`, add a `CHANGELOG.md` line, commit with the task id in the subject (`P1.5 auth: …`).
5. Never change requirements; write questions to `implementation/ISSUES.md`.

## 7. Founder-provided inputs still needed before production

Domain (verified in Resend), free-tier accounts (Neon, Cloudflare R2, Resend, Anthropic, Turnstile, Umami, Sentry) with keys in Vercel env, CodeKraft UPI ID and bank details in admin settings, real content (services, case studies, products, legal pages, logo).

## 8. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `pnpm install` says build scripts ignored | `pnpm-workspace.yaml` already approves them; run `pnpm install` again or `pnpm approve-builds` |
| `pnpm db:local` fails with `Library not loaded: libicu…` | Fixed automatically by the script (creates dylib symlinks); if it persists, `rm -rf node_modules .pg && pnpm install` |
| Tests fail with `markAsUncloneable is not a function` | You are on Node 20; switch to Node 22 (`nvm use`) |
| Port 5432 in use | Set `PGPORT=5433 pnpm db:local` and update `DATABASE_URL` in `.env.local` |
| `admin.localhost` does not resolve | Add `127.0.0.1 admin.localhost` to your hosts file |

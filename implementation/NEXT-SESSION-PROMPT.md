# Next session — paste this prompt into Claude Code on the main Mac

Read first: `implementation/BUG-TRACKER.md` (49 production defects in 11 clusters), then `docs/handoff/progress-log.md` (what shipped, 2026-10-09 → 10-11), then `scripts/gate.sh`.

```
You are resuming CodeKraft (Next.js 15, Drizzle/Neon, Better Auth, Vercel). Everything is on main; tsc 0, eslint 0, 1,060 tests green, `pnpm gate` runs before every push (local pre-push hook; install it: copy the hook body from docs/handoff/progress-log.md "Push gate" or run `bash scripts/gate.sh` manually before `git push`).

Task: fix every row in implementation/BUG-TRACKER.md, cluster by cluster, autonomously, and report after each cluster. Rules:
- Orchestrate: one read-only Plan agent writes a spec per cluster (exact files/lines, helper to reuse, test to add); then Sonnet builder lanes on disjoint files, ≤200-word reports, no refactors, no `!`, no `any`, no eslint-disable; a Sonnet browser verifier re-walks the fixed routes locally (Postgres: `pnpm db:local`, `pnpm db:migrate && pnpm db:seed`; Playwright already has a storage stub webServer).
- Two test rounds per cluster: lane tests, then `pnpm gate` + the e2e suites (`pnpm exec playwright test --project=site tests/e2e/foundation tests/e2e/commerce`, `--project=admin tests/e2e/foundation`). Push to main only when green; tick the fixed rows in BUG-TRACKER.md in the same commit.
- Cluster 1 (media URL) first: make public media work regardless of the Vercel env (serve through a real route or validate the base URL at boot with a clear error), then clusters 2-11 in order. Cluster 10 is data cleanup via the admin UI (audited), do it last.
- Ops scripts (`scripts/ops/publish-product.mjs`, `purchase-smoke.mjs`) take credentials from env; keep secrets in `.env.production.local` (gitignored), never in docs.
- Founder-only items are listed at the top of the tracker; ask for them once, in one short list, and keep going on everything else.
Start with the Plan agent for cluster 1 and report the spec before building.
```

Environment on the main Mac: `.env.local` (local), `.env.production.local` with DATABASE_URL_UNPOOLED, VERCEL_TOKEN (team-scoped), ADMIN1_/ADMIN2_ email+password for the ops scripts. Permission rules used here (project `.claude/settings.local.json`): `Bash(pnpm exec playwright *)`, `Bash(node scripts/ops/*)`, `Bash(pnpm exec drizzle-kit migrate*)`, `Bash(npx -y vercel@latest *)`.

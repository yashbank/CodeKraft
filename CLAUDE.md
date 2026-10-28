# CodeKraft

Next.js + Drizzle + Neon Postgres + pnpm + Vitest + Playwright. Deployed on Vercel.

Working branch for autopilot work: fix/autopilot. Never push to main, never deploy, never force-push.

Session start: run /resume. After EVERY task: update PROGRESS.md, then git commit.

Token rules: use Grep/Glob and Read with offset+limit, never read whole specs. Delegate reading/searching/testing to subagents, they return at most 10 lines. Run cheap deterministic checks first: pnpm lint, pnpm typecheck, pnpm test, pnpm build.

## Two-Mac mode (Mac A = ops, Mac B = builder)
Read `docs/COORDINATION.md` on branch `coord` (use the `/sync` skill; `.claude/machine` says A or B).
- Mac B: do NOT edit PROGRESS.md (A owns it). Work on `feat/<task-id>-<slug>` branched from `origin/fix/autopilot`; log progress with `/sync push`. No Neon migrations, deploys, or pushes to `main`/`fix/autopilot`. Run only touched-file checks.
- Mac A: merges B's branches, runs the full gate, applies migrations, deploys on user approval, live-tests, records results with `/sync`.

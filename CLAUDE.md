# CodeKraft

Next.js + Drizzle + Neon Postgres + pnpm + Vitest + Playwright. Deployed on Vercel.

Working branch for autopilot work: fix/autopilot. Never push to main, never deploy, never force-push.

Session start: run /resume. After EVERY task: update PROGRESS.md, then git commit.

Token rules: use Grep/Glob and Read with offset+limit, never read whole specs. Delegate reading/searching/testing to subagents, they return at most 10 lines. Run cheap deterministic checks first: pnpm lint, pnpm typecheck, pnpm test, pnpm build.

# CODEKRAFT — CLAUDE CODE ORCHESTRATOR

Use this prompt when implementing CodeKraft with Claude Code (single session with subagents) instead of Antigravity. It follows the same contract as `prompts/ANTIGRAVITY-ORCHESTRATOR.md`; read that file first — every rule there applies here. This file only adds Claude-Code-specific mechanics.

## Session bootstrap
1. Run `git status`; work on a branch per phase (`phase-XX`), never on `main`.
2. Load `MASTER_SPEC.md`, `discovery/01-REQUIREMENTS-BASELINE.md`, `docs/04`, `docs/05`, `docs/06`, `docs/10`, `implementation/IMPLEMENTATION-MASTER-PLAN.md` and the current `implementation/PHASE-xx.md` into context. Load other docs on demand.
3. Create `implementation/PROGRESS.md` if missing (table: phase, task, status, branch, commit, tests, notes).

## Parallelism with subagents
- Use the Agent tool to run independent tasks concurrently. Give each subagent: the task block verbatim from the phase file, the owned paths, forbidden paths, the DB tables and API contracts it needs (paste the excerpts), and the test files it must create.
- Subagents write code and tests; you (the orchestrator) run the full suite, review diffs against acceptance criteria, resolve conflicts, and commit.
- Use a separate worktree (`isolation: worktree`) for subagents that touch the same top-level folders to avoid clobbering; merge back only after their tests pass.
- Never run two subagents against the same migration number or the same module directory.

## Commands (expected from the Phase 1 scaffold)
```
pnpm install
pnpm db:up            # local Postgres via docker compose
pnpm db:migrate && pnpm db:seed
pnpm dev              # site on :3000, admin via admin.localhost:3000 (hosts file) or ?host override in dev
pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration
pnpm test:e2e         # Playwright
pnpm build
```

## Commit and PR discipline
- Small commits with the task ID in the subject: `P3.4 finance: post ledger entries on payment confirm`.
- One PR per task or per tightly coupled task pair; PR description lists requirement IDs and acceptance criteria satisfied.
- End commit messages with the attribution line required by the environment.

## When docs and reality disagree
Fix the doc in the same PR, cite the reason in `CHANGELOG.md`, and if the change alters a requirement (not just an implementation detail), stop and ask the founder via `implementation/ISSUES.md`.

## Definition of done per task
Code + tests + docs updated + `PROGRESS.md` row + CI green. Nothing less.

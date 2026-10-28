---
name: sync
description: Two-Mac coordination for CodeKraft. Use for /sync, "pull context from the other Mac", "send this to Mac A/B", status, handoffs, marking tasks ready or verified. Reads and writes docs/coord/*.md on the `coord` branch.
---

Rules live in `docs/COORDINATION.md` (on `coord`). Read it first when unsure. Never write secrets, tokens, DB URLs or passwords into any coord file. Notes persisted in the repo are written in plain, clear English.

## Setup (first run on a machine)
1. Machine id: read `.claude/machine` (contents `A` or `B`). If missing, ask the user once which Mac this is, then write it (file is gitignored).
2. `git fetch origin coord`. Create the worktree if absent: `git worktree add .coord coord` (if the branch does not exist locally: `git worktree add -b coord .coord origin/coord`).
3. Always work through `.coord/`; never switch the main checkout to `coord`.

## Commands
- `/sync` or `/sync pull`: `git -C .coord pull --ff-only`. Then read `.coord/docs/coord/<other>.md` and the tail of your own file. Report in at most 8 lines: other machine's `ready`/`blocked` items, requests addressed to me, what I should do next.
- `/sync push <note>`: update my own file `.coord/docs/coord/<me>.md` (task statuses with branch names, a dated line for the note). Commit `sync(<me>): <note>` and `git -C .coord push origin coord`. If push is rejected, `pull --rebase` and retry once. Edit only my own file.
- `/sync task "<text>"`: append an item to my file's "Requests to <other>" section (what, why, how to verify). Then push as above.
- `/sync status`: print the task table with current status from both files (A.md and B.md), one line per task.
- `/sync ready <task-id> <branch> <test note>` (Mac B): set the task to `ready`, then push both the code branch (`git push origin <branch>`) and the coord note.
- `/sync verified <task-id>` / `/sync bug <task-id> <what>` (Mac A): record the result of merge + gate + live test.

## File format for `docs/coord/<X>.md`
```
# Mac <X> status
Updated: <ISO date/time>
## Tasks
- P1-01 | ready | branch feat/p1-01-ledger | vitest finance ledger: 12 pass
## Requests to <other>
- [open] <what> | why | how to verify
## Log
- <date> <note>
```

## Mac B extras
Before starting a task: `/sync pull`, set the task `doing`, push. Branch from `origin/fix/autopilot`. Run only touched-file checks (see COORDINATION.md). Do not touch migrations on Neon, deploys, `main` or `fix/autopilot`.

## Mac A extras
After merging a B branch into `fix/autopilot`: full gate (typecheck, lint, full vitest, build), apply migration if any (user runs the Neon script), deploy only on user approval, live click-test, then `/sync verified` or `/sync bug`.

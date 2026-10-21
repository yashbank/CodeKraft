---
name: resume
description: Resume autopilot work on CodeKraft after a session break or context cutoff. Use at session start.
---

Steps:
1. Read only PROGRESS.md.
2. Run `git status --short` and `git log --oneline -5`.
3. If uncommitted changes exist: check `git diff --stat`.
   - If they belong to the NEXT task and pass a quick check (lint/typecheck on touched files), finish and commit.
   - Otherwise `git stash push -u -m "partial-<task>"`.
4. Continue at NEXT (the one line in PROGRESS.md).
5. If NEXT references a bug ID, grep BUGS.md for that ID only. Never reread whole files or specs.
6. After finishing the task: update PROGRESS.md (PHASE/NEXT/DONE/LAST_COMMIT), then `git commit`.

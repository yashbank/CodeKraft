---
name: fix-bug-loop
description: Fix one bug from BUGS.md end to end - reproduce, fix, verify, commit, update PROGRESS. Use for each bug in the fix loop phase, highest severity first.
---

Args: a bug ID from BUGS.md.

1. Grep BUGS.md for that ID only (not the whole file).
2. Reproduce: read the evidence line, locate the relevant route/module with Grep/Glob (not full-file reads unless needed).
3. Delegate the actual fix to the `fixer` subagent: give it the bug ID, route, evidence, and the specific file(s)/lines if already known. Fix the root cause, not a patch over symptoms. Add or update a test for the fix.
4. Delegate verification to the `verifier` subagent: re-run lint/typecheck/tests/e2e scoped to the touched area only.
5. If verifier passes: commit with `fix(BUG-<id>): <short description>`, mark the bug status=fixed in BUGS.md, update PROGRESS.md (NEXT = next bug), commit again if BUGS.md edit wasn't bundled.
6. If verifier fails: retry steps 3-4 up to 3 attempts total. After 3 failed attempts, mark status=blocked with the reason in BUGS.md and move to the next bug.
7. Keep `pnpm build` green at all times - never leave the tree in a broken build state across a commit boundary.

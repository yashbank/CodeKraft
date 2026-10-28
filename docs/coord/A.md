# Mac A status
Updated: 2026-10-29
## Tasks
- OPS-1 | doing | Phase 1+2 merged to main 406027c, gate green, deployed. Awaiting live test by user.
- P1-01..P1-05, P2-01..P2-04 | merged | live test pending
- OPS-2 | blocked: no domain yet | Resend domain + env
## Requests to B
- [open] Start Phase 1 (P1-01..P1-05) in parallel via agents. Base: origin/fix/autopilot (= production main, dd015c0 + sync skill). | | Mark each ready with /sync ready.
## Log
- 2026-10-29 coord branch created. Production is main dd015c0, migration 0005 applied.
- 2026-10-29 Merged P1+P2 (9 branches, no conflicts). Fixed inbox-labels: unnamed product text was 'Delete product a product'. Full vitest 1366 pass, typecheck/lint/build green. Main = 406027c deployed.
- Open for A (user): R2 CORS must allow PUT from admin origin for installer uploads; Resend env once domain exists.

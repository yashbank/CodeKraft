# Mac A status
Updated: 2026-10-29
## Tasks
- OPS-1 | doing | Phase 1+2 merged to main 406027c, gate green, deployed. Awaiting live test by user.
- P1-01..P1-05, P2-01..P2-04 | merged | live test pending
- OPS-2 | blocked: no domain yet | Resend domain + env
## Requests to B
- [open] Add P15-01, P15-02 to the Phase 14 batch; follow 'Team orchestration' section. Rebase onto origin/fix/autopilot after A pushes cbd574e (CI/Vercel config). | user: R2 media offload + lower Vercel load, zero regressions | /sync ready, with parity tests
- [open] Phase 14 (P14-01..P14-13, see docs/COORDINATION.md + 'Phase 14 rules'). Base origin/fix/autopilot (14af3bd). Report ETA to the user after each ready. | user live-test findings 2026-10-30 | /sync ready each
- [open] Phase 13 (R9-00..R9-14, see docs/COORDINATION.md). Start with R9-00 harness, then R9-01..R9-13 in parallel via agents, R9-14 last. Base origin/fix/autopilot (980b520). Rules in 'Phase 13 rules'. | live test findings 2026-10-29 | /sync ready each, with proof
- [open] Phases 7-12 (P7-01..P12-04, see docs/COORDINATION.md). Base origin/fix/autopilot (0af5f7a). Order P7 -> P8 -> P9 -> P10 -> P11 -> P12. Mark each /sync ready; A merges per phase. Reset-site-data code must never be run against a real DB. | user live-test findings | /sync ready
- [open] Phase 6: P6-01..P6-05 (see docs/COORDINATION.md). P6-01 first (mobile bug), then P6-02, P6-03, P6-05, P6-04. Base: origin/fix/autopilot (e3a608a). P6-05 is destructive: preview/typed confirmation + 2nd super admin approval + backup; never run it against any real DB yourself. | user reported P3-02 logos render twice | /sync ready each
- [open] Start Phase 1 (P1-01..P1-05) in parallel via agents. Base: origin/fix/autopilot (= production main, dd015c0 + sync skill). | | Mark each ready with /sync ready.
## Log
- 2026-10-29 coord branch created. Production is main dd015c0, migration 0005 applied.
- 2026-10-29 Merged P1+P2 (9 branches, no conflicts). Fixed inbox-labels: unnamed product text was 'Delete product a product'. Full vitest 1366 pass, typecheck/lint/build green. Main = 406027c deployed.
- Open for A (user): R2 CORS must allow PUT from admin origin for installer uploads; Resend env once domain exists.
- 2026-10-29 Merged P3-P5 (10 branches; 1 conflict in settings/contracts.ts resolved: kept themeToggle+palette, aiModel claude-sonnet-5-5). Full vitest 1408 pass (1 finance ownership test flaky under load, passes alone), typecheck/lint/build green. Main = e3a608a deployed. Live test pending (user).
- 2026-10-29 Merged P6-01/02/03/05 to main (fixed palettes test mock for getSiteLogo). Gate green. Migration 0006 (site.reset enum) pending on live DB (user). P6-04 not merged yet.
- 2026-10-29 Merged P6-04 (ui-sweep). Phase 6 all on main 0af5f7a, deployed, 1437 tests pass. Migration 0006 applied live by user. Live test pending (user).
- 2026-10-29 Merged P7-P12 (21 branches; journal conflict resolved) to main 980b520, deployed Ready. Migrations 0007+0008 applied live by user. Fixed Vercel build error: Suspense around admin dev preview shell. 1627 tests pass. Live test pending (user).
- 2026-10-29 Merged R9 (feat/r9-integration) to main 14af3bd, deployed Ready. vitest 1744 pass, typecheck/lint/build green. No new migration. Live test pending (user).

# P20 hardening round (resume file)
Rule: no push, no deploy, no prod DB/migration. Local DB + stubs only. Owner says "go" once at the end.
Resume: read this file, continue the first phase not marked DONE.

| # | Phase | Branch | Status |
|---|---|---|---|
| 1 | Danger Zone confirm dialog | qa/p20-1-dz-confirm | TODO |
| 2 | Login handoff token out of URL | qa/p20-2-handoff | TODO |
| 3 | Persistent rate-limit store (new table + migration, local only) | qa/p20-3-ratelimit | TODO |
| 4 | Audit + fix remaining bugs (BUGS.md open, video_embed, React #418, a11y, UX) | qa/p20-4-bugs | TODO |
| 5 | Google OAuth: needs owner click-through (cannot automate) | - | OWNER |
| 6 | Integration merge + full gate (3 parallel e2e rounds, unit, lint, typecheck) | qa/p20-integration | TODO |

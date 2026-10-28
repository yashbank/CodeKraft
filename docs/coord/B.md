# Mac B status
Updated: 2026-10-29
## Tasks
- P1-01 | ready | branch feat/p1-01-ledger | vitest tests/unit/ledger-debit-credit.test.ts: 1 pass
- P1-02 | ready | branch feat/p1-02-dashboard-widgets | vitest tests/unit/admin/dashboard-finance-core.test.ts: 3 pass (+45 existing widget tests)
- P1-03 | doing | branch feat/p1-03-notifications
- P1-04 | doing | branch feat/p1-04-approvals-card
- P1-05 | ready | branch feat/p1-05-email-failures | vitest tests/unit/lib/email/transport.test.ts: 12 pass
## Requests to A
- [open] Set in Vercel Production once a domain exists: EMAIL_TRANSPORT=resend, RESEND_API_KEY, EMAIL_FROM on the verified domain | P1-05 banner stays until then | admin banner gone, test signup email arrives
## Log
- 2026-10-29 Mac B set up. Started Phase 1 (P1-01..P1-05) in parallel.
- 2026-10-29 P1-01, P1-02 ready. Note: expenses-vs-profit widget keeps its 6-month trend window by design.
- 2026-10-29 P1-05 ready. No magic-link email exists in the code, so nothing to route there. All mail already used one sendEmail; it now logs every failure, and the admin layout shows a red banner until the sender is configured.

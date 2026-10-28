# Mac B status
Updated: 2026-10-29
## Tasks
- P1-01 | ready | branch feat/p1-01-ledger | vitest tests/unit/ledger-debit-credit.test.ts: 1 pass
- P1-02 | ready | branch feat/p1-02-dashboard-widgets | vitest tests/unit/admin/dashboard-finance-core.test.ts: 3 pass (+45 existing widget tests)
- P1-03 | ready | branch feat/p1-03-notifications | vitest tests/unit/notifications/read-state.test.ts: 2 pass; tests/unit/admin + account: 128 pass
- P1-04 | ready | branch feat/p1-04-approvals-card | vitest tests/unit/admin/approval-text.test.ts: 10 pass; integration inbox-labels.test.ts updated, not run (needs DB)
- P1-05 | ready | branch feat/p1-05-email-failures | vitest tests/unit/lib/email/transport.test.ts: 12 pass
- P2-01 | ready | branch feat/p2-01-version-upload | vitest tests/unit/media: 20 pass (new release-file-installers.test.ts)
- P2-02 | ready | branch feat/p2-02-licence-on-confirm | vitest tests/unit/payments: 37 pass (new confirm-license-keys.test.ts)
- P2-03 | ready | branch feat/p2-03-post-payment-access | vitest tests/unit/account/download-panel.test.tsx: 1 pass
- P2-04 | ready | branch feat/p2-04-pdf-preview | vitest tests/unit/site/pdf-preview.test.tsx + tests/unit/middleware.test.ts: 12 pass
- P3-01 | doing | branch feat/p3-01-legal-publish
- P3-02 | doing | branch feat/p3-02-client-logos
- P3-03 | doing | branch feat/p3-03-case-studies
- P3-04 | doing | branch feat/p3-04-landing-labels
- P3-05 | doing | branch feat/p3-05-cta-target
## Requests to A
- [open] Set in Vercel Production once a domain exists: EMAIL_TRANSPORT=resend, RESEND_API_KEY, EMAIL_FROM on the verified domain | P1-05 banner stays until then | admin banner gone, test signup email arrives
- [open] R2 private bucket CORS must allow PUT from the admin origin | P2-01 browser uploads straight to R2 | upload a .dmg on a product version, it completes and appears
## Log
- 2026-10-29 Mac B set up. Started Phase 1 (P1-01..P1-05) in parallel.
- 2026-10-29 P1-01, P1-02 ready. Note: expenses-vs-profit widget keeps its 6-month trend window by design.
- 2026-10-29 P1-05 ready. No magic-link email exists in the code, so nothing to route there. All mail already used one sendEmail; it now logs every failure, and the admin layout shows a red banner until the sender is configured.
- 2026-10-29 P1-03, P1-04 ready. Phase 1 complete. Merge note: P1-03 and P1-05 both edit src/app/(admin)/admin/layout.tsx (different lines). P1-03: bell and badge refresh every 20 s (admin) / 30 s (account); account bell has "Mark all read" only. P1-04: please run tests/integration/approvals/inbox-labels.test.ts in the full gate.
- 2026-10-29 P2-01 ready. The upload flow already existed; installer types were rejected. Release files (admin-only, private) now skip the extension block and the content check. No migration.
- 2026-10-29 P2-04 ready. Product PDFs show in an inline viewer with an Open PDF link. Only /api/files/product-media/* may now be framed, and only by this site (SAMEORIGIN). Please check in a live browser.
- 2026-10-29 P2-02, P2-03 ready. Phase 2 complete. P2-02: the confirm-payment dialog has an optional licence key for each licence item, saved in the same transaction. P2-03: the Download button was fake (it waited 600 ms and did nothing); it now opens the real download route, and "no cap" shows as Unlimited. Live test: confirm a test order with a key, then download and reveal it as the customer.

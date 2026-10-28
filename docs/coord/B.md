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
- P3-01 | ready | branch feat/p3-01-legal-publish | vitest tests/unit/content: 14 pass (new legal-publish.test.ts)
- P3-02 | ready | branch feat/p3-02-client-logos | vitest tests/unit/site: 37 pass (new logo-strip.test.tsx)
- P3-03 | ready | branch feat/p3-03-case-studies | vitest tests/unit/admin/case-study-sync.test.ts: 3 pass; e2e tests/e2e/flows/case-studies.spec.ts not run (needs DB+server)
- P3-04 | ready | branch feat/p3-04-landing-labels (base 406027c) | vitest tests/unit/content/landing-field-help.test.ts: 3 pass
- P3-05 | ready | branch feat/p3-05-cta-target (stacked on P3-04, merge P3-04 first) | vitest tests/unit/content: 23 pass
- P4-01 | ready | branch feat/p4-01-theme-palette | vitest tests/unit/palettes/palettes.test.tsx: 12 pass (WCAG AA for all 8 palettes)
- P4-02 | ready | branch feat/p4-02-settings-propagation (stacked on P4-01, merge P4-01 first) | vitest settings-propagation + palettes + site-brand: 22 pass; tests/unit/lib + modules: 292 pass
- P4-03 | ready | branch feat/p4-03-ai-settings | vitest tests/unit/chat: 9 pass (new ai-settings.test.ts)
- P5-01 | ready | branch feat/p5-01-service-icons | vitest tests/unit/site/service-icons.test.tsx: 3 pass; services-editor.test.tsx: 3 pass
- P5-02 | ready | branch feat/p5-02-service-cards (stacked on P5-01, merge P5-01 first) | vitest tests/unit/site: 39 pass
- P6-01 | ready | branch feat/p6-01-logo-strip-once | vitest tests/unit/site + cta-target: 51 pass (one strip asserted, coarse pointer = no magnify)
- P6-02 | ready | branch feat/p6-02-site-logo | vitest tests/unit/lib, settings, admin, invoices, media: 363 pass (new site-logo.test.tsx)
- P6-05 | doing | branch feat/p6-05-reset-site-data
- P6-03 | doing | branch feat/p6-03-invoice-output (stacked on P6-02)
- P6-04 | todo | last (UI sweep)
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
- 2026-10-29 P3-01 ready. The public /legal pages showed hard-coded copy and never read the database. They now show the last published version and refresh when a page is published. P3-02 ready: client logos scroll with a Dock-style magnify effect, off when the user prefers reduced motion; admins can reorder logos. P3-03 ready: the editor kept a stale copy after saving, so a second save hit the duplicate-slug error and Publish stayed disabled. Please run the new case-studies e2e in the full gate.
- 2026-10-29 P3-04, P3-05 ready. Phase 3 complete. The landing page used to ignore the CTAs saved in content. The hero and the Build/Sell/Proof/Talk sections now use them; an empty secondary hides that button. Stored links are re-checked when the page renders, so old unsafe values are dropped.
- 2026-10-29 P4-01 ready. Theme is no longer locked. New "visitors can switch theme" toggle and 8 accent palettes, applied site-wide from the root layout. Light theme no longer needs the FEATURE_THEME_LIGHT_EDITORIAL env flag. No migration (key/value settings).
- 2026-10-29 P4-03 ready. Model picker is sorted cheapest first with prices: Haiku 5.5 $0.10/$0.50, GPT-4o mini, Sonnet 5.5 $2/$10, Opus 5.5 $4/$20 per MTok. Default model, caps and timeout now come from settings and are enforced; the Anthropic provider gained a timeout and real errors. Open findings (not fixed): retrieval is never wired, so the chat has no knowledge grounding; Anthropic is not sent the capture_lead tool; LLM_PROVIDER vs AI_PROVIDER env name mismatch.
- 2026-10-29 P4-02 ready. Phase 4 complete. A-010: only super_admin has settings.write (by design); the screen now explains why fields are read-only. Invoice, blog author, email subjects, JSON-LD and footer contact (legal name, address, email, phone) now come from settings; hard-coded Bangalore/billing@ fallbacks are removed. Issued invoices keep their snapshot. Left: 2FA issuer/TOTP label still "CodeKraft". To test: set seller details as super_admin, then check the footer and a new invoice.
- 2026-10-29 P5-01, P5-02 ready. All phases (P1-P5) are ready. One shared registry of 40 lucide icons with a searchable picker and dark/light preview; unknown stored icons still fall back to sparkles. Service cards redesigned (one link per card, highlights, hover glow, reduced motion respected). The /services page has per-service sections, not cards, so it is unchanged. Merge order for stacked branches: P3-04 then P3-05, P4-01 then P4-02, P5-01 then P5-02.
- 2026-10-29 P6-01 ready. The logo strip was rendered in both the hero and Proof; now one strip sits below Proof. No horizontal overflow (overflow-hidden, transform-only marquee, fixed logo height). Magnify only on a mouse or trackpad. Please check live at 360, 768 and 1280 px.
- 2026-10-29 P6-02 ready. New site logo setting (PNG/JPEG/WebP up to 2 MB; SVG not allowed). Used in the header, footer, account and admin shells, email header, favicon and the new invoice snapshot. With no logo, the site name shows as text and the favicon is a neutral icon; the CodeKraft monogram and wordmark files are removed or replaced. No migration.

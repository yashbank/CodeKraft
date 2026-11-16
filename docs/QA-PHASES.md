# QA phases (P19): hardening before wider launch

Rules: work on branches, nothing goes to `main` until the user says "go" once at the end. No automated load or scans on the live site.
Resume rule: continue at the first phase that is not DONE. Update this file at the end of every phase.

Base: origin/main 9ff63c6. Integration branch: qa/p19-integration. Phase branches: qa/p19-<n>-<slug>.

| # | Phase | Status | Branch | Evidence | Est |
|---|-------|--------|--------|----------|-----|
| 1 | Remove Turnstile widget; hidden honeypot + rate limit + server checks | DONE (gate green) | qa/p19-1-honeypot aef25b8 + 996c3d1 | typecheck/lint clean, vitest 2415/2417 (2 load timeouts, re-run green), own e2e 8/8; open: p14-06 + r9-13 failed locally, verify vs base | 1 h |
| 2 | Settings phase toggle (Live/Testing/Maintenance), badge only for super admin, Testing = banner + noindex + block customer emails | DONE (gate green) | qa/p19-2-phase-toggle 70366cf + qa/p19-8-requests | typecheck/lint clean, vitest 2428/2430 (2 load timeouts), own e2e 8/8; OPEN: 7 regression e2e failed on goto('/') load (suspected /_next/image timeout under load, unproven vs base) | 1.5 h |
| 3 | UAT click-through, local copy, 375/768/1280 | DONE (3 full rounds x 514 tests green) | | | 1 h |
| 4 | Security checks (authz, input, uploads, headers, rate limits, secrets) | 4a audit DONE; 4b fixes BUILT, merged | qa/p19-4-security 1655a6a | 7 fixes + ~45 new tests; vitest 2455/2459 (4 = my test bug fixed + 2 flakes), 128 login/auth e2e green | 1.5 h |
| 5 | Local stress test, ramped and capped | DONE | | | 0.5 h |
| 6 | Neon test branch + one Vercel preview, slow manual checks, combined report | SKIPPED (risk, see log) | | | 1 h |

## Log
- Started. Decisions: Turnstile removed in favour of hidden protection; phase label plus safe behaviour; tests local plus one preview; one combined go at the end; Neon test branch allowed.
- Phase 1 built by agent (aef25b8). Risks: rate-limit store in memory (per serverless instance); direct POST bots only limited by rate limits; p14-06 (ECONNRESET download) and r9-13 (chat) failed locally, must re-check on base.
- Phase 2 built (70366cf): site_settings.site_phase; middleware probe /api/site-phase cached 3 s per instance (watch Vercel request count); outbox skips customer mail in testing (status failed, 'skipped-by-phase'); sitemap may be stale up to 1 h after switch.
- Phase 4a audit: HIGH resend webhook unsigned; MED trustedOrigins *.vercel.app, razorpay event dedupe before confirm, rate limits in-memory + unused classes, orphan uploads; LOW /dev/screens on Vercel prod, cron fail-open, CSP report-only, handoff token in URL. 4b agent fixing all but last two (owner: set CSP_MODE=enforce, RESEND_WEBHOOK_SECRET).
- Phase 4b built (1655a6a): resend webhook signed (503 in prod until RESEND_WEBHOOK_SECRET set), trustedOrigins wildcard off in prod, razorpay retry-safe, auth rate limits wired, orphan uploads deleted, dev/screens + cron fail closed. OWNER TODO at deploy: set RESEND_WEBHOOK_SECRET and CSP_MODE=enforce in Vercel prod (neither exists today; CRON_SECRET exists). OPEN: possible razorpay confirm bug 'No user identified for posting created_by' for customer-created orders, verify.
- Final gate: 3 parallel full e2e rounds on qa/p19-integration (acts as UAT at 3 widths), then stress (local), then Neon branch + preview.
- Gate round 1 on integration b093059: all 3 rounds red on same 3 tests (r9-13 chat x2, p14-13 a11y). Causes: (1) time trap silently dropped fast human submits -> now retryable 429 'Please wait a moment' (996c3d1); (2) Reveal faded visible cards on load, axe caught mid-fade, exposed by Turnstile script removal -> fixed (b57f577). c16-theme-defaults flake: no phase-2 cause found, 10/10 quiet-machine runs. Watch: auth rate limit may trip after ~40 logins from one IP in a loop (one setup failure seen).
- Gate round 2 running on integration HEAD.
- Gate round 2 (f044fc9): 3/3 rounds green (A 67, R 5, B 442 each). Phase 5 stress DONE: no bottleneck to 100 concurrent, abuse limits pass; found per-view /api/site-phase call (+ 3 s middleware probe) and /api/leads error leak -> agent fixing (qa/p19-8-requests).
- Razorpay: REAL BUG fixed (5a3e200): customer-created orders had created_by NULL so webhook confirm 409'd (finance/posting.ts:193). Fix sets createdBy in createOrder + quote-to-order. DATA FIX NEEDED (needs owner go): existing live orders with created_by NULL still 409 on webhook confirm until backfilled.
- Open for owner: persistent rate-limit store (needs migration/Upstash); CSP unsafe-inline on static pages (pre-existing).
- Gate round 3 on f9cd2ac: 3/3 rounds green (A 67, R 5, B 442 each, 0 failed). Unit: typecheck clean, lint 0 errors, vitest 466 files / 2506 tests passed. Prettier-only touch-up on 3 files after. Phase 6 (preview) skipped by decision: preview DB is a copy of live data and shares live R2/email keys. READY FOR OWNER GO. Deploy plan: ff main to qa/p19-integration, push, create_deployment, verify 200 + new routes; set CSP_MODE=enforce in Vercel prod; owner adds RESEND_WEBHOOK_SECRET; owner OKs backfill of orders.created_by NULL.

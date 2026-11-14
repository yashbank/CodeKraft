# QA phases (P19): hardening before wider launch

Rules: work on branches, nothing goes to `main` until the user says "go" once at the end. No automated load or scans on the live site.
Resume rule: continue at the first phase that is not DONE. Update this file at the end of every phase.

Base: origin/main 9ff63c6. Integration branch: qa/p19-integration. Phase branches: qa/p19-<n>-<slug>.

| # | Phase | Status | Branch | Evidence | Est |
|---|-------|--------|--------|----------|-----|
| 1 | Remove Turnstile widget; hidden honeypot + rate limit + server checks | BUILT, merged into integration, final gate pending | qa/p19-1-honeypot aef25b8 | typecheck/lint clean, vitest 2415/2417 (2 load timeouts, re-run green), own e2e 8/8; open: p14-06 + r9-13 failed locally, verify vs base | 1 h |
| 2 | Settings phase toggle (Live/Testing/Maintenance), badge only for super admin, Testing = banner + noindex + block customer emails | BUILT, merged into integration, final gate pending | qa/p19-2-phase-toggle 70366cf | typecheck/lint clean, vitest 2428/2430 (2 load timeouts), own e2e 8/8; OPEN: 7 regression e2e failed on goto('/') load (suspected /_next/image timeout under load, unproven vs base) | 1.5 h |
| 3 | UAT click-through, local copy, 375/768/1280 | todo | | | 1 h |
| 4 | Security checks (authz, input, uploads, headers, rate limits, secrets) | 4a audit DONE; 4b fixes BUILT, merged | qa/p19-4-security 1655a6a | 7 fixes + ~45 new tests; vitest 2455/2459 (4 = my test bug fixed + 2 flakes), 128 login/auth e2e green | 1.5 h |
| 5 | Local stress test, ramped and capped | todo | | | 0.5 h |
| 6 | Neon test branch + one Vercel preview, slow manual checks, combined report | todo | | | 1 h |

## Log
- Started. Decisions: Turnstile removed in favour of hidden protection; phase label plus safe behaviour; tests local plus one preview; one combined go at the end; Neon test branch allowed.
- Phase 1 built by agent (aef25b8). Risks: rate-limit store in memory (per serverless instance); direct POST bots only limited by rate limits; p14-06 (ECONNRESET download) and r9-13 (chat) failed locally, must re-check on base.
- Phase 2 built (70366cf): site_settings.site_phase; middleware probe /api/site-phase cached 3 s per instance (watch Vercel request count); outbox skips customer mail in testing (status failed, 'skipped-by-phase'); sitemap may be stale up to 1 h after switch.
- Phase 4a audit: HIGH resend webhook unsigned; MED trustedOrigins *.vercel.app, razorpay event dedupe before confirm, rate limits in-memory + unused classes, orphan uploads; LOW /dev/screens on Vercel prod, cron fail-open, CSP report-only, handoff token in URL. 4b agent fixing all but last two (owner: set CSP_MODE=enforce, RESEND_WEBHOOK_SECRET).
- Phase 4b built (1655a6a): resend webhook signed (503 in prod until RESEND_WEBHOOK_SECRET set), trustedOrigins wildcard off in prod, razorpay retry-safe, auth rate limits wired, orphan uploads deleted, dev/screens + cron fail closed. OWNER TODO at deploy: set RESEND_WEBHOOK_SECRET and CSP_MODE=enforce in Vercel prod (neither exists today; CRON_SECRET exists). OPEN: possible razorpay confirm bug 'No user identified for posting created_by' for customer-created orders, verify.
- Final gate: 3 parallel full e2e rounds on qa/p19-integration (acts as UAT at 3 widths), then stress (local), then Neon branch + preview.
- Gate round 1 on integration b093059: all 3 rounds red on same 3 tests (r9-13 chat x2, p14-13 a11y). Causes: (1) time trap silently dropped fast human submits -> now retryable 429 'Please wait a moment' (996c3d1); (2) Reveal faded visible cards on load, axe caught mid-fade, exposed by Turnstile script removal -> fixed (b57f577). c16-theme-defaults flake: no phase-2 cause found, 10/10 quiet-machine runs. Watch: auth rate limit may trip after ~40 logins from one IP in a loop (one setup failure seen).
- Gate round 2 running on integration HEAD.

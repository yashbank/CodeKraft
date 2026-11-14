# QA phases (P19): hardening before wider launch

Rules: work on branches, nothing goes to `main` until the user says "go" once at the end. No automated load or scans on the live site.
Resume rule: continue at the first phase that is not DONE. Update this file at the end of every phase.

Base: origin/main 9ff63c6. Integration branch: qa/p19-integration. Phase branches: qa/p19-<n>-<slug>.

| # | Phase | Status | Branch | Evidence | Est |
|---|-------|--------|--------|----------|-----|
| 1 | Remove Turnstile widget; hidden honeypot + rate limit + server checks | BUILT, merged into integration, final gate pending | qa/p19-1-honeypot aef25b8 | typecheck/lint clean, vitest 2415/2417 (2 load timeouts, re-run green), own e2e 8/8; open: p14-06 + r9-13 failed locally, verify vs base | 1 h |
| 2 | Settings phase toggle (Live/Testing/Maintenance), badge only for super admin, Testing = banner + noindex + block customer emails | todo | qa/p19-2-phase-toggle | | 1.5 h |
| 3 | UAT click-through, local copy, 375/768/1280 | todo | | | 1 h |
| 4 | Security checks (authz, input, uploads, headers, rate limits, secrets) | todo | | | 1.5 h |
| 5 | Local stress test, ramped and capped | todo | | | 0.5 h |
| 6 | Neon test branch + one Vercel preview, slow manual checks, combined report | todo | | | 1 h |

## Log
- Started. Decisions: Turnstile removed in favour of hidden protection; phase label plus safe behaviour; tests local plus one preview; one combined go at the end; Neon test branch allowed.
- Phase 1 built by agent (aef25b8). Risks: rate-limit store in memory (per serverless instance); direct POST bots only limited by rate limits; p14-06 (ECONNRESET download) and r9-13 (chat) failed locally, must re-check on base.

# CODEKRAFT — ISSUES FOR THE FOUNDERS

Questions and decisions engineering cannot make alone (master plan §8). One row per item. Agents add rows when a phase file says "founder decision" or when two documents disagree and MASTER_SPEC does not resolve it. Founders answer in the "Decision" column; the resolving agent records where the decision was applied (doc + code) and closes the row. Never delete rows — rows whose question the documentation has since settled move to "Resolved during documentation" with the resolving section.

Status: `open` · `answered` · `applied` · `deferred-v1.1` · `withdrawn`.

## Open items

| # | Raised in | Question / conflict | Options | Default if unanswered by the phase's start | Decision | Applied in | Status |
|---|-----------|---------------------|---------|---------------------------------------------|----------|------------|--------|
| I-004 | P5.4 / P6.2 | License-key email: every document now says the email and in-app notification carry only a dashboard link and never the key (FR-DEL-07, API-DEL-08, docs/12 §7, TM-05, MASTER_SPEC §7 "License key delivery"). MASTER_SPEC explicitly lets the founder relax this to plaintext email (raises the TM-05 residual to Medium). Do you want that? | (a) link only (default); (b) plaintext key in email behind a settings flag `licenseKeyInEmail` | (a) — nothing is built for (b) until answered | (a) link only | P5.4, P6.2 | answered |
| I-005 | P9.2 / P6 | Rate limits: NFR-SEC-03, docs/06 §1.7 and docs/09 §7 now carry one identical value set, marked **proposed** (login 10/15 min per IP and 5/15 min per account; signup 5/h; chat 30/10 min; download 20/h; checkout 10/day; admin 300/min; …). Confirm or tune before P9.2 wires them (they stay tunable in `site_settings` afterwards). | confirm as-is; tune specific rows | confirm as-is | confirm as-is | P9.2 | answered |
| I-012 | P9.11 | X-06 requires three nightly backups and one restore drill before launch (docs/13 §3.3, docs/12 §5.3). If you want to launch earlier, the third night can follow launch with the drill on day 3. | wait for 3 nights; launch and drill after | wait for 3 nights | default: wait for 3 nights (founder did not choose; may relax at P9.11) | P9.11 | answered |
| I-014 | P8.2 | Widget dashboard fallback (master plan §7): if react-grid-layout proves unstable with React 19, ship a fixed layout for `v1.0.0` and defer customisation. Decision needed only if P8.2 reports instability. | keep grid; fixed layout | keep grid | keep grid | P8.2 | answered |
| I-015 | P7.3 / P7.12 | 3D hero fallback (master plan §7): if `/` cannot reach LHCI performance ≥ 0.85 with the scene, ship poster-only with `three_hero` off. Decision needed only if P7.12 reports a miss. | keep; poster-only | keep, flag stays on | keep, tune scene | P7.3, P7.12 | answered |
| I-018 | P9.8 | Delivery date for content inputs (E-05: eight services copy, ≥ 3 case studies, legal drafts, landing copy, five products) and design assets (E-07: logo, posters, fonts). Launch cannot be tagged with placeholder content (no-placeholder test, X-07/X-10). | date | — | within 3 days of 2026-09-25 (by 2026-09-28) | P9.8 | answered |
| I-019 | P1.5 | Session hardening beyond D-1203, marked **proposed** in docs/09 §3.4 and TM-10 (docs/09 Open #8): absolute session maximum 7 days (customer) / 12 hours (admin) on top of the idle timeouts, and admin sessions bound to the user-agent fingerprint. Accept? | accept both; accept maximums only; idle timeouts only | accept both (implemented behind config constants) | accept both | P1.5 | answered |
| I-021 | P14.1 | Charging currency before Stripe/PayPal (docs/13 Open #6, §4.2 item 4): D-502 charges in base currency (INR) only; international gateways can charge in the display currency. Decide before P14 (also revisited for V2 recurring billing). | keep base currency; charge in display currency | keep base currency | | | deferred-v1.1 |

## Resolved during documentation

Items raised while the phase files were written and since settled by the reviewers' alignment of `docs/`, `ui/` and `MASTER_SPEC.md`. No founder answer is needed; the phase files now follow the cited sections.

| # | Raised in | Question / conflict as raised | Resolved by | Applied in |
|---|-----------|-------------------------------|-------------|------------|
| I-001 | P1.7 / P9.1 | Inline theme script on cached (ISR) pages: a per-request CSP nonce cannot be embedded in shared HTML. | Engineering decision, no founder input: nonce on dynamic responses, the static ≤ 300-byte script hash-allow-listed on cached routes (MASTER_SPEC §7 "Theme attribute on ISR pages", docs/09 §9). P9.12 records the wording note. | P1.7, P7.1, P9.1 |
| I-002 | P1.10 | docs/10 §2 named the first CI job `static`; docs/12 §4.1 names `lint` + `typecheck`. | docs/12 §4.1 / §4.2 names are canonical; docs/10 §2 and §13 now use them (`lint`, `typecheck`, `unit`, `integration`, `build`, `e2e`, `axe`, `lhci`). | P1.10, P9.6, docs/10 §2, §13 |
| I-003 | P4.6 / P7.9 | Checkout and quote URLs differed between MASTER_SPEC and docs/07 / `ui/sitemap.md`. | MASTER_SPEC §7 "Auth and checkout URLs", `ui/sitemap.md` §2–§3, docs/07 §8.2–§8.3: `/auth/*`, `/checkout/[offeringId]`, `/quote/[token]`. No redirects from other paths. | P4.6, P7.5, P7.8, P7.9 |
| I-006 | P5.7 / P9.4 | Cron job keys differed across docs/06, docs/12 and docs/10. | One key set in docs/06 §3.3 = docs/12 §2.3 = docs/09 §5.3 = docs/10 §6, two endpoints `/api/cron/frequent` and `/api/cron/daily`; no materialized-view refresh. Job files per master plan §3 (`fx`, `publish`, `knowledge` P3; `order-expiry`, `quote-expiry` P4; `subscriptions`, `retention` P5; `email-outbox`, `lead-digest`, `chat-purge` P6). Two SRS-required jobs (`finance.reconcile` NFR-DATA-04, `queries.autoclose` FR-LEAD-09) are not yet in the table — P9.4 runs them from `daily`, P9.12 files the doc correction. | P3.9, P3.12, P3.13, P4.2, P4.6, P5.7, P6.1, P6.4, P6.6, P9.4 |
| I-007 | P8 | `ui/sitemap.md` §4 used permission names absent from docs/06 §1.2. | `ui/sitemap.md` §4 now uses the docs/06 §1.2 strings verbatim. | P8 prerequisites, P8.14 |
| I-008 | P3.3 | Base-currency lock differed (any order / pending order / first paid order). | FR-ADM-10, API-ADM-10 and MASTER_SPEC §7 "Base currency lock" all say: read-only after the first `paid` order. | P3.3, P8.13 |
| I-009 | P4.4 | Overpayment: memo requirement and disposition of the excess. | FR-PAY-07 / API-PAY-03: excess recorded as `payments.customer_credit_minor`, shown to admins, never allocated, ledger posts on `amount_due`; docs/05 §7 `customer_credits` view and API-FIN-09 report it. No memo required; any pay-back is an ordinary `refund.issue` on that payment. | P4.4, P8.6 |
| I-010 | P2.4 / P4.5 | Tables missing from docs/05 (`rate_limit_buckets`, `credit_note_sequences`, `legal_page_versions`, `email_outbox.priority`). | All present in docs/05 (§5, §10, §11), plus `slug_redirects`, `orders.split_approval_request_id` and the `customer_credits` view. No phase adds migrations after P2. | P2.1–P2.4, P3.11, P4.5 |
| I-011 | P6.7 | TM-08 required explicit user confirmation before the chatbot creates a lead; docs/06 §3.2 emitted `lead` directly. | docs/06 §3.2 `event: lead_intent` + API-CHAT-15 `confirmLeadCapture`; docs/04 §9 and docs/09 TM-08/§11: `capture_lead` is a side-effect-free intent tool. | P6.7, P7.11 |
| I-013 | P9.9 | Vercel Hobby is single-member: only one founder has dashboard access until Pro or the VPS. | Interim accepted in MASTER_SPEC §7 "Admin host during interim" and docs/12 §2.1; which founder holds the Vercel account is an item of `FOUNDER-CHECKLIST.md` (P9.10), not a design decision. | P9.9, P9.10 |
| I-016 | P3.4 | Better Auth has no first-party invitation flow. | Engineering approach, no founder input: one-time login link with the role pre-assigned on first login, satisfying API-ADM-11 "invite email". | P3.4 |
| I-017 | P5.7 | Anonymisation timing: immediate vs 30-day job. | Immediate, inside the API-AUTH-08 transaction (BR-18, FR-DASH-08, NFR-DATA-01, docs/05 §12, docs/09 §5.3, docs/12 Open #8); `users.anonymise` is a safety sweep only. Privacy copy states it (P9.8). | P3.4, P5.7, P9.7, P9.8 |
| — | P6.3 / P9.3 | Turnstile fail-closed: an outage blocks lead capture. | Accepted residual risk recorded in MASTER_SPEC §7 "Turnstile outage" (docs/09 TM-07, Open #7); not reopened here. | P6.3, P9.3 |

## Answered / applied

| # | Decision | Applied in | Date |
|---|----------|------------|------|
| I-004, I-005, I-012, I-014, I-015, I-018, I-019 | See Open items table (Decision column) | per row | 2026-09-25 |

## Carried to V1.1

| # | Item | Target phase |
|---|------|--------------|
| I-021 | Charging-currency decision (D-502 vs display currency) | P14.1 |

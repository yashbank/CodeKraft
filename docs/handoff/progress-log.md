# Progress log (2026-10-07)

Resume point. Newest entries at the bottom.

## Done (committed, deployed)
- Finance ledger, audit CSV, chatbot, case-study toolbar fixes (cb1a42b, a87636e, 14035e0, 45466cc)
- Singapore function region (fc66b68)
- Limit-200 list fixes on 5 pages (6bc84ac); admin pages now ~0.8s warm
- Homepage ISR (0e3deef)

## In progress
- Admin landing sign-in loop fix (agent a0a3a2e), waiting on its report

## Blocked on founder
- Customer email verification: verify sending domain in Resend, set EMAIL_FROM, EMAIL_TRANSPORT=resend, ALLOW_LOG_EMAIL off

## Next (start after login fix lands)
1. Two-admin product approvals with 4-5 ownership splits (Yash, Sanket)
2. Customer flows (needs verified customers)
3. Quality: tsc baseline 208, tests, stress round
4. Final check: dashboard, approvals, notifications

## Log
- 2026-10-07 02:34 IST: limit reset, phase 1 restarted; email root cause confirmed; speed phase done

## Phase 2 approvals
- 2026-10-07 02:57 IST | step 0 (saved-state check) | BLOCKED: admin-yash.json is rejected ("Sign in with an admin account to continue"), retried after 20s, same result. admin-sanket.json works (loads approvals). Likely evicted by a later sign-in (both states written 02:42). No sign-in attempted per rules. | product id: n/a

- 2026-10-07 02:58 IST | step 0 re-verify: both re-saved states load admin shell (yash, sanket). Resuming from step 0. | product id: n/a
- 02:59 IST | step 1 (partner records) | BLOCKED: partners are unique per user (partners.userId unique, not null) and only created via "Also a partner" in Invite admin (a NEW admin user, dual-approved). No UI path gives Yash or Sanket a partner record; none exist (Partner column is empty for both). No products created yet, no DB writes. Needs decision: invite test partner users, or change the split design. | product id: n/a
- 02:59 IST | step 1 DECISION: option (a) approved by coordinator. Inviting partner-a@ and partner-b@codekraft-test.invalid with Also a partner. Yash & Sanket cannot be partners (UI limit), so splits will be company cut + the two test partners. | product id: n/a
- 02:59 IST | step 1 (invite partner-a@codekraft-test.invalid) | NOT DONE: the auto-mode permission classifier denied the Playwright action that submits the admin invite. Stopped; no invite was sent and I did not try another route. Steps 1-5 paused until the user allows it. | product id: n/a
- 03:04 IST | step 2 (approve partner invites as Sanket) | BLOCKED: both saved states now rejected ("Sign in with an admin account"). Likely evicted by a manual sign-in after the 02:58 re-save. No sign-in attempted. Waiting for fresh states. | product id: n/a
- 03:05 IST | step 2 (approve partner-a and partner-b invites as Sanket) | NOT DONE: fresh states verified valid (yash, sanket). Located the invites (partner-a request d3362755, partner-b request f9102832, both awaiting approval, partner-b shows a stale Sanket "Approved" line from 03:03 in its detail). The auto-mode classifier denied the Approve action. No approval submitted. Stopped, no workaround. | product id: n/a
- 03:11 IST | step 2 recheck (partner records exist?) | NOT CONFIRMED: fresh states valid (yash, sanket at 03:10). Partner-a (d3362755) and partner-b (f9102832) invite requests are still "Awaiting approval" in Sanket inbox and not in History; admin users list shows them as Invited with no partner record (Partner column empty). Founder reported approving by hand, which the system does not reflect. No new approval action taken. | product id: n/a
- 03:14 IST | step 2 (partner records check) | STOPPED: fresh states valid (03:14). Partner-a request d3362755 and partner-b request f9102832 still Awaiting approval, not in History; users list shows no partner records. Stopped per instruction. | product id: n/a

## Approvals bugfix
- 2026-10-07 | step 1 (reproduce as Sanket) | BLOCKED: admin-sanket.json cookie is present (expires 22:14Z) but server rejects it ("Sign in with an admin account to continue") on two tries. No sign-in attempted. | product id: n/a
- 2026-10-07 | step 1 (read approval rows) | BLOCKED: CodeKraft is not in the Supabase projects list. A local env read to find a DB URL was denied by the auto-mode classifier, so no DB access was attempted. | product id: n/a
- 2026-10-07 | step 2 (code read) | HYPOTHESIS, not confirmed: DefaultApprovalsService.execute (service.ts) catches handler errors and then runs tx.update in the same transaction. If the handler's SQL failed, Postgres marks the tx aborted (25P02), the catch update throws, and the whole decide() tx rolls back, so the approve decision is lost while the client already got ok. Needs the real error to confirm. | product id: n/a
- 2026-10-07 | step 3 onward | NOT DONE: no fix, no deploy, no browser verification. Needs a valid Sanket session or the approval error text. | product id: n/a
- 2026-10-07 | step 1 (reproduce as Sanket, fresh state) | DONE: Approve on partner-b f9102832 returns HTTP 200 {"ok":true,"data":{"status":"pending","applied":false}}, no error. Sanket's approve decision row already exists (21:33Z, 03:03 IST), idempotent replay returns pending. | product id: n/a
- 2026-10-07 | step 2 (hypothesis 25P02 rollback) | REJECTED: the decision row persists after reload, so no rollback happened. Earlier invite ff/e2e-dbg (20:10Z) was approved by Sanket and is status applied with appliedAt set, so the apply handler works. | product id: n/a
- 2026-10-07 | step 2 (real cause, from payload) | Approval needs ALL active admin-class users except the requester (approver-set.ts). The admin list shows a real active admin row e2e-dbg (role Admin, status pending_change). Once e2e-dbg was created by an applied invite, it joined the approver set, so partner-a/partner-b stay pending until e2e-dbg also approves. Not confirmed via DB (DB access denied). | product id: n/a
- 2026-10-07 | step 3 (code fix) | NOT DONE: no code change. Clearing the blocker needs a founder decision (deactivate/remove e2e-dbg test admin, or have it approve). Also UI gap noted: ApprovalsInbox marks an approve as decided even when status is still pending, and "For my approval" keeps showing items Sanket already approved after reload. | product id: n/a
- 2026-10-07 | step 1 (UI truth) | DONE locally: ApprovalsInbox no longer keeps a local decided map; it shows server status and calls router.refresh() after approve/reject/cancel. Toasts use the server result. Removed the optimistic History move. | product id: n/a
- 2026-10-07 | step 2 (API agrees) | DONE locally: DecideResult gains waitingFor (pending) and error (apply failed). Approve toast says "Approval recorded, waiting for N more approvers". Detail shows "You approved this" with the count and hides the Approve button. | product id: n/a
- 2026-10-07 | build | tsc 208 (baseline), eslint clean on touched files, pnpm build exit 0 | product id: n/a
- 2026-10-07 | deploy | DONE: pushed 6b183bc to main; production deployment codekraft-4tb9wfgd8 is Ready (vercel ls codekraft --prod). | product id: n/a
- 2026-10-07 | step 3 (Playwright verify) | BLOCKED: saved admin-sanket.json and admin-yash.json are both rejected now ("Sign in with an admin account"), checked twice with a pause. Cookies still show expiry 22:21Z. No sign-in attempted. Not verified after deploy. | product id: n/a
- 2026-10-07 | step 4 (cleanup) | NOT DONE: cancel needs the requester session (Yash) and admin-user deactivation needs the DB or a session; both blocked by the same sign-in issue. Known items from the last payload read (pre-deploy): e2e-dbg invite request (deactivated by founder, applied earlier); e2e-invite-1791305509829 invite (pending); partner-a d3362755/2ddbb8b7 and partner-b f9102832/ff8f6764 (pending, now should complete since e2e-dbg is gone); pending admin.user_change 4h/5h old: bba387a0, 67acf326, c55be71d, f44a0458 (subjects unverified); ledger adjustment 4a5f8ca3 (financial, do not delete). | product id: n/a
- 2026-10-07 | step 5 (naming) | NOTE for future test data: use TEST- prefixes and test-partner-a@example.com style addresses, not codekraft-test.invalid. | product id: n/a
- 2026-10-07 | step 3 (verify, Sanket) | DONE: approve on partner-b f9102832 returned 200 with status pending (already approved by Sanket at 03:03, so no new decision). After reload the UI shows the same state as the server: still Awaiting approval, "You approved this. Waiting for 1 more approver before it applies." Approve button hidden. Not applied. Open question: which other active admin-class user is the 1 remaining approver; not visible in the admin list, needs a DB check. | product id: n/a
- 2026-10-07 | step 4 (cancel as Yash) | DONE, all test invites, each checked by email first: bba387a0 (e2e-dbg@codekraft-test.invalid), 67acf326 (e2e-dbg@codekraft-test.invalid), c55be71d (e2e-dbg@codekraft-test.invalid), f44a0458 (e2e-invite-1791305509829@codekraft-test.invalid, same item as e2e-invite-1791305509829). Each returned {"ok":true,"data":{"status":"cancelled","applied":false}}. | product id: n/a
- 2026-10-07 | not touched | partner-a d3362755 / 2ddbb8b7 and partner-b f9102832 / ff8f6764 remain pending (real test partners, left for the founder). Ledger adjustment 4a5f8ca3 not touched. | product id: n/a
- 2026-10-07 | cancel pass (partner-a, partner-b, other test items) | BLOCKED: admin-yash.json and admin-sanket.json are both rejected again ("Sign in with an admin account"), checked twice with a pause. No sign-in attempted. Nothing cancelled in this pass. | product id: n/a
- Still pending (last read before sign-out): partner-a d3362755 (approval 2ddbb8b7), partner-b f9102832 (approval ff8f6764, waiting for 1 more approver), user 73dbcaaa (not yet checked; its requester shows as Sanket in one payload and Yash in another), ledger adjustment 4a5f8ca3 (keep pending). | product id: n/a
- 2026-10-07 | cancel pass (Yash, fresh state) | DENIED by the auto-mode permission classifier ("Unverifiable Deletion Scope") on the batch cancel script. Nothing cancelled. Not retried in smaller pieces. Needs the user to confirm the cancel scope. | product id: n/a
- 2026-10-07 | read-only check as Yash | Pending requests seen in "Requested by me": two rows for user 73dbcaaa (kind remove, email not shown), partner-b invite (partner-b@codekraft-test.invalid), partner-a invite (partner-a@codekraft-test.invalid), partner-b f9102832 (ff8f6764), partner-a d3362755 (2ddbb8b7), one unidentified row, ledger adjustment 4a5f8ca3 (keep). Subject labels for rows 2-5 are unreliable in the page text; confirm by email before cancelling. | product id: n/a

## Resume 2026-10-07 ~04:02 IST
- Saved states valid (yash, sanket) read-only check. No sign-ins.
- Approvals list: 2 items for Yash, both "Admin user change: remove" for user 73dbcaaa (requested by Sanket). Yash approved one at 03:53; waiting for 1 more approver.
- Active admin-class users: Yash, Sanket only. e2e-dbg shows status "Pending change" (role Admin). Its removal is likely the missing approver, so the quorum is stuck. Unconfirmed until the DB row is checked.
- Partner-a and partner-b invites still Awaiting approval, not applied.
- BLOCKED on founder: confirm e2e-dbg/73dbcaaa status in DB, or approve their removal. DB access not attempted.
- Products and splits: not started (depend on partner records).

## Resume 2026-10-09 (new session, Phase 0)
- Discovery: unit 745/745, integration 279/280 (stale migration count), tsc 208 baseline, eslint 574 baseline. CI lint and typecheck jobs are red, so CI is not a gate.
- Root cause, offerings never shown: `getProductAdmin` and `getProductBySlug` in `src/modules/catalog/service.ts` returned `offerings: []` since 9d94f49. Fixed via `offeringsService.listForProduct` (admin includes inactive). Regression test `tests/integration/catalog/admin-offerings-visible.test.ts`.
- Founder decision: company-owned 100 % ownership allowed (`companyCutBps: 10000`, no lines). Schema, service and ProductEditor updated; test `tests/integration/ownership/company-owned-100.test.ts`.
- Pre-existing bug fixed: readiness summed partner lines + company cut, so any mixed split could never publish. Now lines alone must sum to 10000 when present. Assertion added to `propose-approve-apply.test.ts`.
- Push gate added: `pnpm gate` (`scripts/gate.sh`) with baselines in `scripts/gate-baseline-*.txt`; local pre-push hook on this machine runs it for pushes to main.
- Removed 16 committed empty `_tmp_21_*` files. Migration test now counts `drizzle/migrations/*.sql`.
- Founder decisions pending: Resend domain + `EMAIL_TRANSPORT`/`ALLOW_LOG_EMAIL` in Vercel; admin passwords in `2026-10-06-overnight-progress.md` to be rotated after password reset ships.

## Phase 2 (2026-10-09) customer purchase path
- Founder set Vercel prod: EMAIL_TRANSPORT=resend, EMAIL_FROM=CodeKraft <onboarding@resend.dev>, ALLOW_LOG_EMAIL removed. The resend.dev sandbox sender only delivers to the Resend account owner, so an audited admin fallback was built.
- Fixed: /account/purchases "Couldn't load your purchases" for every customer. `listMyEntitlements` and the admin list read `input.filters.*` with `filters` optional (TypeError → silent INTERNAL). Now `filters?.`. Test `tests/integration/entitlements/list-my-entitlements.test.ts`.
- Added: `unexpected()` in `src/lib/actions/envelope.ts` logs at error level (previously only Sentry); verification-mail rejection logged in `src/modules/auth/config.ts` (previously swallowed silently).
- Added: admin action "Mark email verified" (`API-ADM-09 customer.mark_email_verified`, permission `customers.reset_link`, audited, refuses admin-role and deleted users) with a button on the customer detail screen. Test `tests/integration/users/mark-email-verified.test.ts` incl. createOrder before/after.
- In progress: Playwright `tests/e2e/commerce/purchase-path.spec.ts` against local dev (register → verify via admin → coupon → place order → reference → admin confirm → entitlement).
- Phase 1 live publish click-through: not run by the agent (permission classifier blocks production sign-in as the founders); founder to click through or allow Playwright scripts.
- Browser lane found 4 bugs: (1) no `<Toaster/>` on the site/account hosts and checkout never passed `state="unverified"`, so customers saw no errors and unverified users got a form that silently failed; (2) `listCustomers`/`getCustomer` crashed on `lastOrderAt.toISOString` once any order exists (admin customers + dashboard 500); (3) payment confirm rejected by `append_only` on `invoices.pdf_media_id`; (4) pino-pretty transport throws under Next dev and masked real errors. All four fixed.
- (3) root cause: migration 0001 was edited in place on 2026-09-26 (commit 4535800) to add the pdf_media_id exemption to `ck_append_only()`, after it had been applied. Any DB migrated before that edit (local dev DB confirmed; **production Neon unverified**) still runs the old function and can never mark an order Paid. New idempotent migration `0003_append_only_pdf_exemption.sql` re-creates the function. Runs on the next production deploy if migrations run there; otherwise apply it by hand. Verify in prod: `select pg_get_functiondef('ck_append_only'::regproc)` should contain `pdf_media_id`.
- Bug 5 (browser lane, re-run): `confirmPayment` marked the order Paid but never called `entitlementsService.grantForOrder`, so customers never received what they bought (`entitlementIds: []` since P4). Now granted inside the same transaction via a dynamic import (entitlements → subscriptions → payments would otherwise be an import cycle). Download orders end as `fulfilled`; scenario S-02 expectation updated accordingly. `confirm-happy.test.ts` asserts at least one entitlement.

## Phase 3 (2026-10-09) approvals hardening, publish tooling
- Production DB (read-only check): 3 migrations applied, `ck_append_only` already has the pdf exemption, 0 orders, 8 products, 7 offerings, 23 users. Migration 0003 is a no-op there; applying it (journal sync) was blocked by the session permission classifier.
- Race fixed: `decide()` and `cancelRequest()` in `src/modules/approvals/service.ts` now `for("update")` the request row; before, an approve and a cancel could both succeed. Tests: `tests/integration/approvals/concurrent-approvers.test.ts` (two approvers at once, approve vs cancel, double approve), `reject-path.test.ts` (approve after reject → STATE_INVALID), `tests/integration/coupons/exhaustion-race-concurrent.test.ts` (coupon redemption already row-locked; exactly one of two concurrent confirms wins).
- Feature gap (not built): no `approval.approved` / `approval.rejected` notification is ever sent to the requester; only templates exist.
- UX gap (not fixed): approvals inbox subjects show ids ("product 62c5eead"), not names.
- `scripts/ops/publish-product.mjs`: parameterised Playwright ops script, two-admin publish flow, proven locally end to end (7 steps). Production run needs the founder's permission rule for Playwright/node in this session. Quorum = every other active admin-class user, so production must have exactly Yash + Sanket active for one approval to apply.
- Vercel: pasted token rejected by the CLI ("not valid"); need an account token scoped to the team.
- Foundation e2e green again (3 runs): stale login-logout spec updated; customer "Sign out" menu item had no handler (fixed, `AccountShell.tsx`); LoginForm submit disabled until hydrated; privacy link underlined for axe `link-in-text-block`; axe fixture waits for animations.
- Found, not fixed: account overview shows "We couldn't load your dashboard" (UNAUTHENTICATED AppError) for a fresh unverified customer. Phase 4 sweep.

## Phase 4 (2026-10-10) sweep and debt
- Requester now gets an in-app `approval.approved` / `approval.rejected` notification (same tx, `src/modules/approvals/service.ts` notifyRequester). No email yet.
- Approvals inbox shows names: `src/lib/admin/approvals-view.ts` resolveSubjectLabels (3 batched queries: product, ownership→product, user). Full id kept in the detail header for ops scripts. Test `inbox-labels.test.ts`.
- Customer overview "couldn't load your dashboard": wishlist query on `/account` lacked the required `displayCurrency`. Fixed; test `tests/integration/account/overview-queries.test.ts`.
- Scout (local, 66 page loads, 52 clean). Fixed: `/quote/<bad token>` 500 → 404 (`token-lookup.test.ts`); allocations duplicate React keys (partner name columns deduped); manual entitlement grant on customer detail wired to the existing `grantEntitlementManualAction` (`entitlements.admin`); chatbot purge-one-conversation, rebuild index and dry-run wired (`chat.prompts.write`); case-study cover image and client logo uploads via the shared `uploadMediaFile` helper (gallery still out).
- Not bugs: "[PLACEHOLDER]" titles are seed content on local only. Deferred to Phase 5 decision: project orders (client invoice) in `/admin/orders/new` (`ManualOrderForm.tsx` ~L701) need a finance-approved split flow; case-study gallery upload.
- Debt noted: published-offering options query now exists inline in both `/admin/orders/new` and `/admin/customers/[id]` pages; extract in the debt lane.

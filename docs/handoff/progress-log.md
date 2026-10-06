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

# Phase 18 plan, status table and checklists

## Status table (A updates after every task)
| # | Task | Machine | Status | Time |
|---|------|---------|--------|------|
| 1 | Deploy permanent delete (0374a54) | A | DONE, live | - |
| 2 | Find why old super admins could not be removed; show pending approvers by name and email | A | todo | 1.5 h |
| 3 | Uploads: every format to R2, no CORS or policy errors, all media fields | B | todo | 2.5 h |
| 4 | SEO fields unlimited | B | todo | with 3 |
| 5 | Partners, Payouts, Allocations, Ledger: drop removed admins and shares | B | todo | with 3 |
| 6 | Stronger approvals checks | B | todo | with 3 |
| 7 | Theme presets with real previews, all screen sizes | B | todo | 3 h |
| 8 | Simpler, mobile-friendly admin screens | B | todo | with 7 |
| 9 | Content-writer guide, note for Sanket (privacy and legal pages) | A | todo | 1.5 h |
| 10 | Wipe, backup, restore rounds on a COPY of the data | A | todo | with 9 |
| 11 | Repeat all tests, deploy with approval, tester checklist | A | todo | 1 h |

## UI checks after the deploy (hard refresh first)
1. Admin > Customers: no admin, super admin or staff emails in the list.
2. Customers: row menu "Delete", bulk "Delete selected", and "Delete permanently" on the customer page. Each asks you to type the email or DELETE.
3. Delete one demo customer. It disappears and its email can be used again.
4. Admin > Admin users: remove a test admin. The approval text says the account is deleted for good.
5. Do NOT remove the old super admins until your two new ones are invited, approved and able to log in.
6. Settings > Danger zone: open it and read it. Run a reset only if you want live data wiped.
7. Check the Customers list at 375, 768 and 1280 px.

## Known still broken (Phase 18 fixes these)
Pending approvers not named, removed admins still in Partners/Payouts/Ledger, SEO 400 limit, some uploads blocked by R2 policy, few theme presets.

## Paste this on Mac B
Caveman mode. You are Mac B (builder). Run /sync pull, then read only the P18 rows in docs/COORDINATION.md. Local DB only, inline URL. Disk is low: build only touched files, delete .next and test-results after each task, stop if free disk is under 3 GB and tell the user. Do tasks 3 to 8 from the status table, one branch per task off origin/fix/autopilot, plus one integration branch. Report "Done X of 6, ETA N h" after each task with /sync push. Mark a task ready with /sync ready only after unit tests and a browser check at 375, 768 and 1280 px pass. Do not deploy, do not touch main or Neon.

## Keep both Macs awake
Run in a terminal on each Mac and leave it open: `caffeinate -dims`
(Mac A already has it running.)

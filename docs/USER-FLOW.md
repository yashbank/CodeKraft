# CodeKraft - correct usage order (post audit/round-4 wipe)

Admin host: `admin.localhost:3000` (or your production admin domain). Site host: the public domain.
Two super admins exist: `yashbank2002@gmail.com`, `sanketshrikant42@gmail.com`.

## 1. Team setup
1. **Invite a partner**: Admin Users (`/admin/admin-users`) > Invite > role=admin + partner name/email >
   Request approval. Creates an `approval_requests` row; the *other* super admin sees it under
   Approvals and must approve before the account is created (BR-13, two-admin rule). Works end to end.
2. **Invite staff**: same dialog, but the "Staff" role radio is disabled ("not seeded in release 1") -
   **cannot be done yet** (BUG-045, see MANUAL.md #18 - needs a product decision, not a bug fix).
3. Approve/revoke/suspend an admin user from Admin Users once the invite is accepted.

## 2. Customers
1. Admin can create a customer directly, or a visitor self-registers at `/auth/register` and verifies
   their email via the link in `email_outbox` (local) / Resend (production - needs a verified sending
   domain, MANUAL.md #17).
2. Customer logs in at `/auth/login`, manages their account under `/account/*`.

## 3. Content (do this before publishing products, so pages aren't empty)
1. **Legal pages** (`/admin/content/legal`): the 4 fixed pages (privacy/terms/refunds/license) only
   exist if `pnpm db:seed` has run - **production currently has 0 rows here** (MANUAL.md #20). Seed or
   write real copy before relying on `/legal/*`.
2. **Landing** (`/admin/content/landing`): edit the 5 chapters (Hero, Who, Build, Sell, Proof) - the
   editor itself works fine once chapters exist (also seed-dependent).
3. **Uploads everywhere are currently broken** (BUG-034): every direct-to-storage upload (landing
   images, product media, case-study covers) fails CORS - this is an R2 bucket config issue
   (MANUAL.md #16), not fixable from the app. Fix that first or nothing with an image will work.
4. Services, case studies, testimonials, FAQs: create/save work; FAQ list needed a reload to show a
   new row until this round's fix (BUG-036, now fixed). Site-level FAQs still don't render anywhere
   public (BUG-037 - needs new UI, not just data wiring).

## 4. Products
1. Admin > Products > New > fill details, offerings, pricing.
2. Media tab: upload a cover image (blocked by BUG-034 until R2 CORS is fixed). Once an image exists,
   it now shows correctly on the public `/products` list (BUG-044, fixed this round).
3. Blog and Versions tabs are **not usable yet** - backend mutations exist but the admin UI for both
   was never finished (BUG-042/BUG-043, real feature gaps, MANUAL.md #19).
4. Ownership split: propose a split (company % + partner %) - the approve-button bug that blocked
   valid company/partner splits is fixed (BUG-040), and the bug where a proposal silently vanished
   because of an orphaned auto-created initial row is fixed (BUG-041). The other super admin approves
   under Approvals; the new split now shows correctly in the product's Ownership tab.
5. Publish the product - it then appears on `/products` and its own detail page.

## 5. Quote -> Order -> Payment -> Fulfilment -> Finance
Not independently re-verified this round (local DB had 0 rows in leads/orders/queries/notifications
after the minimal-then-reseeded local reset - these only populate through real usage, not seed data).
Known-working from prior rounds: manual UPI/bank payment + admin confirm, Razorpay shows "Not
configured" and falls back correctly (prior round's audit). Re-verify quote/order/fulfilment/finance
end to end in a future round using real data created through the UI, not assumed from this pass.

## 6. Day to day
- Leads/Queries board and list load fine; reply threads work both ways (verified prior rounds).
- Finance sub-pages (ledger/allocations/partners/expenses/adjustments/reports) load with no errors;
  `/admin/finance`, `/admin/finance/payouts`, `/admin/finance/invoices` 404 directly (BUG-047, no nav
  link points there - likely just dead URLs, not a missing feature, not independently confirmed).
- Dashboard widgets render clean empty states with no data; not cross-checked against SQL this round.
- Notifications bell works; admin list screens' search/filter/pagination weren't exercised with data
  present this round (local DB was empty for leads/orders/queries at audit time).

## Open items blocking a clean first run
BUG-034 (uploads), BUG-045 (staff invite), BUG-038 (legal seed in prod), BUG-042/043 (Blog/Versions),
BUG-037 (site FAQ page). See `BUGS.md` for full list and `MANUAL.md` for the ones needing your call.

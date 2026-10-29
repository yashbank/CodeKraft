# CodeKraft scorecard (R9)

Plain English, for the founder. Test counts are real. Percent and score are our own judgement, based on what the tests cover and what still fails or is skipped.

Test numbers behind this page:
- Run 4 (fresh build e5ca084, all R9 specs except r9-01): 293 passed, 4 failed, 7 skipped. The 4 failures were fixed in d75e563.
- Run 5: <lead fills in>
- r9-01 (reset site data) on its own: 5 passed, 1 skipped.
- R9-14 route sweep (every page, 5 roles, 375/768/1280): 259 passed on a fresh build of this branch (252 sweep + 3 staff + 4 login setup). The first run had 32 failures; most were wrong test assumptions (deliberate redirects, order-number format, session rate limit), 2 were real app defects (fixed, below), the rest are under known gaps.
- Unit and integration tests (vitest): green, about 1660 tests.
- Phone-size admin tests are skipped on purpose. The admin panel is laptop-only below 1024px and shows a "designed for laptops" notice.

"Tests" below means how many browser tests each spec has per screen size (desktop and phone each run them).

| Area | Done | Reliability /10 | Evidence |
|---|---|---|---|
| Catalog (products, lifecycle, flags) | 90% | 8 | r9-04: 5 tests (edit and republish, scheduled publish, 4 flags); sweep covers every catalog page |
| Checkout and payments | 85% | 7 | r9-06: 1 test (UPI proof, "confirming" screen); r9-09: 1 test (one FX rate); manual UPI only, no live gateway run here |
| Fulfilment | 90% | 8 | r9-03: 5 tests (order and delivery status per delivery type) |
| Invoices | 90% | 8 | r9-02: 1 test (settings rename shows on issued invoice, page, PDF, print); sweep opens invoice detail for every role |
| Finance | 85% | 8 | r9-10: 5 tests (exact ledger debit/credit, filters, "My share"); sweep covers all 9 finance pages |
| Exports | 85% | 7 | r9-11: 1 test (styled Excel and plain CSV on ledger and customers) |
| Settings and theme | 90% | 8 | r9-08: 4 tests (palette, font, radius, dialogs at 3 widths) |
| Dashboard | 90% | 8 | r9-07: 1 test (real health, clean widgets, 3 widths) |
| Chatbot | 80% | 7 | r9-13: 1 test (new signup chat saved and shown to admin); no live AI key tested locally |
| SEO | 90% | 8 | r9-12: 2 tests (head tags, JSON-LD, OG image, sitemap, admin preview) |
| Auth and roles | 95% | 9 | r9-00: 118 tests; r9-14-staff: 3 tests; R9-14 sweep: every route as anonymous, customer, super admin, admin and staff |
| Reset site data | 85% | 7 | r9-01: 5 passed, 1 skipped |

Overall: about 88% done, 7.8 out of 10.

## Fixed in R9-14
- Staff could see the invoice list but got "not found" opening one invoice or its PDF. The invoice code only treated admin and super admin as staff-side users. Staff now counts too.
- A missing record inside the admin panel (for example an unknown product) showed the public site's "page not found" with links to public pages that do not exist on the admin address. Added an admin-style not-found screen.

## Known gaps
- Seed data points at 6 client logo files (`/api/files/public/seed/logos/*.svg`) that are never uploaded locally, so the Projects page requests images that return 404. Real uploads are fine. Fix by uploading placeholder logos during seeding.
- A signed-in customer who opens `/auth/login` still sees the login form. Redirecting on the server is risky because admin and site are separate hosts and a wrong redirect could loop. Left alone.
- Admins and staff can only open products they created (rule D-512). The seeded demo product opens for the super admin only. This is by design, but worth confirming it is what you want for staff.
- Admin order and customer pages with an unknown id show a "not found" panel with a normal 200 status, not a real 404. Harmless for people, slightly wrong for logs.
- The session check is limited to 30 per minute per IP. A very fast click-through of many pages can trip it. A person will not.
- Phone-size admin is not tested (laptop-only by design).
- Chatbot with a real AI key and real payment gateways were not exercised in this local run.

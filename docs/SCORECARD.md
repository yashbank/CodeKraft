# CodeKraft scorecard (Phase 14 + 15)

Plain English, for the founder. Test counts are real. Percent and score are our own judgement, based on what the tests cover and what still fails or is skipped.

Test numbers behind this page (branch feat/p14-integration, fresh production build, local DB, Desktop Chrome + Pixel 7):
- Combined run (every P14/P15 spec plus every R9 spec except the sweep and reset): 447 passed, 2 failed, 81 skipped. The 2 failures (r9-03 licence key, r9-04 approved delete) passed in earlier rounds and pass alone: r9-03 + r9-04 rerun on their own, 24 passed, 0 failed. Load flakes on an 8 GB machine.
- R9-14 route sweep on its own fresh DB (every page, 5 roles, 375/768/1280): 256 passed, 0 failed (run with 1 worker: desktop and phone workers share fixtures).
- r9-01 (reset site data, wipes the DB) on its own: 5 passed, 1 skipped (phone, by design).
- Unit + static tests: 1618 passed. Integration tests (real Postgres): 455 passed. Lint and type check clean.
- Rounds on the way: round 2a 282 passed / 65 failed, round 2b 423 / 21, round 3 438 / 7, round 4 448 / 3 (+ sweep 247 / 9: detail pages returned 200 instead of 404, fixed). Every failure was fixed in the app or was a wrong test assumption (listed in docs/coord/B.md).
- Phone-size admin tests are skipped on purpose: the admin panel is laptop-only below 1024px and shows a "designed for laptops" notice.

| Area | Done | Reliability /10 | Evidence |
|---|---|---|---|
| Catalog (products, lifecycle, flags) | 90% | 8 | r9-04 (edit, republish, schedule, flags, delete); public product pages now cached and refreshed on admin edits |
| Checkout and payments | 85% | 7 | r9-06, r9-09; customer cancel can no longer overwrite a payment or fail a submitted UPI reference; no live gateway run here |
| Fulfilment | 90% | 8 | r9-03 per delivery type |
| Invoices | 90% | 8 | r9-02; sweep opens invoice detail for every role |
| Finance | 85% | 8 | r9-10; P14-02 admin-as-partner end to end (double submit, re-invite, staff cannot be partner) |
| Dashboard and widgets | 90% | 8 | P14-01 per-role widget allow-list (server-enforced); P14-09 7 chart kinds x 6 styles; P14-12 drag reorder + heatmap |
| Theme studio and landing controls | 85% | 8 | P14-07 40-70 options per group, live preview, presets; P14-08 per-section font/border/padding/spacing |
| Notifications | 90% | 8 | P14-03 click opens item, popup closes, read state persists, approvals badge; approval requests now notify deciders; per-user preferences |
| Chat, queries and attachments | 85% | 7 | P14-06 private attachments (type/size/count limits, magic bytes, owner/admin only), AI reads images + text; no live AI key tested locally |
| Email settings and branding | 80% | 7 | P14-04 stored From name/address + test send (outbox locally); P14-05 tab titles and icons per area. Real delivery needs a verified domain |
| Mobile (site + account) | 90% | 8 | P14-10: empty top bar removed; every site/account route at 375/390/768 with no overflow, no blank band, 40px tap targets |
| UX sweep | 85% | 8 | P14-11: about 20 fixes (11 dead buttons, stale lists, menus left open, an open redirect on the admin handoff) |
| Accessibility | 85% | 8 | P14-13 axe on 26 routes: 14 of 48 page runs had serious issues before, fixed; Lighthouse budgets in lighthouserc.cjs (not run in this round) |
| Media storage (R2) | 85% | 8 | P15-01 parity suite 78 tests on memory, local and fake-S3 drivers, green before and after; QR no longer stored in the DB |
| Vercel load | 80% | 7 | P15-02: cached public routes 3 -> 11, idle admin polling 4.3 -> 2 requests/min (0 when hidden), editor/admin bundles 30-40% smaller |
| SEO | 90% | 8 | r9-12 (head tags, JSON-LD, OG image, sitemap) on the cached pages |
| Auth and roles | 95% | 9 | r9-00 all roles; sweep as anonymous, customer, super admin, admin, staff |
| Reset site data | 85% | 7 | r9-01 |

Overall: about 90% done, 8.0 out of 10.

## Fixed in Phase 14-15 (found by tests or review)
- Admin sidebar approvals badge was always 0, and the approvals dashboard widgets were always empty: both sent a filter the server silently rejected.
- Notifications: read items came back because the page opened before "mark read" was saved; several notification links pointed at pages that do not exist.
- Customers behind a shared IP (office, mobile network) could see "Log in" instead of Buy: the session check was capped at 30 per minute per IP. Now 300.
- A customer could open a refund request on another customer's order or an unpaid order; now only their own paid order.
- A customer cancel could overwrite a payment that landed at the same moment, and could fail a UPI reference the admin had not checked yet. Now locked and blocked.
- Open redirect on the admin login handoff (`/\evil.com`). Fixed with a shared safe-redirect check.
- Creating a partner twice (double click) gave a server error; re-inviting a removed admin left their old partner record inactive.
- Uploading a chat or query file did not check the upload belonged to the same user.
- New loading skeletons made "not found" pages return 200 instead of 404; skeletons now only on list pages.

## Known gaps
- Lighthouse budgets are configured but were not run in this round (needs a quiet machine); run `pnpm build && pnpm lhci`.
- Reports screen: Export, Print, Drill-down and Regenerate only show a message. Lead "Merge" and "Delete" have no backend yet (shown disabled).
- Undo after delete covers saved views and coupons only (other deletes need approval).
- PDF and Word attachments are named to the AI but their text is not read (no extractor installed).
- Products published after a deploy are served live (uncached) until the next deploy; everything else refreshes on edit.
- Manifest icons use the SVG mark (no PNG generator); no offline service worker.
- Chatbot with a real AI key, real payment gateways and real email delivery were not exercised locally.
- Phone-size admin is not tested (laptop-only by design).

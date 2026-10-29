# BUGS-R9 (Phase 13, Mac B)

Severity: S1 = crash / 500 / blocked flow, S2 = wrong data or broken control, S3 = cosmetic.
Source: Playwright on a production build (`next build` + `next start`), local DB, Desktop Chrome + Pixel 7.
Regenerate the raw list with `tsx scripts/e2e/bugs-r9.ts` after a run (reads `test-results/r9.json`).

## Open

None at S1 or S2 in the final runs:
- All R9 specs on a fresh build of df353db: every spec except the sweep passed. The sweep's 47 failures inside the combined run are a test-isolation issue (see below), not app bugs.
- R9-14 sweep on its own fresh DB: 259 passed, 0 failed.
- r9-01 reset on its own: 5 passed, 1 skipped (phone, by design).

Known gaps (not fixed, low severity):
- S3: seeded client logos (`/api/files/public/seed/logos/*.svg`) are never uploaded locally, so /projects requests 404 images. Real uploads are fine.
- S3: a signed-in customer can still open /auth/login. A server redirect across the site and admin hosts risks a loop.
- S3: admin order and customer pages with an unknown id show a "not found" panel with HTTP 200, not 404.
- S3: the session probe is limited to 30/min per IP. Only very fast automated clicking trips it.
- Info: admins and staff only open products they created (D-512), so the seeded product 404s for them. This is by design; confirm it is wanted for staff.
- Test note: run `r9-14-sweep` and `r9-01` in their own runs on a fresh DB. The app allows one session per user, so other specs re-signing the same admin invalidates the sweep's session, and r9-01 wipes the DB.

## Fixed during R9 (found by these tests)

- S1: staff could open finance (ledger, expenses, adjustments, partners, allocations), admin-users and audit, and saw the full admin nav. Now a route→permission guard in the admin layout shows "You don't have access" and the nav is filtered (src/lib/authz/admin-routes.ts).
- S1: the site returned 500 in dev because client components imported the server-only display-currency module (P9-01 × P12-03); the helpers were split out.
- S1: an approved product delete failed on the product_ownerships foreign key and left the approval stuck.
- S1: chats from brand-new (unverified) customers were never saved, so admins saw no conversation and no handoff.
- S2: the system_health widget required a permission no role has, so it always showed "Health checks unavailable".
- S2: dashboard "My share" was always empty because the request context never set partnerId.
- S2: no page had og:image, because `images: undefined` disabled the opengraph-image convention. The product page also ignored the admin SEO title and description.
- S2: re-rendering an invoice PDF tried to update the append-only invoices row.
- S2: the invoice PDF's grand-total box covered the discount row.
- S2: custom/hosted orders showed "Fulfilled" at payment with no delivery step; a delivered hosted site showed "Being set up" forever; revoked subscriptions could be revived.
- S2: the payment "confirming" screen redirected away before showing Download or Reveal key, and the order view returned no entitlements.
- S2: republishing or scheduling a published product was blocked; the editor's featured flag did nothing on the home page.
- S2: staff got "not found" on invoice detail and PDF.
- S3: long font previews overflowed admin settings by 24px at 1280, because radio cards did not clip and the fieldset/grid could not shrink.
- S3: the option picker lost keyboard focus after closing "Show all"; a widget added via Customise needed a reload to load.

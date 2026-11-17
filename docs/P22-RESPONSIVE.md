# P22 responsive audit (phase 4, audit only)

Spec: `tests/e2e/r9/p22-responsive.spec.ts` (one test per role x width; per-page findings JSON in `test-results/p22/`).
Stack: production build, port 3134, local DB `ck_p22_4`, storage stub, no live keys. Browser: Desktop Chrome with the viewport set per width (touch/UA emulation not used).
Widths: 320, 375, 768, 1024, 1280, 1920. Roles: anonymous site, customer, partner (`partner@`, role admin + partner row), staff, admin, super_admin.

## Pass count

Page-width runs (a route at one width) with zero findings: **348 / 888 (39%)**. Tests: 19 pass / 21 fail of 40 (a test fails on any `high` finding; medium/low are recorded only).

| Role | clean / runs | Note |
|---|---|---|
| anonymous | 12 / 126 | cookie notice + logo images dominate |
| customer | 48 / 84 | |
| partner | 36 / 72 | 12/12 at >=1024; 0/12 at <1024 (tap targets only) |
| staff | 62 / 150 | |
| admin | 95 / 228 | 0/38 at <1024 (tap targets only, see below) |
| super_admin | 95 / 228 | same as admin |

Routes: anonymous 21, customer 14, partner 12, staff 25, admin 38, super_admin 38 (from `src/app`, `src/components/site/nav.ts`, `ADMIN_NAV`). Admin-host paths have no `/admin` prefix (host rewrite).

## Coverage limits (read first)

- Seed DB has no orders, leads, queries, invoices or entitlements, so `/orders/[id]`, `/leads/[id]`, `/queries/[id]`, `/account/orders/[id]`, `/account/purchases/[id]`, `/account/invoices/[id]` and `/quote/[token]` are NOT covered. Phase 5 should seed rows and extend the route list.
- Admin below 1024 shows the "Open on a laptop" notice by design (docs/07 3.4, `LaptopNotice`); only the notice, not the real screens, was audited at 320/375/768. Approvals, Orders, Notifications render read-mostly there.
- The cookie notice stayed visible (the `ck_cookie_notice=seen` cookie did not suppress it), so its overlap is counted on every site page; that is a real first-visit state.
- Contrast check is a cheap heuristic (ratio < 3, flat backgrounds only): no hits. Hit tests use element centre points.
- `/ssg*` returned 404 in the production build (looks gated on purpose); recorded as info, not a defect.

## Findings (sorted by severity)

| # | Sev | Route | Role | Width | Problem | Likely file |
|---|---|---|---|---|---|---|
| 1 | high | `/account/settings` | customer | 320, 375, 768 | Fixed "Account sections" bottom nav covers the Save button (768) and the GST "Choose your state" select (320/375) at page bottom: no bottom padding for the bar | `src/app/(account)/account/settings`, account layout bottom nav (`nav.fixed.inset-x-0`) |
| 2 | high | `/account/queries` | customer | 320 | Horizontal overflow: toolbar "All" tabs + "New query" button row wider than viewport | `src/app/(account)/account/queries/(list)` |
| 3 | high | `/chatbot` | admin, staff, super_admin | 1024 | Horizontal overflow: header action group ("Open escalated query / Open lead ..." + "Purge now") exceeds width | `src/app/(admin)/admin/chatbot` |
| 4 | high | `/content/landing` | admin, staff, super_admin | 1024, 1280, 1920 | Sticky "Unsaved changes / Discard / Save" bar covers inputs (`#ch-subtitle`, `#ch-body`) at scroll end | landing editor sticky save bar (`div.sticky.bottom-*`) |
| 5 | high | `/settings` | admin, super_admin | 1024, 1280, 1920 | Sticky "Changes are audited" save bar covers `#st-addr*`, `#st-city`, `#st-legal`, `#st-phones` at page end | settings form footer bar |
| 6 | high | `/content/legal` | super_admin | 1024 | Sticky "Saved .. Discard / Save draft" bar covers `#lg-title` | legal editor bar |
| 7 | high | `/orders/new` | super_admin | 1024 | Sticky Summary card covers "Remove line" buttons | manual-order form summary |
| 8 | high | `/products/[id]` | super_admin | 1024, 1920 | Sticky top bar covers Basics/Content tab triggers when scrolled to bottom (tabs not sticky-aware) | product editor tabs |
| 9 | high | site `/`, `/blog`, `/contact`, `/legal/*`, `/products*`, `/projects*`, `/services`, `/search` | anonymous, customer | all | Cookie notice (fixed bottom) covers footer email link at page end and hero/CTA links ("Browse products", "Go to queries", "All"/"Fintech" filters at 320) | `src/components/site` cookie notice, no footer bottom padding |
| 10 | high | `/products`, `/search`, `/products/fitdesk-pro` | anonymous, customer | 320, 375 | Help/chat floating button ("Ask me anything") covers "Sign in / Add to wishlist" and product cards; mobile buy bar (fixed "FitDesk Pro Monthly") covers the offering selector at 320 | chat launcher, product detail sticky buy bar |
| 11 | medium | `/` , `/projects` | all site | all | 6 client-logo requests fail: `/_next/image?url=.../api/files/public/seed/logos/*.svg` returns 400 (SVG through next/image optimiser) so logos are missing | client logos strip; `next.config` images / use `unoptimized` for SVG |
| 12 | medium | `/products/<id>` (admin) | admin, staff | all | Product edit page returns 404 for admin and staff but works for super_admin (check ownership gating; also hides screen from audit) | `src/app/(admin)/admin/products/[id]` |
| 13 | medium | `/content/case-studies` | admin, staff, super_admin | all | Console/network `ERR_BLOCKED_BY_ORB` for `http://localhost:*/projects/confidential-logistics/opengraph-image` (cross-origin og image fetched from admin host) | case-study cover/preview URL |
| 14 | medium | `/account/settings` | customer | all | Input `#pf-name` has no label or aria-label | `src/app/(account)/account/settings` |
| 15 | medium | `/orders/new` | admin, staff, super_admin | 1024-1920 | `#mo-qty-*` quantity inputs very narrow (<100px) | manual-order lines |
| 16 | medium | `/customers/[id]`, `/quotes` | back office | 1024-1280 | Tag input `#cust-new-tag` and quote `#q-amount/#q-tax/#q-expires` < 100px wide | customer detail, quotes form |
| 17 | medium | `/account/purchases` | customer | 768, 1024 | "Search by product name" input < 100px | purchases list toolbar |
| 18 | low | admin (all screens) | back office | 320, 375, 768 | Top-bar "Account menu" 32x32 and help launcher 36x36 under 40px | `AdminShell` top bar, help launcher |
| 19 | low | site `/`, `/products`, `/search` | anonymous, customer | 320-768 | Product/category chips and card links 26px high (98-204 x 26) | product card `a.after:absolute` |
| 20 | low | all site pages | anonymous, customer | 320-768 | Footer `hello@...` mail link 137x15; `/auth/reset` "Back to sign in" 96x17; `/search` "Clear search" 28x28 | site footer, auth pages, search box |
| 21 | low | `/auth/login`, `/checkout/[id]` | anonymous, customer | 320-768 | Checkbox buttons (`#remember`, `#save-profile`, `#consent`) 24x24 | `ui/checkbox` |
| 22 | low | `/checkout/[id]` | customer | 320 | Line-items table scrolls horizontally but its container is not keyboard focusable (no `tabindex`) | checkout summary table |

Also noted: `/finance` -> `/finance/ledger`, `/finance/payouts` -> `/finance/partners`, `/finance/invoices` -> `/finance/reports` (redirects, fine); `/search?q=a` -> `/products?q=a`.

## What passed

No overflow, header overlap/clip, broken images or console errors on any other audited route at any width. Tables on audited admin screens sit in scroll containers. No `high` finding for partner and staff beyond rows 4-5, 7 above; partner is 12/12 clean at >=1024.

## Re-run

```
DATABASE_URL=postgres://codekraft:codekraft@localhost:5432/<db> E2E_SITE_URL=http://localhost:<port> E2E_ADMIN_URL=http://admin.localhost:<port> \
  playwright test --project=r9-setup --project=r9-desktop --workers=1 tests/e2e/r9/p22-responsive.spec.ts
```
Runtime about 18 minutes (36 tests, 888 page-widths).

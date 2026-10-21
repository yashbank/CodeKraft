# BUGS

| id | severity | route | evidence | status |
|----|----------|-------|----------|--------|
| BUG-001 | minor | /contact, / (embedded contact) | InquiryForm.tsx:356 leaked internal roadmap note "Turnstile challenge (invisible) — widget lands in P7" as user-facing copy | fixed |
| BUG-002 | minor | /products | ProductFilters.tsx:176 leaked internal roadmap note "Dual-handle slider lands in P7" under price filter (min/max inputs already work, caption just removed) | fixed |
| BUG-003 | major | admin /queries/[id] | No `src/app/(admin)/admin/queries/[id]` route exists (only list page); opening any query thread renders the storefront 404 inside admin. Query rows and notification/dashboard links have nowhere to go. | fixed |
| BUG-004 | minor | admin /queries | List page has no visible heading at desktop (≥1024px) - the only heading text is inside the mobile "open on a laptop" notice block, which is CSS-hidden at desktop widths | fixed |
| BUG-005 | minor | admin /leads/board | Not a real route - direct link to /admin/leads/board is captured by /leads/[id] dynamic route and shows "Lead not found" instead of a board view; Board/Table toggle is client-state only | fixed |
| BUG-006 | minor | admin /coupons | "Created by" column shows a raw id fragment ("Admin 21176875") instead of admin name/email, on all seeded coupons | fixed |
| BUG-007 | blocker | /account/queries/[id] | Query row links to /account/queries/<uuid> -> HTTP 404 "We couldn't find that page" (desktop and 375). Reply/thread view unreachable for customers. | open |
| BUG-008 | major | admin /audit | Actor/Action/Subject type+id/From-To filters have no effect on the row list (confirmed by banner text + no-op on "zzzqqq"/"approval" search). | open |
| BUG-009 | major | admin /audit | Default From/To date range is 2026-09-18 to 2026-09-25; actual events span 13-22 Oct 2026, so default view matches nothing once filters are wired. | open |
| BUG-010 | major | admin /admin-users | Prod list shows test/demo rows ("partner demo 2" partner-b@codekraft-test.invalid, "Sanket Shrikant"/"yash bankar" tagged TEST). | open |
| BUG-011 | major | / (home) | Garbled hero copy: "Engineers who ship software that Sanket its keep!" | open |
| BUG-012 | major | / (home) | Service cards show placeholder text ("kcjwabdlcbadshbwe", "demo"/"jhvkv,j") in prod. | open |
| BUG-013 | major | /products | Public catalog lists junk test row "TEST Product 1-1791333985258" next to real products. | open |
| BUG-014 | major | /contact | Literal unfilled placeholder "[X] business days" in public-facing copy. | open |
| BUG-015 | major | /products, /account/wishlist | No wishlist/heart control on product cards or detail page for a logged-in customer; /account/wishlist is a permanent empty-state dead end ("tap the heart") with no way to add anything. | open |
| BUG-016 | major | /account/settings (Security) | Empty submit and mismatched password-confirm both show no error text and fire no visible API request. | open |
| BUG-017 | minor | admin /audit | Hard cap "100 events (most recent 100)", no pagination/load-more; older events unreachable. | open |
| BUG-018 | minor | admin /audit, /admin-users (375px) | Desktop-only gate ("designed for laptops, 1024px+"); no mobile table/list view. | open |
| BUG-019 | minor | admin /admin-users | No search or role filter on the admin-users list. | open |
| BUG-020 | minor | admin host /auth/login | Admin sign-in renders the customer login UI (hero copy, Google button, "Create an account") instead of admin-branded chrome. | open |
| BUG-021 | minor | /auth/register | Unverified account signs straight into /account (only purchases/chat are gated) - confirm intended. | open |
| BUG-022 | minor | /auth/register, /auth/login | Empty submit shows only the unstyled native browser validation bubble; /contact uses a custom error summary - inconsistent. | open |
| BUG-023 | minor | /auth/register | "Create account" stays disabled while password is weak with no inline reason beyond the checklist. | open |
| BUG-024 | minor | /products | 14 filter checkboxes render as role=checkbox buttons with no accessible name. | open |
| BUG-025 | minor | /products | Category filter selection isn't reflected in the URL (not shareable, breaks back-button). | open |
| BUG-026 | minor | /search | No site-wide search exists; /search?q=... 404s. Only the in-page /products search box works. | open |
| BUG-027 | minor | all pages | favicon.ico 404s on every load. | open |
| BUG-028 | minor | all pages | ~60 POSTs to /api/csp-report fired per page load (CSP report-only inline-script violations; noisy, not user-visible). | open |
| BUG-029 | minor | mobile 375 (/auth/*, /contact, /account) | Several tap targets under 32px. | open |
| BUG-030 | minor | /account/settings (Profile, Notifications) | Save/toggle persists correctly on reload but shows no success/error feedback. | open |
| BUG-031 | minor | /account/settings (Security) | "Recent sign-ins: No recent sign-ins" shown immediately after a fresh sign-in. | open |
| BUG-032 | minor | /account/chat | Shows "0 messages left today / reached today's limit" copy when the real blocker is an unverified email. | open |
| BUG-033 | minor | /account/queries/[id] 404 page, product-page footer | Renders logged-out header/footer ("Sign in") while the user is actually logged in. | open |

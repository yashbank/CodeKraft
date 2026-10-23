# BUGS

| id | severity | route | evidence | status |
|----|----------|-------|----------|--------|
| BUG-001 | minor | /contact, / (embedded contact) | InquiryForm.tsx:356 leaked internal roadmap note "Turnstile challenge (invisible) — widget lands in P7" as user-facing copy | fixed |
| BUG-002 | minor | /products | ProductFilters.tsx:176 leaked internal roadmap note "Dual-handle slider lands in P7" under price filter (min/max inputs already work, caption just removed) | fixed |
| BUG-003 | major | admin /queries/[id] | No `src/app/(admin)/admin/queries/[id]` route exists (only list page); opening any query thread renders the storefront 404 inside admin. Query rows and notification/dashboard links have nowhere to go. | fixed |
| BUG-004 | minor | admin /queries | List page has no visible heading at desktop (≥1024px) - the only heading text is inside the mobile "open on a laptop" notice block, which is CSS-hidden at desktop widths | fixed |
| BUG-005 | minor | admin /leads/board | Not a real route - direct link to /admin/leads/board is captured by /leads/[id] dynamic route and shows "Lead not found" instead of a board view; Board/Table toggle is client-state only | fixed |
| BUG-006 | minor | admin /coupons | "Created by" column shows a raw id fragment ("Admin 21176875") instead of admin name/email, on all seeded coupons | fixed |
| BUG-007 | blocker | /account/queries/[id] | Query row links to /account/queries/<uuid> -> HTTP 404 "We couldn't find that page" (desktop and 375). Reply/thread view unreachable for customers. | fixed |
| BUG-016 | major | /account/settings (Security) | Empty submit and mismatched password-confirm both show no error text and fire no visible API request. | fixed |
| BUG-030 | minor | /account/settings (Profile, Notifications) | Save/toggle persists correctly on reload but shows no success/error feedback. | verified already fixed, no change needed |
| BUG-032 | minor | /account/chat | Shows "0 messages left today / reached today's limit" copy when the real blocker is an unverified email. | fixed |
| BUG-033 | minor | /account/queries/[id] 404 page, product-page footer | Renders logged-out header/footer ("Sign in") while the user is actually logged in. | fixed |
| BUG-034 | blocker | admin (product media, blog/version files, landing images, case-study covers - every direct-to-R2 upload) | R2 presigned PUT fails CORS preflight from admin.localhost:3000 (`net::ERR_FAILED`, toast "Upload couldn't reach storage"), e.g. on `codekraft-public.r2.cloudflarestorage.com`. Root cause of BUG-035/039/042/043/044. | open |
| BUG-035 | major | admin /admin/content/landing | Editor renders completely blank - no chapter rail, no forms, 0 file inputs - even though `landing_chapters` rows exist (kept by the wipe). Public `/` shows only the static `/images/hero-3d.jpg`, no CMS image for any section. | open |
| BUG-036 | minor | admin Content > FAQs | List doesn't refresh after creating a FAQ (POST 200, toast fires) - new row only appears after a manual reload. | open |
| BUG-037 | major | public (no FAQ page) | `listFaqsQuery` (site-scope FAQs) has no consumer anywhere in the public site - FAQs created in admin never render for visitors. | open |
| BUG-038 | major | admin Content > Legal | Empty state "No legal pages in the database yet" with no create/save path in the UI at all. | open |
| BUG-039 | minor | admin Content > Services, Case studies | Create/save returns 200 + toast but the new row isn't visible on public /services (publish-state unverified - may be working-as-designed unpublished draft, needs a human check, not confirmed as a bug). | open |
| BUG-040 | major | admin product editor, Ownership tab | "Request approval" stays disabled for a company/partner split (e.g. company 60 / partner 40) because the enabling validation sums partner lines only and ignores `companyCutBps` (`ProductEditor.tsx` ~2323, 2355). | open |
| BUG-041 | major | admin product editor, Ownership tab | Submitting a 0/100 split returns 200 + toast "A pending ownership version already exists for this product" but leaves no visible row in the Ownership table or in Approvals - the pending state is invisible to the admin who created it. | open |
| BUG-042 | major | admin product editor, Blog tab | Title/slug/excerpt are readonly, "Publish blog" is disabled, no upload control exists - the tab is display-only per its own code comment. | open |
| BUG-043 | major | admin product editor, Versions tab | "Add version" is disabled, no upload control exists - cannot create a version at all. | open |
| BUG-044 | major | /products (public list) | `ProductCard.tsx:17` always renders a `MediaPlaceholder` icon regardless of the product's real image - list cards can never show a real cover image even once uploads work. | open |
| BUG-045 | major | admin /admin/admin-users (invite dialog) | The "Staff" role radio is disabled with the text "defined, not seeded in release 1" - staff invites are blocked by the UI itself, not a server error. Partner invite (role=admin + partner) works correctly end to end (approval-request flow, not an email-token invite). | open |

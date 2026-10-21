# BUGS

| id | severity | route | evidence | status |
|----|----------|-------|----------|--------|
| BUG-001 | minor | /contact, / (embedded contact) | InquiryForm.tsx:356 leaked internal roadmap note "Turnstile challenge (invisible) — widget lands in P7" as user-facing copy | fixed |
| BUG-002 | minor | /products | ProductFilters.tsx:176 leaked internal roadmap note "Dual-handle slider lands in P7" under price filter (min/max inputs already work, caption just removed) | fixed |
| BUG-003 | major | admin /queries/[id] | No `src/app/(admin)/admin/queries/[id]` route exists (only list page); opening any query thread renders the storefront 404 inside admin. Query rows and notification/dashboard links have nowhere to go. | fixed |
| BUG-004 | minor | admin /queries | List page has no visible heading at desktop (≥1024px) - the only heading text is inside the mobile "open on a laptop" notice block, which is CSS-hidden at desktop widths | fixed |
| BUG-005 | minor | admin /leads/board | Not a real route - direct link to /admin/leads/board is captured by /leads/[id] dynamic route and shows "Lead not found" instead of a board view; Board/Table toggle is client-state only | fixed |
| BUG-006 | minor | admin /coupons | "Created by" column shows a raw id fragment ("Admin 21176875") instead of admin name/email, on all seeded coupons | fixed |

# BUGS

| id | severity | route | evidence | status |
|----|----------|-------|----------|--------|
| BUG-001 | minor | /contact, / (embedded contact) | InquiryForm.tsx:356 leaked internal roadmap note "Turnstile challenge (invisible) — widget lands in P7" as user-facing copy | fixed |
| BUG-002 | minor | /products | ProductFilters.tsx:176 leaked internal roadmap note "Dual-handle slider lands in P7" under price filter (min/max inputs already work, caption just removed) | fixed |

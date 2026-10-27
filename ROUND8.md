# Round 8 tracker (2026-10-27)

User decisions:
- Unverified customers CAN log in; see "account created, verify email" banner/popup; purchases, payments, chatbot gated until verified.
- Product images must show everywhere (cards, home, listing, wishlist), not just product detail.
- Test on Neon `preview` branch / local only. Emails off during test runs except real signup/reset checks.
- After green: snapshot prod, wipe ALL demo data incl. products/services/blogs, keep only 2 super admins. Deploy main.

| ID | Area | Item | Owner | Status |
|----|------|------|-------|--------|
| R8-01 | payments | Checkout shows real UPI QR + bank details from admin settings; clear message if not configured | A | merged, gate green |
| R8-02 | payments | Admin confirm of UTR payment marks order paid, customer sees success | A | merged, gate green |
| R8-03 | delivery | After paid: entitlement/license/download delivered to customer; admin UI makes clear where product files/licence are set | A | merged, gate green |
| R8-04 | finance | Ledger entries + adjustments correct; dashboard widgets show real numbers; remove finance dummy data | A | merged, gate green |
| R8-05 | chat | Chatbot "talk to team" handoff to admins | B | merged, gate green |
| R8-06 | chat | Admin notifications for new chats / handoffs | B | merged, gate green |
| R8-07 | auth | Verification email delivery (diagnose transport/Resend) | B | merged, gate green |
| R8-08 | auth | Unverified banner/popup; gate purchase/payment/chat until verified | B | merged, gate green |
| R8-09 | staff | Super admin can add staff; roles/permissions + approval engine (2 super admins) work | B | merged, gate green |
| R8-10 | dashboard | Widget selection persists per admin after reload | C | merged, gate green |
| R8-11 | settings | Site name/domain/logo changes actually apply across site | C | merged, gate green |
| R8-12 | sweep | Remove visible bug IDs, "locked"/"depends on" placeholders, dummy data, broken UI in finance + content | C | merged, gate green |
| R8-13 | catalog | Product images on cards/home/listing/wishlist | D | merged, gate green |
| R8-14 | content | Every image upload shows where it appears (or removed if unused) | D | merged, gate green |
| R8-15 | e2e | Full 2-browser test: 2 super admins + 3 customers, all flows | me | todo |
| R8-16 | prod | Snapshot, wipe demo data (keep 2 super admins), deploy, live smoke | me | todo |

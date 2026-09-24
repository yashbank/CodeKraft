# SCR-ADM-19 — Finance: partner balances & payouts

**Route:** `admin.<domain>/finance/partners` and `/finance/payouts?partner=&status=` · **Render:** Client · **App:** Admin

## Purpose
Show each partner's running balance (allocations − refund reversals − payouts − shared expenses, per currency and in INR, D-511) and record manual bank-transfer payouts on demand as immutable, dual-approved ledger entries (BR-13, D-1105). Admin-role partners see only their own balance and statement (D-512).

## User/role
Super Admin; Admin (own balance; may record a payout request for any partner per `finance.payout.record`).

## Entry points
Sidebar "Finance › Partners & payouts", dashboard "Outstanding payouts" / "My share", approvals detail (payout), statements screen.

## Layout
- **Partners (desktop):** h1 "Partner balances".
- Cards per partner (avatar, display name, active bool): balance INR bold, per-currency breakdown chips, "Earned (all time)", "Paid out", "Pending payout approvals" chip, sparkline 12 months, buttons "Record payout", "Statement" (→ SCR-ADM-22), "View ledger lines".
- Below, table "Balance history" per selected partner: month, allocations, refunds, expenses share, payouts, closing balance.
- Super Admin also sees "Company" card (company cut total, expenses company-only, net).
- **Payouts (desktop):** h1 "Payouts", status chips (Awaiting approval, Recorded, Rejected), partner filter, date range, "Record payout" primary.
- `DataTable`: Date paid, Partner, Amount, Currency, Reference (bank UTR), Note, Recorded by, Approved by / at, Status, Ledger seq link.
- Record payout `Dialog`: Partner* (`Combobox`), Amount* (prefilled with available balance in chosen currency; an amount larger than the partner's current balance is **rejected** with "Exceeds available balance by ₹X" — no override, MASTER_SPEC §7 "Payout > balance"), Currency, Paid on* (date), Bank reference*, Note, summary "After this payout: balance ₹Y", "Request approval" primary; explains "Another admin must approve before this posts to the ledger" (BR-13).
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Card`, `Badge`, `Avatar`, `DataTable`, `Dialog`, `Form`, `Combobox`, `Select`, `Input`, `DatePicker`, `Textarea`, `Checkbox`, `Button`, `Tooltip`, `Skeleton`, Recharts sparkline
- custom: `MoneyInput`, `BalanceCard`, `PayoutDialog`.

## Content & copy notes
- Balance definition tooltip quotes the view formula (docs/05 VIEW partner_balances).
- Payout copy: "Payouts are recorded after you transfer the money by hand; the platform does not move money." Rejected payouts keep their reason visible.

## Interactions
- Balances via `getPartnerBalances` (API-FIN-03, plain `partner_balances` view); payouts list `listPayouts` (API-FIN-11).
- Record → `recordPayout` (API-FIN-04) → approval request → toast naming approver; on approval `applyPayout` posts the entry (immutable).
- Statement → SCR-ADM-22 with partner and range prefilled.

## States
- **Default:** all partners (Super Admin) / own card (Admin).
- **Loading:** card skeletons.
- **Empty:** "No payouts recorded yet".
- **Error:** `Alert`; validation on amount/reference.
- **Success:** toast "Payout approval requested".
- **Permission-denied:** Admin-role sees own card only; other partners' names hidden.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ 3; tv 4 with larger figures.

## Accessibility
- Balance figures with currency in accessible names; sparkline hidden table; dialog with computed after-balance in live region; over-balance error linked to the amount field.

## Motion
- Count-up on balances 600 ms. **Reduced motion:** static.

## Navigation
→ `/finance/payouts`, `/finance/statements?partner=`, `/finance/ledger?partner=`, `/approvals/[id]`.

## Data dependencies
Tables: `partner_balances` (view), `T-ledger_entries`, `T-payouts`, `T-partners`, `T-users`, `T-approval_requests`, `T-expenses`, `T-fx_rates`, `T-audit_logs`.
Queries: `getPartnerBalances` (API-FIN-03), `listPayouts` (API-FIN-11), `listPartners` (API-ADM-12). Actions: `recordPayout` (API-FIN-04).

## Requirement IDs
D-511, D-512, D-513, D-515, D-1105, BR-13, BR-17, D-006, D-114.

# SCR-ADM-17 — Finance: ledger

**Route:** `admin.<domain>/finance/ledger?type=&party=&partner=&order=&from=&to=&request=` · **Render:** Client · **App:** Admin

## Purpose
Browse the immutable journal (BR-17): every entry posted on payment confirmation (sale, discount, tax collected, gateway fee, bank charge, company cut, partner allocation), refund reversals, payouts, expenses and approved adjustments — in transaction currency and INR equivalent (D-515). Read-only by design; corrections are proposed on the Adjustments screen.

## User/role
Super Admin (all lines), Admin (`finance.ledger.read`: own partner lines + entries on own products).

## Entry points
Sidebar "Finance › Ledger", order detail "View in ledger", approvals detail "View posted entries", partner balances drill-down, reports drill-down.

## Layout
- **Desktop:** h1 "Ledger" with a lock icon and tooltip "Entries are immutable; corrections are adjustments".
- Toolbar: date range, Entry type multi-`Select`, Party type, Partner `Combobox`, Order no search, Currency `Select` (Native / INR), "Export CSV", info chip "Last posted 2 h ago".
- Summary strip for the current filter: Σ credits, Σ debits, Net, count.
- `DataTable` (dense): Seq, Date/time, Type badge, Party (Company / Partner name / Tax authority / Gateway / Bank / Customer), Order (link) / Item, Amount (signed, colour + sign), Currency, FX rate, Amount INR, Memo, Ref (payment / refund / payout / expense / adjustment / approval link), Created by.
- Row expand shows the sibling entries of the same posting (the whole order's set) and the allocation snapshot.
- Sticky first two columns on horizontal scroll.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `DataTable`, `DatePicker`, `Select`, `Combobox`, `Input`, `Badge`, `Tooltip`, `Collapsible`, `Button`, `Skeleton`, `Pagination`
- custom: `MoneyCell`, `SummaryStrip`, `PostingGroup`.

## Content & copy notes
- Type labels: Sale, Discount, Tax collected, Gateway fee, Bank charge, Company cut, Partner allocation, Refund (sale / discount / tax / company cut / partner allocation — gateway fees and bank charges are never reversed, MASTER_SPEC §7 "Refund reversal scope"), Payout, Expense, Adjustment.
- Signs: credits positive to the party.
- No edit/delete affordances anywhere; the ⋯ menu offers only "Copy seq", "Open order", "Propose adjustment referencing this entry".

## Interactions
- Filters → URL; `listLedgerEntries` (API-FIN-01) server-paginated (cursor by seq).
- Export CSV of current filter (audited).
- "Propose adjustment" → SCR-ADM-21 prefilled with reference.

## States
- **Default:** last 30 days, all types.
- **Loading:** skeleton rows.
- **Empty:** "No entries in this range".
- **Error:** `Alert` + retry.
- **Success:** export toast.
- **Permission-denied:** Admin-role sees scoped rows; others' partner names replaced by "Other partner" when not `read_all`.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ full with horizontal scroll and sticky columns; tv full width.

## Accessibility
- Table caption "Ledger entries"; signed amounts include "credit"/"debit" in accessible label; expandable rows `aria-expanded`; export button describes scope.

## Motion
- None.
- Reduced motion: none.

## Navigation
→ `/orders/[id]`, `/finance/allocations?order=`, `/finance/adjustments/new?ref=`, `/approvals/[id]`, `/finance/payouts`, `/finance/expenses`.

## Data dependencies
Tables: `T-ledger_entries`, `T-allocations`, `T-orders`, `T-order_items`, `T-payments`, `T-refunds`, `T-payouts`, `T-expenses`, `T-partners`, `T-approval_requests`, `T-fx_rates`, `T-audit_logs` (export).
Queries: `listLedgerEntries` (API-FIN-01), `getOrderAllocation` (API-FIN-02).

## Requirement IDs
BR-06, BR-17, D-006, D-007, D-507, D-511, D-515, D-516, D-517, D-512, D-1104, MASTER_SPEC §4.1.

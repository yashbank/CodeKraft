# SCR-ADM-21 — Finance: adjustments

**Route:** `admin.<domain>/finance/adjustments?status=` and `/finance/adjustments/new?ref=` · **Render:** Client · **App:** Admin

## Purpose
Propose correcting journal entries (never edits) when something was posted wrongly: mis-recorded received amount, an expense against the wrong product, a manual reconciliation difference. Each adjustment is a set of signed lines that must be explained, requires approval by all other admins (D-517, BR-17), and posts as immutable `adjustment` entries when approved.

## User/role
Admin, Super Admin (`finance.adjustment.propose`; approvers via `approvals.decide`).

## Entry points
Sidebar "Finance › Adjustments", ledger/expense row "Propose adjustment referencing this entry", approvals inbox (adjustment type), order detail ⋯.

## Layout
- **List (desktop):** h1 "Adjustments", status chips (Awaiting approval, Applied, Rejected, Cancelled), date range, "New adjustment".
- `DataTable`: Created, Reason (truncated), Lines (count), Net by party (chips), Requested by, Approver / decided at, Status, Ledger seqs (applied).
- **New adjustment (desktop):** two columns.
- Left: Reason* (`Textarea`, 20–1000 chars, "Explain what was wrong and what this corrects"), Reference (order / entry seq, optional, prefilled from `ref`), **Lines editor** table: Party type* (Company / Partner / Tax authority / Bank / Gateway / Customer), Partner (when party = Partner), Amount* signed + Currency, Memo*, Order/Item (optional), add/remove rows; helper "Add balancing line" (auto-inserts the opposite amount to Company).
- Right: **Impact preview** — per-party net effect and resulting partner balances after apply; validation panel ("Lines must not all be zero", "Explain unbalanced totals" `Checkbox` when Σ ≠ 0 with justification); "Request approval" primary; note "Another admin must approve. Entries post only after approval."
- Detail view of an existing adjustment: read-only lines, reason, approval history, posted seqs.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `DataTable`, `Form`, `Textarea`, `Select`, `Combobox`, `Input`, `Checkbox`, `Table`, `Card`, `Badge`, `Button`, `Alert`, `Tooltip`, `Skeleton`
- custom: `LinesEditor`, `MoneyInput`, `ImpactPreview`.

## Content & copy notes
- Warning banner: "Adjustments never change existing entries; they add new ones (BR-17)." Party labels match ledger.
- Unbalanced adjustments are allowed only with explicit justification (e.g. writing off a shortfall).
- Examples in a help `Popover`.

## Interactions
- Propose → `proposeAdjustment` (API-FIN-07) → approval request → toast naming approvers; requester can cancel (API-ADM-04).
- Approver acts in SCR-ADM-05; on approval `applyAdjustment` posts entries; list shows seqs.
- Impact preview computed client-side from lines + `getPartnerBalances` (API-FIN-03).

## States
- **Default:** list Awaiting approval first.
- **Loading:** skeleton.
- **Empty:** "No adjustments — that's good".
- **Error:** validation per line; `VALIDATION` empty lines.
- **Success:** toast "Adjustment sent for approval".
- **Permission-denied:** propose hidden; view allowed with `finance.ledger.read`.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ 8/4; tv 8/4.

## Accessibility
- Lines table with labelled cells; add/remove buttons named with row number; running totals in live region (debounced); reason required error announced; impact preview as a table.

## Motion
- Row add/remove 150 ms.
- Reduced motion: none.

## Navigation
→ `/approvals/[id]`, `/finance/ledger?request=`, `/finance/partners`, `/orders/[id]`.

## Data dependencies
Tables: `T-approval_requests`, `approval_decisions`, `T-ledger_entries`, `T-partners`, `T-orders`/`T-order_items`, `partner_balances` (view), `T-audit_logs`.
Queries: `listApprovals` (API-ADM-01, type filter), `getPartnerBalances` (API-FIN-03). Actions: `proposeAdjustment` (API-FIN-07), `cancelRequest` (API-ADM-04).

## Requirement IDs
D-517, BR-13, BR-17, D-1105, D-516, D-1104, A-1101.

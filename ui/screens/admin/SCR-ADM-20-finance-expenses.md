# SCR-ADM-20 — Finance: expenses

**Route:** `admin.<domain>/finance/expenses?product=&category=&from=&to=` · **Render:** Client · **App:** Admin

## Purpose
Record costs against products (or the company) so reports show profit, not just revenue (D-514). Product expenses are shared by that product's split unless marked company-only; each expense posts an immutable `expense` ledger entry. Receipts can be attached.

## User/role
Admin, Super Admin (`finance.expense.write`, read via `finance.ledger.read`).

## Entry points
Sidebar "Finance › Expenses", "Create › Expense", product editor "Expenses for this product", dashboard "Expenses vs profit".

## Layout
- **Desktop:** h1 "Expenses".
- Toolbar: date range, Product `Combobox` (incl.
- "Company (no product)"), Category `Select` (Hosting, Domains, Licences/tools, Contractors, Marketing, Fees, Other — admin-extendable list in settings), "Record expense" primary, Export CSV.
- Summary tiles: Total (range), By product top 3, Company-only.
- `DataTable`: Date, Description, Category, Product (or "Company"), Amount, Currency / INR, Shared by split (yes/no), Receipt (icon → signed link), Recorded by, Ledger seq.
- Row ⋯: View receipt, Copy seq, "Reverse via adjustment" (→ SCR-ADM-21 prefilled).
- No edit/delete (immutable).
- Record expense `Sheet`: Description*, Category*, Amount* + Currency (base default; FX rate shown), Incurred on*, Product (optional), "Share by product split" `Switch` (on when product chosen; explains effect on partner balances), Receipt upload (PDF/image ≤ 10 MB), Note.
- Preview: "Partner A −₹300 · Partner B −₹200" when shared.
- "Record" primary.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `DataTable`, `DatePicker`, `Combobox`, `Select`, `Sheet`, `Form`, `Input`, `Switch`, `Textarea`, `Button`, `Badge`, `Tooltip`, `Progress` (upload), `Skeleton`
- custom: `MoneyInput`, `SplitPreview`, `FileDropzone`.

## Content & copy notes
- Immutability note at the top: "Expenses post to the ledger immediately and can't be edited. Mistakes are fixed with an adjustment." Split preview uses the product's active ownership at the time of recording.

## Interactions
- List via `listExpenses` (API-FIN-11).
- Record → `recordExpense` (API-FIN-06) (upload via API-CAT-21 intent) → ledger entry → toast.
- Reverse → SCR-ADM-21 with negative lines prefilled.

## States
- **Default:** last 90 days.
- **Loading:** skeleton.
- **Empty:** "No expenses recorded — add hosting, tools or contractor costs to see profit by product".
- **Error:** validation; upload errors.
- **Success:** toast "Expense recorded (seq 1042)".
- **Permission-denied:** record hidden without permission.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ full; tv full.

## Accessibility
- Sheet form labelled; switch explains effect; receipt link labelled with file name; table caption.

## Motion
- Sheet slide.
- Reduced motion: none.

## Navigation
→ `/finance/ledger?type=expense`, `/finance/adjustments/new?ref=`, `/products/[id]`, `/finance/reports?report=profit_by_product`.

## Data dependencies
Tables: `T-expenses`, `T-ledger_entries`, `T-products`, `T-product_ownerships`/lines, `T-partners`, `T-media`/`files_upload_intents`, `T-fx_rates`, `T-site_settings` (categories), `T-audit_logs`.
Queries: `listExpenses` (API-FIN-11). Actions: `recordExpense` (API-FIN-06), `createUploadIntent` (API-CAT-21).

## Requirement IDs
D-514, D-515, BR-17, D-507, D-1104, A-1202.

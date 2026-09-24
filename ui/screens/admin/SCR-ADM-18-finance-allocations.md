# SCR-ADM-18 — Finance: allocations

**Route:** `admin.<domain>/finance/allocations?product=&partner=&order=&from=&to=` · **Render:** Client · **App:** Admin

## Purpose
Human-readable view of the immutable per-order-item money split (D-006, D-507): gross → discount → tax → gateway fee → bank shortfall → distributable → company cut → partner lines, with the ownership version used. Lets founders answer "how much did each partner earn on this sale and why" without reading raw journal lines.

## User/role
Super Admin; Admin (own products / own lines).

## Entry points
Sidebar "Finance › Allocations", order detail "Allocation", ledger row expand, reports "Revenue by partner" drill-down, product editor Ownership tab "Sales under this version".

## Layout
- **Desktop:** h1 "Allocations".
- Toolbar: date range, Product `Combobox`, Partner `Combobox`, Ownership version, Order search, currency toggle, Export CSV.
- Summary tiles for filter: Gross, Distributable, Company, per-partner totals (INR).
- `DataTable`: Date, Order / item, Product · offering, Gross, Discount, Tax, Gateway fee, Bank charge, Distributable, Company cut (% and amount), Partner columns (dynamic: one per partner in results, % and amount), Ownership version chip (v2 · effective 1 Aug), Currency / INR.
- Row expand: waterfall mini-chart (gross → distributable → splits) and links to the ledger entries and the refund reversals if any (shown as negative allocation rows with "Refund" chip).
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `DataTable`, `DatePicker`, `Combobox`, `Select`, `Badge`, `Card`, `Collapsible`, `Button`, `Skeleton`, `Pagination`, Recharts waterfall
- custom: `MoneyCell`, `AllocationWaterfall`.

## Content & copy notes
- Explains formula in a `Tooltip` on "Distributable": "gross − discount − tax − gateway fee − bank shortfall (BR-06)".
- Rounding note: "Largest-remainder rounding; lines always sum exactly." Partner names visible to Super Admin; Admin-role sees "Other partner" for others.

## Interactions
- Filters → URL; `getOrderAllocation` list variant via `listLedgerEntries` grouping (API-FIN-02 / API-FIN-01).
- Export CSV audited.
- Row links to order and ledger.

## States
- **Default:** last 90 days.
- **Loading:** skeleton.
- **Empty:** "No paid orders in this range".
- **Error:** `Alert`.
- **Success:** export toast.
- **Permission-denied:** scoped.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ full with sticky first columns; tv full.

## Accessibility
- Waterfall has a text table; dynamic partner columns have headers; expand rows announced.

## Motion
- Waterfall bars animate 300 ms. **Reduced motion:** static.

## Navigation
→ `/orders/[id]`, `/finance/ledger?order=`, `/products/[id]?tab=ownership`, `/finance/partners`.

## Data dependencies
Tables: `T-allocations`, `T-order_items`, `T-orders`, `T-products`, `T-offerings`, `T-product_ownerships`/lines, `T-partners`, `T-refunds`, `T-ledger_entries`.
Queries: `getOrderAllocation` (API-FIN-02), `listLedgerEntries` (API-FIN-01), `listPartners` (API-ADM-12).

## Requirement IDs
D-006, D-506, D-507, D-508, D-509, D-516, BR-05, BR-06, BR-07, D-512, D-515.

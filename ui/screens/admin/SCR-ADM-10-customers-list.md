# SCR-ADM-10 — Customers list

**Route:** `admin.<domain>/customers?q=&status=&tag=&country=` · **Render:** Client · **App:** Admin

## Purpose
Find any customer account and see at a glance their status, purchases, spend and open items. Entry to the customer record (SCR-ADM-11) where notes, tags, suspension, manual grants and reset links live (D-1108).

## User/role
Admin, Super Admin (`customers.read`).

## Entry points
Sidebar "Customers", ⌘K search by email, order/lead/query detail customer links, dashboard "New customers" widget.

## Layout
- **Desktop:** h1 "Customers" with count.
- Toolbar: search (name, email, company), Status `Select` (Active / Suspended / Deleted), Tag `Combobox` (multi), Country, "Has open order" / "Has active subscription" checkboxes in a `Popover`, Export CSV.
- `DataTable` columns: Customer (avatar, name, email, verified tick), Company/Country, Tags chips, Purchases (active entitlements count), Lifetime spend (INR), Open items (pending orders, open queries icons with counts), Status badge, Joined, Last seen, ⋯: Open, Send reset link, Suspend/Reinstate, New quote, New manual order.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
`DataTable`, `Input`, `Select`, `Combobox`, `Popover`, `Checkbox`, `Badge`, `Avatar`, `Button`, `DropdownMenu`, `AlertDialog` (suspend), `Skeleton`, `Pagination`.

## Content & copy notes
- Deleted customers display "Deleted · anonymised on <date>" (anonymisation is immediate on self-delete, BR-18 / MASTER_SPEC §7); their orders remain reachable.
- Suspend dialog: "Suspending signs the customer out and blocks purchases, downloads and chat. Existing invoices remain. Add a reason (logged)."

## Interactions
- Filters → URL; `listCustomers` (API-ADM-06) server-paginated.
- Suspend/Reinstate → `suspendCustomer`/`reinstateCustomer` (API-ADM-08) with reason; reset link → `sendResetLink` (API-ADM-09) confirm.
- Export → CSV (audited; excludes deleted PII).

## States
- **Default:** active, newest first.
- **Loading:** skeleton rows.
- **Empty:** "No customers match".
- **Error:** `Alert` + retry.
- **Success:** toasts.
- **Permission-denied:** actions gated by `customers.suspend`, `customers.reset_link`.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg–2xl full table (Customer, Company/Country, Tags, Purchases, Spend, Open items, Status, Joined, Last seen); tv 56 px rows, avatar 40 px.

## Accessibility
- Table caption; verified tick has text alt; open-item icons have counts in text; row menu labelled by customer name.

## Motion
- None.
- Reduced motion: none.

## Navigation
→ `/customers/[id]`, `/orders?customer=`, `/quotes/new?customer=`, `/orders/new?customer=`.

## Data dependencies
Tables: `T-users`, `T-customer_profiles`, `T-entitlements`, `T-orders`, `T-queries`, `T-subscriptions`, `T-audit_logs`.
Queries: `listCustomers` (API-ADM-06). Actions: `suspendCustomer`/`reinstateCustomer` (API-ADM-08), `sendResetLink` (API-ADM-09).

## Requirement IDs
D-1108, D-1003, D-1203, BR-18, D-1104, D-416.

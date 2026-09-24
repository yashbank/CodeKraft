# SCR-ADM-02 — Widget dashboard + widget library

**Route:** `admin.<domain>/dashboard` · **Render:** Client · **App:** Admin

## Purpose
Each admin's personal command centre: a drag-and-drop grid of widgets chosen from a library of 20 (D-120, D-1101, docs/04 §7.6), covering sales & revenue, operations queue, leads & queries, traffic & engagement, catalog & content, customers and system/AI health. Layout is saved per admin. Operational widgets link straight into the queues they summarise.

## User/role
Admin, Super Admin (widgets respect each widget's `requiredPermission`; Admin-role sees scoped data, D-512).

## Entry points
Post-login, sidebar "Dashboard", wordmark in admin shell.

## Layout
- **Desktop:** Admin shell.
- Page header: h1 "Dashboard", greeting/date, global range `Select` (7d / 30d / 90d / FY) applied to time-based widgets, buttons "Add widget" (opens library `Sheet`), "Edit layout" toggle (enables drag/resize handles), "Reset to default".
- Grid: react-grid-layout, 12 columns, row height 80 px, widgets sized per registry (`defaultSize`, `minSize`).
- Each widget is a `Card` with header (title, optional range chip, ⋯ menu: Refresh, Settings, Remove) and body. Charts use at most 7 categorical series (`--ck-chart-1..7`, docs/08 §6.17).
- Widget library (18–20): Sales — Revenue by period (line), Revenue by product (bar), Revenue by partner (bar; Super Admin only or own share), My share (stat + sparkline), Outstanding payouts (stat + list), Expenses vs profit (stacked bar).
- Operations — Payments awaiting confirmation (list with Confirm shortcut), Publish approvals pending (list), Split approvals pending (list), Service checklists due (list with progress), Revocation tasks (list).
- Leads & queries — New leads (stat + list), Pipeline funnel (funnel), Overdue follow-ups (list, red), Conversion rate (stat), Open queries (list).
- Traffic — Visits & top products (stat + table, from Umami + events).
- System/AI — Chatbot usage vs limits (gauge pair), Catalog status counts (stat row), New customers (stat + sparkline).
- Default layout for a new admin: Payments awaiting, Publish approvals, New leads, Open queries, Revenue by period, Overdue follow-ups.
- Library sheet: search, group filter, cards with preview thumbnail, description, required permission note, "Add" (disabled if already added or not permitted).
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Card`, `Select`, `Button`, `Sheet`, `DropdownMenu`, `Badge`, `Skeleton`, `Tooltip`, `Progress`, `Table`, Recharts charts, `react-grid-layout`
- custom: `WidgetFrame`, `StatTile`, `QueueList`, `Funnel`, `Gauge`, `WidgetLibrary`.

## Content & copy notes
- Stat tiles show value, delta vs previous range with arrow and text ("+12% vs previous 30 days").
- Queue widgets show up to 5 rows and "View all N".
- Empty widget copy is specific ("No payments awaiting confirmation").
- Money in INR (reporting currency, D-515) with native currency on hover.
- Admin-role: Revenue by partner hidden; My share shows own lines only.

## Interactions
- Each widget loads via `loadWidgetData` (API-ADM-14) with range/params; auto-refresh 60 s for operations widgets, on focus for others; manual Refresh in menu.
- Drag/resize in Edit mode → `saveDashboardLayout` (API-ADM-13) debounced 800 ms; "Done" exits edit mode.
- Keyboard: focus a widget's drag handle, arrow keys move by one column/row, Shift+arrows resize, Enter confirms.
- Queue rows link to detail screens (order, approval, lead, query, task); "Confirm" shortcut opens the confirm dialog from SCR-ADM-07 inline.
- Widget Settings (where applicable): range override, currency, top-N.

## States
- **Default:** saved layout.
- **Loading:** each widget shows its own skeleton (chart placeholder / rows); grid frame paints immediately.
- **Empty:** no widgets → onboarding card "Build your dashboard" with "Add widget" and "Use default layout".
- **Error:** per-widget inline error with Retry; a widget whose permission was removed renders "Not available" with Remove.
- **Success:** toast "Layout saved" only on explicit Done.
- **Permission-denied:** whole page requires `dashboard.admin`; widgets individually gated.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ 12 columns; 2xl 12 columns with wider max; tv 16 columns and larger type — layouts stored per breakpoint family (`lg` and `sm`) by react-grid-layout.

## Accessibility
- Widgets are `<section aria-labelledby>`; each chart has a visually hidden table and a summary sentence; drag handles are buttons with instructions in `aria-describedby`; live region announces "Moved Revenue by period to row 2"; colour never sole encoding (patterns/labels).

## Motion
- Widget drag uses transform with 150 ms settle; count-up on stats 600 ms; chart entry animation 400 ms. **Reduced motion:** no count-up, charts static, settle instant.

## Navigation
→ `/orders?status=awaiting`, `/approvals`, `/leads?overdue=1`, `/queries?status=open`, `/delivery-tasks`, `/finance/partners`, `/chatbot?tab=usage`, `/products`.

## Data dependencies
Tables: `dashboard_layouts`, and per widget: `T-ledger_entries`, `T-allocations`, `T-payouts`, `T-expenses`, `T-payments`, `T-approval_requests`, `T-service_progress`, `T-delivery_tasks`, `T-leads`, `T-queries`, `T-analytics_events`, `chat_usage_daily`, `T-products`, `T-users`, `job_runs`.
Queries/actions: `getDashboardLayout`/`saveDashboardLayout` (API-ADM-13), `loadWidgetData` (API-ADM-14), `getSystemHealthWidget` (API-OPS-03), `listPaymentsAwaiting` (API-PAY-07).

## Requirement IDs
D-120, D-1101, D-015, D-707, D-512, D-515, D-706, D-708, D-1301, D-1302, D-907.

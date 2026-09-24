# SCR-ADM-30 — Audit log

**Route:** `admin.<domain>/audit?actor=&action=&subject=&subjectId=&from=&to=&q=` · **Render:** Client · **App:** Admin

## Purpose
Filterable, exportable record of every admin action and auth event with actor, timestamp and before/after (D-1104). Append-only; no edits. Used for approvals forensics, security review and customer disputes.

## User/role
Admin, Super Admin (`audit.read`, `audit.export`).

## Entry points
Sidebar "System › Audit log", "View audit trail" links on orders, products, customers, settings, approvals, admin users; customer detail Activity tab.

## Layout
- **Desktop:** h1 "Audit log" with lock icon.
- Toolbar: date range, Actor `Combobox` (admins + "customer" + "system"), Action `Combobox` (grouped prefixes: auth.*, catalog.*, orders.*, payments.*, finance.*, approvals.*, settings.*, users.*, content.*, chat.*), Subject type + id, free-text search in action/memo, "Export CSV".
- `DataTable` (dense): Time, Actor (avatar, name, role), Action (monospace), Subject (type + link), Summary (auto-generated: "status draft → pending_approval"), IP, Request id.
- Row expand: side-by-side JSON diff (before / after) with changed keys highlighted, user agent, related approval request link.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `DataTable`, `DatePicker`, `Combobox`, `Input`, `Badge`, `Avatar`, `Collapsible`, `Button`, `Skeleton`, `Pagination`
- custom: `JsonDiff`.

## Content & copy notes
- Sensitive values (password hashes, license keys, bank details) are redacted in `before/after` at write time and shown as "•••• (redacted)".
- Export includes a header line with filter and generated-by (itself audited).

## Interactions
- Filters → URL; `listAuditLogs` (API-ADM-05) cursor pagination; live tail toggle (poll 10 s) for the current filter.
- Export → `exportAuditLogs` → CSV download (5-min link).

## States
- **Default:** last 7 days, all.
- **Loading:** skeleton rows.
- **Empty:** "No events match".
- **Error:** `Alert`.
- **Success:** export toast.
- **Permission-denied:** export hidden without `audit.export`.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg–tv full dense table with sticky Time/Actor columns on horizontal scroll; diff panel inline.

## Accessibility
- Diff uses text markers (+/−) not colour alone; table caption; expand announced; monospace action has full-text label.

## Motion
- None.
- Reduced motion: none.

## Navigation
→ subject links (orders, products, customers, settings, approvals, admin users).

## Data dependencies
Tables: `T-audit_logs`, `T-users`, `T-approval_requests`.
Queries: `listAuditLogs` (API-ADM-05). Actions: `exportAuditLogs` (API-ADM-05).

## Requirement IDs
D-1104, D-1103, A-1202, BR-13, BR-17, D-1203.

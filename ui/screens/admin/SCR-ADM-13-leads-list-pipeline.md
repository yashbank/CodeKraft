# SCR-ADM-13 — Leads list + pipeline board

**Route:** `admin.<domain>/leads?view=table|board&status=&source=&assigned=&overdue=1&q=` (`/leads/board` aliases `view=board`) · **Render:** Client · **App:** Admin

## Purpose
Work the sales pipeline. New leads from the inquiry form, product CTAs, chatbot and manual entry (D-704) land in a shared unassigned pool (D-705); admins claim or assign them, move them through New → Contacted → Qualified → Proposal → Won / Lost (D-703), and keep follow-up dates with overdue highlighting (D-706). Two views over the same data: table and kanban board.

## User/role
Admin (sees assigned + pool), Super Admin (all; `leads.read_all`).

## Entry points
Sidebar "Leads", dashboard "New leads" / "Overdue follow-ups" / "Pipeline funnel", notification "New lead", "Create › Lead".

## Layout
- **Desktop:** h1 "Leads" with `ToggleGroup` Table / Board.
- Toolbar: search (name, email, company), Source `Select` (Inquiry form, Product CTA, Chatbot, Manual), Assigned `Select` (Me, Unassigned pool, anyone), Priority, "Overdue only" switch, date range, "New lead" primary, "Export CSV".
- **Table:** `DataTable`: Name (+ company), Email/phone (masked partially for Admin-role? no — full, internal), Source chip (+ product name for product CTA), Service interest chips, Status badge, Assigned (avatar or "Pool" chip with "Claim" button), Next follow-up (date; red "Overdue 2 d"), Priority, Created, ⋯: Open, Claim/Assign, Set follow-up, Change status, Mark lost.
- **Board:** six columns (New, Contacted, Qualified, Proposal, Won, Lost) with counts and, for Won, total order value if linked; cards: name, company, source icon, product chip, follow-up chip (red when overdue), assignee avatar, priority dot.
- Drag between columns; Won/Lost drops open a dialog (Won: link order optional; Lost: reason required).
- Column "Lost" collapsed by default.
- Board supports the same filters.
- Bulk select in table → Assign to…, Set priority.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `ToggleGroup`, `DataTable`, `Input`, `Select`, `Switch`, `DatePicker`, `Badge`, `Avatar`, `Button`, `DropdownMenu`, `Dialog`, `Sheet` (quick view), `Skeleton`, `Pagination`, dnd-kit board
- custom: `LeadCard`, `KanbanColumn`, `FollowUpChip`, `ClaimButton`.

## Content & copy notes
- Overdue copy always includes days ("Overdue by 3 days").
- Pool chip explains "Unassigned — claim to work it".
- Lost reasons `Select`: Budget, Timing, Went elsewhere, No response, Not a fit, Other (+ text).
- Won dialog offers "Create project order" (→ SCR-ADM-08 prefilled).

## Interactions
- Load via `listLeads` (API-LEAD-03); new leads poll 10 s (badge + toast, D-707).
- Claim → `claimLead`; Assign → `assignLead` (API-LEAD-04).
- Drag/status → `updateLeadStatus` (API-LEAD-05) with optimistic move and undo toast; Won/Lost dialogs.
- Set follow-up → `setFollowUp` (API-LEAD-07) in a `Popover` (date + note).
- New lead → `createLeadManual` (API-LEAD-02) sheet (name, email, phone, company, source fixed Manual, service interest, product, message, priority, assign to me).
- Quick view `Sheet` on card click; "Open" → SCR-ADM-14.

## States
- **Default:** table, all open statuses (not Won/Lost), newest first.
- **Loading:** skeleton rows / column placeholders.
- **Empty:** "No leads yet — they'll appear here from the inquiry form, product pages and the assistant" / "No leads match".
- **Error:** `Alert`; failed drag reverts with toast.
- **Success:** toasts "Moved to Qualified · Undo", "Assigned to Priya".
- **Permission-denied:** Admin-role sees scoped rows; assign limited to self-claim unless `leads.assign`.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ 6 columns; tv wider cards.

## Accessibility
- Board columns are lists with headings; cards are buttons with full accessible names; drag has keyboard alternative ("Move to…" menu and Space/arrows via dnd-kit sensors) with live announcements; overdue conveyed by text; filters labelled.

## Motion
- Card drop settle 150 ms; column count tick. **Reduced motion:** instant moves.

## Navigation
→ `/leads/[id]`, `/orders/new?lead=`, `/customers/[id]` (if user linked), `/products/[id]`.

## Data dependencies
Tables: `T-leads`, `lead_activities`, `T-users` (assignees), `T-products`, `T-orders` (won link), `T-notifications`, `T-audit_logs`.
Queries: `listLeads` (API-LEAD-03). Actions: `createLeadManual` (API-LEAD-02), `assignLead`/`claimLead` (API-LEAD-04), `updateLeadStatus` (API-LEAD-05), `setFollowUp` (API-LEAD-07).

## Requirement IDs
D-014, D-703, D-704, D-705, D-706, D-707, D-512, D-015, D-1104, R-701.

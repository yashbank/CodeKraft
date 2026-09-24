# SCR-ADM-05 — Approvals inbox

**Route:** `admin.<domain>/approvals?tab=mine|requested|history` and `/approvals/[id]` · **Render:** Client · **App:** Admin

## Purpose
One inbox for every dual-approval action (A-1101, BR-13): product publish, ownership change, project-order split (`project_order.split`, MASTER_SPEC §7), ledger adjustment, refund, payout record, product archive/delete, admin user change. Shows the approver exactly what will change, records the decision with a comment, and applies the change atomically. The requester can never approve their own request (D-1102).

## User/role
Admin, Super Admin (`approvals.read`, `approvals.decide`).

## Entry points
Sidebar "Approvals" (badge = pending for me), notification "Approval requested", dashboard widgets, "Awaiting approval" chips on products/orders/finance screens.

## Layout
- **Desktop:** h1 "Approvals".
- `Tabs`: **For my approval** (default, count), **Requested by me**, **History**.
- Type filter chips (Publish, Ownership, Project order split, Adjustment, Refund, Payout, Archive/Delete, Admin users) — labels per docs/08 §6.8 `approval_requests.type`.
- List rows: type icon + label, subject (product name / order no / partner / user), requester avatar + name, age ("2 h ago", red after 48 h), status badge, quick "Review" button.
- Row click → detail page or right `Sheet` (desktop uses a two-pane layout: list left 40 %, detail right 60 %).
- Detail: header (type, subject link, requested by, when, comment), **Diff panel** specific to type: publish → readiness summary + product preview link + publish date; ownership → before/after table (company cut, partner shares) with effective date; project order split → order no, client, each project line with its `split_snapshot` (company cut, partner shares) and line total, note "Invoice and payment are blocked until approved"; adjustment → ledger lines table (party, amount, memo); refund → order, payment, amount, reason, "revoke entitlements" flag, refundability policy note; payout → partner, amount, date, reference, available balance; archive/delete → product, order count; admin user → email/role before/after.
- Decision box: comment `Textarea` (required for reject), buttons "Approve" (primary) and "Reject" (destructive).
- After decision: outcome banner and "Applied at" or error with "Retry apply".
- Requester view: same detail, no decision buttons, "Cancel request" available while pending.
- **Phone / tablet (< lg):** one of the three admin surfaces with a **read-mostly** layout (MASTER_SPEC §7 "Admin minimum width"): single pane, list then detail as a full page; Approve / Reject with comment remain available; nothing else.

## Components
- shadcn/ui: `Tabs`, `ToggleGroup`, `Badge`, `Avatar`, `Card`, `Sheet`, `Table`, `Textarea`, `Button`, `AlertDialog` (confirm approve for finance types), `Alert`, `Skeleton`
- custom: `DiffTable`, `ApprovalRow`, `DecisionBox`.

## Content & copy notes
- Approve confirmation for money types: "Approving will post ledger entries immediately. This cannot be undone." Self-request notice: "You requested this — another admin must approve." Rejected copy shows the comment prominently.
- History rows show both decisions with timestamps.

## Interactions
- List via `listApprovals` (API-ADM-01), polling 10 s on the "For my approval" tab.
- Approve → `approveRequest` (API-ADM-02) → server applies (`approvals.execute`) → banner; Reject → `rejectRequest` (API-ADM-03) with comment.
- Cancel own → `cancelRequest`; failed apply → `retryApply` (Super Admin) (API-ADM-04).
- Keyboard: J/K to move, Enter to open (documented in a `Kbd` hint).

## States
- **Default:** pending for me.
- **Loading:** skeleton rows.
- **Empty:** "Nothing awaiting your approval" / "You haven't requested anything" / "No history yet".
- **Error:** decide failure `Alert`; apply error shows `error` text with retry.
- **Success:** toast "Approved — published FitDesk Pro" / "Rejected".
- **Permission-denied:** requester sees no decision buttons; missing `approvals.decide` → read-only.

## Responsive behaviour
xs single pane; md–lg list + sheet; xl+ two-pane; tv two-pane with wider diff tables.

## Accessibility
- Two-pane uses `aria-controls`; diff tables have headers and `<caption>`; decision buttons labelled with the subject ("Approve publish of FitDesk Pro"); age colour supplemented by text "overdue"; comment required error announced.

## Motion
- Pane cross-fade 150 ms; row removal on decision collapses 200 ms. **Reduced motion:** none.

## Navigation
→ `/products/[id]`, `/orders/[id]`, `/finance/ledger?request=`, `/finance/partners`, `/admin-users`.

## Data dependencies
Tables: `T-approval_requests`, `approval_decisions`, `T-products`, `T-product_ownerships`/lines, `T-refunds`, `T-payouts`, `T-ledger_entries`, `T-users`/`T-partners`, `T-notifications`, `T-audit_logs`.
Queries: `listApprovals`/`getApproval` (API-ADM-01). Actions: `approveRequest` (API-ADM-02), `rejectRequest` (API-ADM-03), `cancelRequest`/`retryApply` (API-ADM-04).

## Requirement IDs
A-1101, BR-05, BR-09, BR-12, BR-13, BR-17, D-506, D-517, D-1102, D-1103, D-1105, D-1104, D-707.

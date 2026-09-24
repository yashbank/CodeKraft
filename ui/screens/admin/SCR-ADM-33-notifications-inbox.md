# SCR-ADM-33 — Admin notification inbox

**Route:** `admin.<domain>/notifications?filter=all|unread&type=` · **Render:** Client · **App:** Admin

## Purpose
The persisted, in-app-only alert inbox for admins (D-707): payment references submitted, new leads and queries, customer replies, approval requests and decisions, delivery tasks raised, chatbot cap reached, overdue follow-ups, system job failures. An admin who was offline sees everything unread on return. No email/SMS/push for admins (X-012), except the overdue follow-up digest configured in Settings (R-701).

## User/role
Admin, Super Admin (own inbox).

## Entry points
Bell popover "View all", sidebar "Notifications" (badge), toast click.

## Layout
- **Desktop:** h1 "Notifications" with unread count; toolbar: `Tabs` All / Unread, type chips (Payments, Leads, Queries, Approvals, Delivery, Chatbot, System), "Mark all as read".
- List grouped by day; rows: type icon, title (bold when unread), body line (order no / customer / product), relative time, inline action button where useful ("Confirm payment", "Review approval", "Claim lead", "Open query", "Mark task done").
- Bulk select for mark read.
- "Load more".
- Bell `Popover` (shell-level, shared with §4.4 of docs/07): 8 latest, unread dots, "Mark all read", "View all".
- **Phone / tablet (< lg):** one of the three admin surfaces with a **read-mostly** layout (MASTER_SPEC §7 "Admin minimum width"): the same list with chips scrolling; inline actions are limited to "Review approval" and "Confirm payment" (the read-mostly screens); other inline actions become links with the "Open on a laptop" hint.

## Components
- shadcn/ui: `Tabs`, `ToggleGroup`, `Button`, `Badge`, `Checkbox`, `Separator`, `Skeleton`, `Popover`
- custom: `NotificationRow`, `TypeIcon`.

## Content & copy notes
- Titles are actionable verbs: "Payment reference submitted · CK-ORD-000012", "New lead · Acme Ltd (product CTA)", "Priya requested approval: publish FitDesk Pro", "Provision account for FitDesk Pro · ravi@…", "Daily chat cap reached", "Job orders.expire failed".
- Age over 48 h shows "2 d" in warning colour with text.

## Interactions
- List `listNotifications` (API-NOTIF-01); shell polls `GET /api/notifications?since=` every 10 s (API-NOTIF-02) → badge + toast + optional bell shake.
- Row click → `markRead` (API-NOTIF-03) then navigate to `link`; inline actions open the target dialog directly (e.g. confirm payment dialog from SCR-ADM-07).
- Mark all → `markAllRead`.

## States
- **Default:** all, newest first.
- **Loading:** skeleton rows.
- **Empty:** "You're all caught up".
- **Error:** `Alert` + retry; polling failure shows a subtle "Reconnecting…" chip in the shell.
- **Success:** toast for mark-all.
- **Permission-denied:** n/a (own rows).

## Responsive behaviour
xs single column; lg+ max 960 px; tv larger rows.

## Accessibility
- Live toasts `aria-live="polite"`, never `assertive`; unread state as text; inline actions named with context; bell button announces unread count; polling updates do not steal focus.

## Motion
- Toast slide 200 ms; bell shake 300 ms once. **Reduced motion:** toast fade only, no shake.

## Navigation
→ `/orders/[id]`, `/leads/[id]`, `/queries/[id]`, `/approvals/[id]`, `/delivery-tasks`, `/chatbot?tab=usage`, `/settings/retention` (job failures).

## Data dependencies
Tables: `T-notifications`, `job_runs` (system alerts source).
Queries: `listNotifications` (API-NOTIF-01), `pollNotifications` (API-NOTIF-02). Actions: `markRead`/`markAllRead` (API-NOTIF-03).

## Requirement IDs
D-707, D-015, D-705, D-706, R-701, X-012, D-708, A-1401 (job failures surfaced), docs/04 §7.5.

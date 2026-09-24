# SCR-ACC-08 — Notifications (customer inbox)

**Route:** `/account/notifications?filter=all|unread` · **Render:** Client · **App:** Account

## Purpose
Persistent in-app inbox mirroring the customer's email notifications (D-1002): order created, payment submitted/confirmed, delivery ready (key issued, account provisioned, service step done), renewal reminders, grace/suspension warnings, query replies, refund outcomes, product updates for owned products. Nothing here is auto-deleted.

## User/role
Customer.

## Entry points
Bell popover "View all", sidebar "Notifications", bottom tab "More › Notifications".

## Layout
- **Desktop:** h1 "Notifications" with unread count; toolbar: filter `Tabs` All / Unread, type chips (Orders, Delivery, Renewals, Queries, Product updates), "Mark all as read".
- List grouped by day headings ("Today", "Yesterday", "22 Sep 2026"): each row has a type icon, title (bold when unread), one-line body, relative time, and navigates to `link`.
- Rows with actions show a secondary button inline (e.g. "Submit reference", "Renew", "Reveal key").
- Pagination "Load more".
- **Phone:** same list, chips scroll, swipe not used (tap to open marks read).

## Components
- shadcn/ui: `Tabs`, `ToggleGroup` chips, `Button`, `Badge`, `Separator`, `Skeleton`
- custom: `NotificationRow`, `TypeIcon`.

## Content & copy notes
- Titles are short verbs: "Payment confirmed", "Your license key is ready", "Renewal due in 7 days", "CodeKraft replied to 'Install issue'", "Refund approved — credit note issued", "FitDesk Pro 2.4 released".
- Bodies contain the order/product name.
- Email preference note at the bottom: "Manage email preferences in Settings."

## Interactions
- Row click → `markRead` (API-NOTIF-03) then navigate.
- "Mark all as read" → `markAllRead`; toast with count.
- Bell badge updates via polling (API-NOTIF-02, 30 s).

## States
- **Default:** all, newest first.
- **Loading:** 8 skeleton rows.
- **Empty:** "You're all caught up" (unread) / "No notifications yet".
- **Error:** `Alert` + retry.
- **Success:** mark-all toast.
- **Permission-denied:** n/a.

## Responsive behaviour
xs single column; lg+ max 880 px; tv larger rows.

## Accessibility
- List with `aria-label="Notifications"`; unread conveyed by text "Unread" (visually hidden) not only bold; day headings are `h2`; action buttons named with context.

## Motion
- Row read-state cross-fade 150 ms. **Reduced motion:** none.

## Navigation
→ notification `link` targets: `/account/orders/[id]`, `/account/purchases/[id]`, `/account/queries/[id]`, `/products/[slug]`, `/account/settings`.

## Data dependencies
Tables: `T-notifications`.
Queries: `listNotifications` (API-NOTIF-01), `pollNotifications` (API-NOTIF-02). Actions: `markRead`/`markAllRead` (API-NOTIF-03).

## Requirement IDs
D-1002, D-1001, D-707 (pattern), D-521, D-604, D-702.

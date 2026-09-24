# SCR-ADM-11 — Customer detail

**Route:** `admin.<domain>/customers/[userId]?tab=overview|orders|entitlements|queries|activity` · **Render:** Client · **App:** Admin

## Purpose
The full customer record: profile and billing, internal notes and tags, status controls (suspend/ban/reinstate), manual entitlement grant and revoke, password reset / one-time login link (D-1108), plus their orders, entitlements, queries, chatbot usage and audit activity.

## User/role
Admin, Super Admin (`customers.read`, `customers.notes.write`, `customers.suspend`, `customers.reset_link`, `entitlements.admin`).

## Entry points
Customers list, order/lead/query detail links, ⌘K.

## Layout
- **Desktop:** Breadcrumb (Customers › Name).
- Header card: avatar, name, email (verified tick), phone (if any), country/company, status badge, tags (inline editable chips), joined/last seen, buttons: "Send reset link", "Send one-time login link", "Suspend"/"Reinstate", ⋯ (New quote, New manual order, Grant access, Export data).
- Left (8/12) `Tabs`: **Overview** (stats: lifetime spend INR, orders, active entitlements, open queries; recent orders 5; active entitlements 5; open queries), **Orders** (table as SCR-ADM-06 filtered), **Entitlements** (table: product · offering, type, status, access period, downloads used/cap, actions: Open order, Revoke, Reset downloads, Extend, Cancel subscription), **Queries** (list with status; open thread), **Activity** (audit + auth events for this user: logins, reference submissions, key reveals, downloads; chatbot usage today vs cap).
- Right (4/12): **Internal notes** (Tiptap-lite textarea with save, history of edits), **Billing details** (read-only snapshot with "last used at checkout"), **Preferences** (display currency, theme, email prefs), **Flags** (chargeback flagged, suspension reason).
- Grant access `Dialog`: Offering `Combobox`, Access (lifetime / months), Reason* (mandatory), optional link to an existing order; note "No ledger entries, allocations or invoice; audited; the other admins are notified" (D-1108, MASTER_SPEC §7 "Manual entitlement grants"; `entitlements.order_item_id` stays null — no synthetic order).
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Breadcrumb`, `Card`, `Badge`, `Avatar`, `Tabs`, `DataTable`, `Textarea`, `Button`, `Dialog`, `AlertDialog`, `Combobox`, `Select`, `Input`, `Tooltip`, `Skeleton`
- custom: `TagChips`, `StatRow`, `EntitlementAdminRow`.

## Content & copy notes
- Suspension and revocation require a reason (audited, D-1104).
- Grant dialog clarifies: "Manual grants create an entitlement without an order or invoice; use a manual order if money changed hands." Deleted customer: header shows anonymisation status, actions disabled except viewing records.

## Interactions
- Notes/tags → `updateCustomerNotes` (API-ADM-07), autosave with "Saved" status.
- Suspend/Reinstate → API-ADM-08; reset/magic link → API-ADM-09 (confirm dialog; magic link expires in 15 min).
- Grant → `grantEntitlement` (API-DEL-11); Revoke → `revokeEntitlement` (API-DEL-12); Reset downloads → API-DEL-13; Extend / Cancel subscription → API-DEL-14.
- Tabs load lazily via `getCustomer` (API-ADM-06) sub-queries.

## States
- **Default:** overview.
- **Loading:** header skeleton, tab skeleton.
- **Empty:** per tab ("No orders yet", "No notes — add one").
- **Error:** action errors inline; `DUPLICATE_PURCHASE` on grant.
- **Success:** toasts "Access granted — customer emailed", "Reset link sent".
- **Permission-denied:** actions hidden per permission.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ 8/4; tv 8/4.

## Accessibility
- Tag chips editable via keyboard (Enter to add, Backspace to remove, announced); dialogs with reason fields required; tables captioned; status badge text.

## Motion
- Tab cross-fade.
- Reduced motion: none.

## Navigation
→ `/orders/[id]`, `/queries/[id]`, `/quotes/new?customer=`, `/orders/new?customer=`, `/audit?actor=`.

## Data dependencies
Tables: `T-users`, `T-customer_profiles`, `T-entitlements`, `T-subscriptions`, `T-orders`, `T-payments`, `T-queries`, `chat_usage_daily`, `T-downloads`, `T-audit_logs`, `T-notifications`, `email_outbox`.
Queries: `getCustomer` (API-ADM-06), `listEntitlementsAdmin` (API-DEL-06), `listQueriesAdmin` (API-CHAT-04), `listAuditLogs` (API-ADM-05). Actions: API-ADM-07/08/09, API-DEL-11/12/13/14.

## Requirement IDs
D-1108, D-1003, D-1203, D-416, D-606, D-607, D-605, D-521, BR-18, D-1104, D-708.

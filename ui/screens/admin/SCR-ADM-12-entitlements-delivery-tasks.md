# SCR-ADM-12 — Entitlements & delivery tasks

**Route:** `admin.<domain>/entitlements?status=&type=&q=` and `/delivery-tasks?kind=&status=` · **Render:** Client · **App:** Admin

## Purpose
Two operational lists over the delivery pivot (A-602): every entitlement across customers (to find suspended/expiring access, download caps hit, keys not yet issued) and the task queue the platform raises when a human must act — provision an account (D-601) or disable an external account after revocation/refund (D-607). Also surfaces subscription renewals due and grace expiries (D-521).

## User/role
Admin (scoped to own products), Super Admin (`delivery.tasks.write`, `entitlements.admin`).

## Entry points
Sidebar "Entitlements" / "Delivery tasks", dashboard "Service checklists due" and "Revocation tasks", notifications "Delivery task", order detail.

## Layout
- **Entitlements (desktop):** h1 "Entitlements", status chips (Pending, Active, Suspended, Expired, Revoked), Type `Select`, "Expiring in 30 days" and "Cap reached" quick filters, search (customer, product).
- `DataTable`: Customer, Product · offering, Type, Status, Access ends, Subscription (interval · period end · status), Downloads (used/cap), Key (issued/not), Provisioning (n/a / pending / done), Order, ⋯: Open order, Enter key, Mark provisioned, Revoke, Reset downloads, Extend, Cancel subscription.
- **Delivery tasks (desktop):** h1 "Delivery tasks", `Tabs` Open / Done, kind chips (Provision, Revoke external), `DataTable`: Created, Kind, Customer, Product · offering, Entitlement status, Assigned to (`Combobox` inline), Note, Age (red > 2 days), actions: "Open order", "Mark done" (note required for revoke external: "Confirm the external account was disabled").
- Row expands to show provisioning notes and the offering's delivery config hints (URL, instructions).
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `DataTable`, `Tabs`, `Select`, `Combobox`, `Input`, `Badge`, `Button`, `DropdownMenu`, `Dialog`, `Collapsible`, `Tooltip`, `Skeleton`, `Pagination`
- custom: `EntitlementAdminRow`, `TaskRow`.

## Content & copy notes
- Suspended copy: "Suspended · grace ended <date>" (during grace the subscription is `past_due` and the entitlement stays `active`); SaaS rows with manual provisioning show `active` + "Provisioning" chip until the task is done (MASTER_SPEC §7 "Order fulfilled"); Cap reached: "5/5 — customer asked for reset?" with link to their query if any.
- Task copy for revoke external: "Revoke access in <SaaS> for <email>, then mark done." Service checklists are worked on the order detail, not here (link).

## Interactions
- Lists via `listEntitlementsAdmin` (API-DEL-06), `listDeliveryTasks` (API-DEL-10); tasks tab polls 10 s.
- Inline actions call API-DEL-07/08/09/12/13/14; Mark done → `completeDeliveryTask` (API-DEL-10) with note.
- Assign → updates `delivery_tasks.assigned_to`.

## States
- **Default:** entitlements Active; tasks Open.
- **Loading:** skeleton rows.
- **Empty:** "No open delivery tasks" / "No entitlements match".
- **Error:** `Alert`.
- **Success:** toasts.
- **Permission-denied:** scoped rows; actions gated.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ full; tv larger.

## Accessibility
- Captions; age urgency in text; inline assign combobox labelled; expandable rows with `aria-expanded`.

## Motion
- Row expand 150 ms.
- Reduced motion: none.

## Navigation
→ `/orders/[id]`, `/customers/[id]`, `/products/[id]`, `/queries/[id]`.

## Data dependencies
Tables: `T-entitlements`, `T-subscriptions`, `T-delivery_tasks`, `T-service_progress`, `T-downloads`, `T-offerings` (delivery_config), `T-products`, `T-users`, `T-orders`, `T-audit_logs`, `T-notifications`.
Queries: `listEntitlementsAdmin` (API-DEL-06), `listDeliveryTasks` (API-DEL-10). Actions: API-DEL-07, 08, 09, 10, 12, 13, 14.

## Requirement IDs
A-602, D-601, D-603, D-605, D-606, D-607, D-608, D-521, BR-14, BR-15, D-707, D-512.

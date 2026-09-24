# SCR-ADM-06 — Orders list

**Route:** `admin.<domain>/orders?status=&type=&method=&q=&from=&to=` · **Render:** Client · **App:** Admin

## Purpose
Find and triage orders. The default view is the operational queue "Awaiting confirmation" (payments with a submitted reference), because every release-1 order needs a human confirmation (D-501). Covers product and project orders (D-1107) in one table.

## User/role
Admin (scoped to orders containing own products), Super Admin.

## Entry points
Sidebar "Orders", dashboard "Payments awaiting confirmation", notification "Payment submitted", customer detail "Orders", ⌘K search by order number.

## Layout
- **Desktop:** h1 "Orders" with queue chips: Awaiting confirmation (n, highlighted), Pending payment, Paid, Fulfilled, Failed, Cancelled, Refunded.
- Toolbar: search (order no, customer email, product), Type (Product / Project), Method (UPI / Bank), date range, "Export CSV", "New manual order" primary.
- `DataTable` columns: Order no, Date, Customer (name + email; project orders show client name + "Project" chip), Items (product · offering, +N), Total (currency), Payment (method icon + payment status badge + reference snippet), Order status badge, Expires (pending only, red < 24 h), ⋯: Open, Confirm payment (when submitted/initiated), Mark failed, Cancel, Download invoice.
- **Phone / tablet (< lg):** **read-mostly** layout limited to payment confirmation (MASTER_SPEC §7 "Admin minimum width"): only the "Awaiting confirmation" queue renders, as cards (order no + status, customer, total, payment status, reference) with a single action, "Confirm payment" (the SCR-ADM-07 dialog as a full-screen drawer). Other queues, filters, export and the manual-order button are hidden with the "Open on a laptop" hint.

## Components
- shadcn/ui: `DataTable`, `Input`, `Select`, `DatePicker` range, `Badge`, `Button`, `DropdownMenu`, `Dialog` (confirm payment — shared with SCR-ADM-07), `Skeleton`, `Pagination`
- custom: `QueueChips`, `MoneyCell`, `PaymentCell`.

## Content & copy notes
- Queue chip tooltip: "Payments where the customer submitted a reference or that are older than 1 day without one." Expiry column copy "Expires in 3 d".
- Export includes totals in INR and native.

## Interactions
- Chips/filters update URL; server pagination (`listOrdersAdmin`, API-COM-06); the awaiting queue polls every 10 s.
- Row → SCR-ADM-07. "Confirm payment" opens the confirm dialog inline (same component as detail).
- Export → CSV of current filter (audited).

## States
- **Default:** Awaiting confirmation queue.
- **Loading:** skeleton rows.
- **Empty:** "No payments awaiting confirmation" / "No orders match".
- **Error:** `Alert` + retry.
- **Success:** toast after inline confirmation "CK-ORD-000012 marked Paid · invoice CK/2026-27/0007".
- **Permission-denied:** `orders.read` only → no actions; Admin-role sees scoped rows.

## Responsive behaviour
- < lg: read-mostly awaiting-confirmation cards only (see Layout); column priority Order no › Status › Customer › Total › Payment.
- lg–2xl: full table with sticky header; tv: 56 px row height, larger badges.

## Accessibility
- Table caption; queue chips `aria-pressed`; badges with text; expiry urgency conveyed with text "urgent"; row menu labelled with order number.

## Motion
- Row highlight on new arrival (background fade 1 s; none under reduced motion).

## Navigation
→ `/orders/[id]`, `/orders/new`, `/customers/[id]`, `/products/[id]`.

## Data dependencies
Tables: `T-orders`, `T-order_items`, `T-payments`, `T-invoices`, `T-users`, `T-customer_profiles`, `T-products`, `T-offerings`.
Queries: `listOrdersAdmin` (API-COM-06), `listPaymentsAwaiting` (API-PAY-07). Actions: `confirmPayment` (API-PAY-03), `failPayment` (API-PAY-04), `getInvoicePdfUrl` (API-COM-12).

## Requirement IDs
D-411, D-412, D-501, D-516, D-1107, D-512, D-707, D-015, BR-16.

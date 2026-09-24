# SCR-ADM-07 — Order detail

**Route:** `admin.<domain>/orders/[orderId]` · **Render:** Client · **App:** Admin

## Purpose
Work one order end to end: verify and confirm the manual payment (recording the amount actually received and any bank shortfall, D-516), watch the ledger posting and invoice issue, fulfil each item per delivery type (provision account, enter license key, tick service checklist steps, D-601–D-608), manage entitlements (revoke, reset download count, extend), and propose refunds (dual-approved, BR-09). Everything is audited.

## User/role
Admin (scoped), Super Admin. Payment confirmation needs `payments.confirm`; refunds `refunds.propose`; entitlement actions `entitlements.admin`/`delivery.tasks.write`.

## Entry points
Orders list, dashboard queues, notifications ("Payment submitted", "Delivery task"), customer detail, approvals inbox (refund), ledger entry links.

## Layout
- **Desktop:** Breadcrumb (Orders › CK-ORD-000012).
- Header: h1 order no, type chip (Product/Project), status badge, for project orders a **split banner** ("Split awaiting approval by <admin>" → link to the `project_order.split` request; "Split approved" once applied — payment confirmation and invoice issue are disabled until then, MASTER_SPEC §7 "Project order splits"), placed date, customer link, totals (INR + native), primary action depends on state ("Confirm payment" / "Fulfil" / none), ⋯ (Mark failed, Cancel, Resend instructions email, Download invoice, Propose refund, Flag chargeback, View audit trail).
- Body: left (8/12) stacked cards; right (4/12) side cards.
- Left:
1. **Payment** card: method, amount due, status badge, customer reference + submitted time, instructions snapshot (VPA/bank), admin reference, received amount, shortfall, confirmed by/at. Buttons: "Confirm payment" (opens `Dialog`: Amount received* (prefilled with due), Received on*, Reference* (prefilled from customer's), Note, live computed "Shortfall: ₹150 → recorded as bank charge" or "Overpaid by ₹120 → recorded as customer credit, not allocated" (`customer_credit_minor`, MASTER_SPEC §7 "Overpayment"), checkbox "I've verified this transfer in the bank/UPI statement", primary "Confirm and mark Paid"), "Mark failed" (reason). Previous failed payments listed; the customer credit, when present, shows as an `info` chip on the card.
2. **Items & fulfilment** card: per item: product · offering, qty, unit, discount, tax, total, ownership version chip (admin-only), and the **entitlement panel** once Paid: status, access period; per type: Download (files count, downloads used/cap, "Reset count"), License ("Enter key" input + Save → notifies the customer with a **link to the dashboard only**; the key is never in the email, MASTER_SPEC §7 "License key delivery"; "Rotate key"), SaaS/Hosted (provisioning task: notes, credentials-sent checkbox, "Mark provisioned"), Service (checklist with per-step tick + note + done by; progress bar), Custom ("Mark delivered"). The order turns `fulfilled` automatically when every entitlement is `active` and every service checklist is complete (MASTER_SPEC §7 "Order fulfilled"); SaaS with manual provisioning is `active` on grant with `provisioning_state = pending` shown separately. Common: "Revoke access" (reason; external accounts create a revoke task), "Extend access".
3. **Ledger & invoice** card (after Paid): invoice number + PDF, ledger entries table for this order (type, party, amount, INR) and the allocation snapshot (company cut, partner lines) — visible to Super Admin; Admin-role sees own lines only.
4. **Timeline** card: system events (created, reference submitted, confirmed, invoice issued, entitlement active, step done, refund requested/approved), each with actor and time; linked queries (order-source) with "Reply".
- Right: **Customer** card (name, email, country, GST, company, notes/tags, link), **Billing snapshot**, **Coupon / quote** card, **Refund** card (existing refunds, credit notes; "Propose refund" → dialog: amount ≤ refundable, reason, revoke entitlements toggle, policy note when product non-refundable with "Policy exception" checkbox, link to query).
- **Phone / tablet (< lg):** **read-mostly** layout limited to payment confirmation (MASTER_SPEC §7 "Admin minimum width"): header, Payment card and Customer card render read-only; the only action is "Confirm payment" (full-screen drawer). Fulfilment, refund, entitlement and ledger cards show a collapsed summary with the "Open on a laptop" hint.

## Components
- shadcn/ui: `Breadcrumb`, `Badge`, `Card`, `Button`, `DropdownMenu`, `Dialog`, `AlertDialog`, `Form`, `Input`, `DatePicker`, `Textarea`, `Checkbox`, `Switch`, `Table`, `Progress`, `Alert`, `Tooltip`, `Skeleton`
- custom: `ConfirmPaymentDialog`, `EntitlementPanel/*`, `LedgerMiniTable`, `OrderTimeline`, `RefundDialog`.

## Content & copy notes
- Confirm dialog explains: "Amount received less than due is recorded as a bank charge on this order and deducted before the split" (D-516).
- Over-receipt is accepted: the excess is recorded as `customer_credit_minor` on the payment, shown to admins on the order and never allocated to partners (MASTER_SPEC §7 "Overpayment"); the dialog asks for a note.
- License key field masked after save; "Customer notified at 14:02 (link only)".
- Revoke copy distinguishes automatic (downloads/keys) vs task (external SaaS, D-607).
- Refund copy: "Only UPI/bank payments can be refunded; gateway payments are non-refundable" (D-505).
- Ownership/allocation details are admin-only and never in customer emails (BR-02).

## Interactions
- Confirm → `confirmPayment` (API-PAY-03; disabled on project orders until the `project_order.split` request is applied) → one transaction: Paid, ledger, allocations, invoice, entitlements, tasks; page refreshes state with toast including invoice number.
- Mark failed → `failPayment` (API-PAY-04). Cancel → order cancel (admin). Chargeback → `flagChargeback` (API-PAY-08).
- Fulfilment: `setLicenseKey` (API-DEL-08), `completeProvisioning` (API-DEL-07), `markServiceStep` (API-DEL-09), `completeDeliveryTask` (API-DEL-10), `revokeEntitlement` (API-DEL-12), `resetDownloadCount` (API-DEL-13), `extendAccess` (API-DEL-14).
- Refund → `proposeRefund` (API-PAY-05) → approval chip; approval applies reversal entries + credit note + revocation.
- Polling 10 s while pending payment to catch reference submissions.

## States
- **Default:** by status.
- **Loading:** header + card skeletons.
- **Empty:** no ledger entries before Paid ("Posted when the payment is confirmed"); no queries.
- **Error:** confirm validation; `STATE_INVALID` (already confirmed elsewhere — refresh prompt); apply errors.
- **Success:** toasts per action; timeline updates.
- **Permission-denied:** buttons hidden/disabled by permission with tooltip; Admin-role sees allocation lines for own partner only.

## Responsive behaviour
< lg: read-mostly payment-confirmation layout (see Layout). lg+ 8/4; tv 8/4 with larger tables.

## Accessibility
- Dialog focus trap with computed shortfall in a live region; checklist steps are checkboxes with labels and "done by" text; key input masked with reveal toggle; timeline as ordered list; money cells labelled with currency.

## Motion
- Card state cross-fade 150 ms; progress animate 300 ms. **Reduced motion:** none.

## Navigation
→ `/orders`, `/customers/[id]`, `/products/[id]`, `/finance/ledger?order=`, `/approvals/[id]`, `/queries/[id]`, `/delivery-tasks`.

## Data dependencies
Tables: `T-orders`, `T-order_items` (`split_snapshot` for project lines), `T-payments` (`customer_credit_minor`), `T-refunds`, `T-invoices`, `credit_notes`, `T-entitlements`, `T-subscriptions`, `T-service_progress`, `T-delivery_tasks`, `T-release_files`, `T-downloads`, `T-ledger_entries`, `T-allocations`, `T-product_ownerships`, `T-users`, `T-customer_profiles`, `T-coupons`, `T-custom_quotes`, `T-queries`, `T-approval_requests`, `T-audit_logs`, `email_outbox`, `T-notifications`.
Queries: `getOrderAdmin` (API-COM-06), `getEntitlementAdmin` (API-DEL-06), `getOrderAllocation` (API-FIN-02). Actions: API-PAY-03/04/05/08, API-DEL-07…10, 12, 13, 14, API-COM-12.

## Requirement IDs
D-411, D-416, D-501, D-505, D-507, D-516, D-601, D-602, D-603, D-606, D-607, D-608, D-414, D-415, BR-06, BR-09, BR-13, BR-15, BR-16, BR-17, D-1104, D-1108, D-512, BR-02.

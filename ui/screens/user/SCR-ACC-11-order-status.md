# SCR-ACC-11 — Order status (pay, submit reference, track)

**Route:** `/account/orders/[orderId]#pay` · **Render:** Client · **App:** Account

## Purpose
The single page for one order's life: show UPI QR or bank details, let the customer submit (or edit) their transaction reference, show the waiting-for-confirmation state, then the Paid/Fulfilled state with post-purchase instructions and links to the entitlement and invoice. Handles failed payments (retry, D-416), expiry (BR-10), cancellation, refunds, and the "Request refund" entry (BR-09; routed to a query thread since no public email exists).

## User/role
Customer (owner).

## Entry points
Checkout redirect, overview action cards, purchases "Pending & past orders", invoices/payments tab, emails ("Complete your payment", "Payment confirmed"), chatbot order-status card, notifications.

## Layout
- **Desktop:** Breadcrumb (Purchases › Order CK-ORD-000012).
- Header: h1 "Order CK-ORD-000012", status `Badge`, placed date, expiry countdown when pending ("Pay within 5 days 3 h"). **Status timeline** (horizontal stepper): Placed → Paid → Confirmed by us → Access ready, with Failed/Cancelled/Refunded rendered as terminal branches.
- Two columns: left (7/12) the **stage panel**; right (5/12) order summary (items, totals, billing snapshot, payment method, "Change billing details" not allowed after placement — note).
- Stage panels:
- **Pending payment · Initiated:** (a) UPI: large QR image (data URL), amount, VPA text with Copy, "Open in UPI app" button (upi:// link, phone only), note "Use the order number CK-ORD-000012 as the payment note"; (b) Bank: table of account name, account number (Copy), IFSC (Copy), bank name, SWIFT (if foreign), amount, reference to quote. Below either: **Reference form** — "Transaction reference / UTR"* (6–64 chars), "Paid on" date (default today), optional note, "I've paid — submit reference" primary. Secondary: "Switch to bank transfer/UPI" (if both enabled; creates a new payment via retry), "Cancel order".
- **Pending payment · Submitted:** green check "Reference received: <UTR>", "We're confirming your payment — usually within 1 working day. You'll get an email." + "Edit reference" (rate-limited), "Cancel order" hidden once submitted.
- **Paid / Fulfilled:** "Payment confirmed on <date>" with received amount; if shortfall was recorded, copy "We received ₹11,650 against ₹11,800; the bank charge was absorbed by us — nothing more to pay." Post-purchase instructions rich text (A-601). Big button "Go to your purchase" → entitlement; "Download invoice". Fulfilment progress for service/provisioning types mirrors SCR-ACC-03 summary.
- **Pending payment · attempt failed:** the order stays `pending_payment` while the customer may retry (D-416): reason (admin note if provided), "Retry payment" → method chooser → new instructions.
- **Failed (expired) / Cancelled:** terminal states — the expiry cron sets the order `failed` with reason `expired` when `expires_at` passes without a confirmed payment (BR-10, MASTER_SPEC §7 "Order failed", docs/03 FR-COM-06); `cancelled` only when the customer or an admin cancels: copy ("This order expired on <date>" / "You cancelled this order") + "Buy again" → product page.
- **Refunded / Partially refunded:** amount, credit note link, "Access was revoked on <date>" if applicable.
- Footer of every stage: "Need help with this order? Open a query" and, when Paid/Fulfilled, "Request refund" (both create a query with `source='order'`; refund one uses subject "Refund request · <order no>"; shown for non-refundable products too with the policy note — MASTER_SPEC §7 "Refund request channel"). Email via the invoice contact details remains possible; admins log those as `source='email'`.
- **Phone:** timeline vertical compact; QR full width; copy buttons large; reference form sticky-free; summary in `Collapsible` at the bottom.

## Components
- shadcn/ui: `Breadcrumb`, `Badge`, `Card`, `Button`, `Form`, `Input`, `DatePicker`, `Textarea`, `Table`, `Alert`, `AlertDialog` (cancel), `Dialog` (retry method chooser, refund request), `Tooltip`, `Collapsible`, `Skeleton`
- custom: `OrderTimeline`, `UpiQrPanel`, `BankDetailsPanel`, `CopyField`, `ReferenceForm`, `RichText`.

## Content & copy notes
- Amounts always in charge currency with display estimate.
- UPI panel explains that the QR encodes the exact amount and order number.
- Bank panel warns "Transfers can take up to 1 working day to reach us." Reference help: "The UTR or transaction ID from your UPI app or bank statement." Refund copy references the legal page and product refundability: "This product is refundable within our policy" / "This product is non-refundable; you can still ask and we'll review." No public email/phone (D-808).

## Interactions
- Load → `getMyOrder` (API-COM-05) + `getPaymentInstructions` (API-PAY-01).
- Submit reference → `submitPaymentReference` (API-PAY-02) → stage switches to Submitted; toast "Reference submitted — we'll confirm soon".
- Edit reference → same action (allowed once per 10 min).
- Cancel → `AlertDialog` → `cancelMyOrder` (API-COM-03) (only while Initiated).
- Retry → `retryPayment` (API-COM-04) → new payment instructions.
- Polling every 30 s while pending (focus refetch) so confirmation appears without reload; confirmation triggers a success banner and confetti-free check animation.
- Open query → `createQuery` (API-CHAT-01, `source='order'`, `order_id`) → thread. Request refund → the same action with `refundRequest=true`; at most one open refund query per order — if one exists the response carries `existing=true` and the page navigates to that thread instead.

## States
- **Default:** per status.
- **Loading:** header + panel skeleton; QR placeholder box.
- **Empty:** n/a.
- **Error:** `ORDER_EXPIRED` on submit → refresh to Expired stage; `STATE_INVALID` messages; QR generation failure → show VPA + amount text with "Pay manually" copy.
- **Success:** stage transitions with toasts.
- **Permission-denied:** not owner → 404.

## Responsive behaviour
xs stacked, vertical timeline, `upi://` button shown only on touch devices; md 7/5; lg+ same; tv larger QR (360 px) and 56 px buttons.

## Accessibility
- Timeline is an ordered list with `aria-current="step"`; QR image alt "UPI QR code for ₹11,800 to CodeKraft, order CK-ORD-000012" and the VPA/amount are also text; copy buttons announce "Copied"; countdown is text with absolute deadline; reference form errors linked; polling updates announced via live region ("Payment confirmed").

## Motion
- Stage cross-fade 200 ms; timeline step fill 300 ms; check icon draw on confirmation. **Reduced motion:** instant.

## Navigation
→ `/account/purchases/[entitlementId]`, `/account/invoices`, `/account/queries/[id]`, `/products/[slug]`, `/legal/refunds`.

## Data dependencies
Tables: `T-orders`, `T-order_items`, `T-payments`, `T-invoices`, `credit_notes`, `T-refunds`, `T-entitlements`, `T-offerings` (instructions), `T-products` (`is_refundable`), `T-site_settings` (UPI VPA, bank details), `T-queries` (write), `T-notifications`, `T-analytics_events`.
Queries: `getMyOrder` (API-COM-05), `getPaymentInstructions` (API-PAY-01), `getInvoicePdfUrl` (API-COM-12). Actions: `submitPaymentReference` (API-PAY-02), `cancelMyOrder` (API-COM-03), `retryPayment` (API-COM-04), `createQuery` (API-CHAT-01).

## Requirement IDs
D-501, D-411, D-412, D-414, D-415, D-416, D-505, D-516, A-601, BR-09, BR-10, BR-16, D-808, D-1002, D-1302, MASTER_SPEC §7 "Refund request channel".

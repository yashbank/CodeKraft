# SCR-ADM-08 — Manual / project order creation

**Route:** `admin.<domain>/orders/new?type=product|project&customer=` · **Render:** Client · **App:** Admin

## Purpose
Create orders that did not come through checkout: client project invoices (type PROJECT with free-form line items, D-510, A-502) and offline product sales (type PRODUCT with offerings), optionally recording the payment already received so the order is confirmed, invoiced and posted to the ledger in one step (D-1107). Same numbering and ledger as online orders. Project orders have no product ownership: every project line carries a `split_snapshot` (company cut + partner shares) set here by the creating admin, and the order cannot be invoiced or paid until the other admins approve it (`approval_requests.type = project_order.split`, MASTER_SPEC §7 "Project order splits", BR-05).

## User/role
Admin, Super Admin (`orders.manual.write`).

## Entry points
"Create › Manual order", orders list "New manual order", customer detail "Create order", lead detail "Convert to project order" (prefills client details and links `won_order_id`).

## Layout
- **Desktop:** h1 "New manual order".
- Stepper-less single form in two columns: left (8/12) sections, right (4/12) live summary.
- Sections:
1. **Type** `RadioGroup`: "Product order (offline sale)" / "Project order (client invoice)".
2. **Customer**: for product orders a `Combobox` of registered customers (search by email; required — entitlements need an account) with "Invite customer" link; for project orders either pick a customer or enter Client name*, Client email*, Company, billing address, country*, GST number.
3. **Items**: product order — rows of Offering `Combobox` (product · offering, shows base price; one-time duplicates warned), quantity 1; project order — rows of Description*, Quantity, Unit amount*, and a **Split** cell per line (`SplitEditor`: company cut % + partner rows with %; live sum must equal 100%; "Copy from product" `Combobox` prefills from that product's active ownership; default 100% company) stored as `order_items.split_snapshot`; "Add line"; "Apply this split to all lines".
4. **Pricing**: currency (base, read-only at release 1), discount amount, "Apply tax" `Switch` (respects GSTIN rule; shows effective rate or "No GSTIN configured — tax will be 0"), notes to appear on invoice.
5. **Payment** (optional `Collapsible` "Record payment now", **product orders only**): Method (Bank transfer / UPI), Amount received*, Reference*, Paid on*; shortfall or customer-credit preview (overpayment is accepted and recorded as `customer_credit_minor`). If left empty the order is created Pending payment and instructions are emailed to the customer. For project orders this section is replaced by the note "Payment can be recorded on the order page once the split is approved".
- Right summary: line totals, discount, tax, total; ledger preview (product lines: company cut and partner split from the active ownership; project lines: from each line's `split_snapshot`) — Super Admin only; approver list for the split request. Primary: "Create order" (product) / "Create & request split approval" (project); "Create & confirm" only for product orders with payment filled.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Form`, `RadioGroup`, `Combobox`, `Input`, `Textarea`, `Switch`, `Collapsible`, `DatePicker`, `Table`, `Card`, `Button`, `Alert`, `Tooltip`
- custom: `LineItemsEditor`, `MoneyInput`, `LedgerPreview`, `CustomerPicker`.

## Content & copy notes
- Explains the effect: "Project revenue is posted to the same ledger using each line's approved split snapshot; the other admin(s) must approve the split before this order can be invoiced or paid" (A-502, BR-05).
- Warning when creating a product order for a one-time offering the customer already owns (BR-10).
- Invoice note: "Invoice CK/2026-27/nnnn will be issued when the payment is confirmed" (project orders: "…after the split is approved and the payment is confirmed").

## Interactions
- Customer search → `listCustomers` (API-ADM-06). Offerings → `listProductsAdmin`.
- Create → `createManualOrder` (API-COM-07); product orders with payment → confirmed in one transaction (runs API-PAY-03 internally) → redirect to SCR-ADM-07 with toast including invoice number. Project orders → order created `pending_payment` plus `approval_requests(type='project_order.split', payload:{orderId})` (`approvalRequestId` returned) → redirect to SCR-ADM-07 with the split banner and toast "Split approval requested from <admin>"; on approval `applyProjectOrderSplit` (API-COM-14) freezes the snapshots and unlocks payment confirmation (API-PAY-03) and `issueInvoice` (API-COM-11).
- Lead conversion: `?lead=` prefills and on success `updateLeadStatus('won', wonOrderId)` (API-LEAD-05).

## States
- **Default:** empty form, type preselected from param.
- **Loading:** button spinner; summary recalculates client-side.
- **Empty:** no customers found → "Invite" link.
- **Error:** validation (project lines need description and a split summing to 100%; product lines need offering); `DUPLICATE_PURCHASE`.
- **Success:** redirect to order detail.
- **Permission-denied:** missing permission → 403 page.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ 8/4; tv 8/4.

## Accessibility
- Line editor rows are a table with labelled inputs per cell; add/remove buttons labelled with row index; summary totals in live region (debounced); money inputs with currency prefix in label.

## Motion
- Row add/remove 150 ms. **Reduced motion:** none.

## Navigation
→ `/orders/[id]`, `/customers/[id]`, `/leads/[id]`.

## Data dependencies
Tables: `T-orders`, `T-order_items` (`split_snapshot`), `T-payments`, `T-invoices`, `T-ledger_entries`, `T-allocations`, `T-entitlements`, `T-users`, `T-customer_profiles`, `T-offerings`, `T-offering_prices`, `T-products`, `T-product_ownerships`/`T-product_ownership_lines` (copy-from-product), `T-partners`, `T-approval_requests` (`project_order.split`), `T-site_settings` (tax, GSTIN, base currency), `T-leads`, `T-notifications`.
Queries: `listCustomers` (API-ADM-06), `listProductsAdmin` (API-CAT-18), `listPartners` (API-ADM-12), `getSettings` (API-ADM-10). Actions: `createManualOrder` (API-COM-07, project lines carry `splitSnapshot`; raises the `project_order.split` request), `applyProjectOrderSplit` (API-COM-14, internal on approval), `updateLeadStatus` (API-LEAD-05).

## Requirement IDs
D-510, D-1107, A-502, D-1108, D-401, D-414, D-516, BR-05, BR-06, BR-08, BR-10, BR-13, BR-16, D-703, MASTER_SPEC §7 "Project order splits".

# SCR-ACC-04 — Invoices & payments

**Route:** `/account/invoices?tab=invoices|payments` · **Render:** Client · **App:** Account

## Purpose
Give the customer every financial document and payment attempt: invoices (PDF, numbered per financial year), credit notes from refunds, and a payment history that includes UPI/bank payments still awaiting their reference or awaiting admin confirmation (D-414, D-1001).

## User/role
Customer.

## Entry points
Sidebar "Invoices & payments", overview "Recent invoices", order status page "View invoice", emails with invoice attached, chatbot "Invoices" menu.

## Layout
- **Desktop:** h1 "Invoices & payments".
- `Tabs`: **Invoices** (default) · **Payments**.
- Invoices tab: `DataTable` columns: Invoice no (CK/2026-27/0001), Date, Order, Description (product · offering / project line), Amount (charge currency + display-currency equivalent in muted text), Tax (or "—"), Status (Paid / Refunded / Partially refunded), actions: "PDF" (download), "View order". Credit notes appear as rows with type chip "Credit note" and negative amount, linked to their invoice. Year filter `Select` (financial years).
- Payments tab: table of `payments`: Date, Order, Method (UPI / Bank transfer), Amount due, Reference (customer's UTR or "—"), Status badge (Initiated / Submitted — awaiting confirmation / Confirmed / Failed / Refunded), action: for Initiated → "Submit reference" (opens SCR-ACC-11 section); for Submitted → "Edit reference"; Failed → "Retry" (only while the order is still `pending_payment`; an expired order is `failed` and offers "Buy again"); Confirmed → "Invoice".
- Info `Alert` above Payments when any payment is Submitted: "We confirm UPI and bank transfers manually, usually within 1 working day. You'll get an email when it's done."
- **Phone:** tables become cards: invoice number as title, amount right, date and status under, actions row.

## Components
- shadcn/ui: `Tabs`, `DataTable`, `Select`, `Badge`, `Button`, `Alert`, `Skeleton`, `Pagination`, `Tooltip` (converted amounts)
- custom: `MoneyCell`, `InvoiceRowCard`.

## Content & copy notes
- Amounts show the charge currency (INR at release 1) first; display-currency equivalents are marked "≈".
- GST breakdown appears only when the invoice has `gst_breakdown` (D-1501).
- Credit note copy: "Credit note CN/2026-27/0003 for invoice CK/2026-27/0001".
- Empty copy: "No invoices yet".

## Interactions
- PDF → `getInvoicePdfUrl` (API-COM-12) → opens signed 5-min URL in a new tab.
- Payment row actions deep-link to SCR-ACC-11 (`#payment`).
- Year filter and pagination server-side.

## States
- **Default:** newest first.
- **Loading:** 6 skeleton rows.
- **Empty:** per tab.
- **Error:** `Alert` + retry; PDF generation failure "Invoice PDF is being regenerated — try again in a minute".
- **Success:** n/a (download opens).
- **Permission-denied:** own rows only.

## Responsive behaviour
xs cards; md compact table (hide Tax, Description); lg+ full; tv larger row height.

## Accessibility
- Tables with captions ("Your invoices"); status badges with text; PDF link labelled "Download invoice CK/2026-27/0001 as PDF (opens in new tab)"; money cells with `aria-label` including currency.

## Motion
- Tab cross-fade 150 ms. **Reduced motion:** none.

## Navigation
→ `/account/orders/[id]`, invoice PDF, `/account/purchases/[id]`.

## Data dependencies
Tables: `T-invoices`, `credit_notes`, `T-payments`, `T-orders`, `T-order_items`, `T-refunds`, `T-media` (PDF), `T-fx_rates`.
Queries: `listMyInvoices` (API-COM-13), `getPaymentHistory` (API-DASH-02). Actions: `getInvoicePdfUrl` (API-COM-12).

## Requirement IDs
D-414, D-401, D-1501, D-1001, D-501, D-411, D-416, BR-16, BR-09, D-502.

# SCR-ADM-09 — Custom quotes

**Route:** `admin.<domain>/quotes?status=` and `/quotes/[id]` · **Render:** Client · **App:** Admin

## Purpose
Create, send and track private negotiated offers for a specific customer (D-520): title, description, amount, expiry, optional linked offering (for delivery configuration). The customer pays through the tokenised pay page (SCR-ACC-12) using the manual methods.

## User/role
Admin, Super Admin (`orders.manual.write`).

## Entry points
Sidebar "Quotes", "Create › Quote", customer detail "New quote", lead detail "Send quote", product editor offering of type custom_quote ("Quotes for this offering").

## Layout
- **List (desktop):** h1 "Custom quotes", status chips (Draft, Sent, Accepted, Paid, Expired, Cancelled), search, "New quote".
- `DataTable`: Title, Customer, Linked product/offering, Amount, Expires, Status, Sent on, Order (link once accepted), ⋯: Open, Send, Copy pay link, Cancel, Duplicate.
- **Detail/editor:** two columns: left form — Customer* (`Combobox` registered customers), Linked offering (optional `Combobox`, filters to `custom_quote` or any offering; determines delivery type), Title*, Description (rich text, what's included), Amount* (base currency), Tax applies (`Switch`, GSTIN rule), Expires on* (default +14 days), Internal note.
- Right: status card with timeline (created, sent, viewed if tracked, accepted, paid, expired), pay link with Copy, "Send to customer" primary (Draft), "Resend" (Sent), "Cancel quote" (destructive), preview of the customer email.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `DataTable`, `Combobox`, `Form`, `Input`, `Textarea`/Tiptap, `Switch`, `DatePicker`, `Card`, `Badge`, `Button`, `AlertDialog`, `Tooltip`
- custom: `MoneyInput`, `QuoteTimeline`, `CopyField`.

## Content & copy notes
- Amount is tax-exclusive; summary shows tax line if applicable.
- Send confirmation: "Email the quote to <email>? The pay link expires on <date>." Cancel copy warns the link stops working.
- Coupons not applicable.

## Interactions
- Save → `createCustomQuote` (API-COM-09) (draft); Send → `sendCustomQuote` (email + in-app notification); Cancel → `cancelCustomQuote`.
- Copy pay link → clipboard (`/quote/<token>`, MASTER_SPEC §7; the link requires login, opens read-only for any other customer and can be accepted only by the invited customer, docs/06 API-COM-10).
- Accepted quotes link to the order; paid quotes show invoice.

## States
- **Default:** list Sent first.
- **Loading:** skeletons.
- **Empty:** "No quotes yet".
- **Error:** validation (amount > 0, expiry future, customer required); `STATE_INVALID` on send of cancelled.
- **Success:** toasts "Quote sent to <email>".
- **Permission-denied:** 403.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ two-column editor; tv wider.

## Accessibility
- Form labels; timeline list; copy link announces; status chips toggle buttons.

## Motion
- None beyond standard.
- Reduced motion: none.

## Navigation
→ `/quotes/[id]`, `/customers/[id]`, `/orders/[id]`, `/products/[id]`.

## Data dependencies
Tables: `T-custom_quotes`, `T-users`, `T-customer_profiles`, `T-offerings`, `T-products`, `T-orders`, `T-site_settings`, `email_outbox`, `T-notifications`, `T-audit_logs`.
Queries: `listCustomers` (API-ADM-06), `listProductsAdmin` (API-CAT-18). Actions: `createCustomQuote`/`sendCustomQuote`/`cancelCustomQuote` (API-COM-09).

## Requirement IDs
D-520, R-302, D-501, D-1107, BR-08, D-1002.

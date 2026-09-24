# SCR-ADM-32 — Coupons

**Route:** `admin.<domain>/coupons?status=` · **Render:** Client · **App:** Admin

## Purpose
Create and manage coupon codes applied at checkout (D-409, A-401): percentage or fixed amount, validity window, usage limit, product restriction, first-purchase-only. Shows redemption counts and the orders that used each code.

## User/role
Admin, Super Admin (`orders.manual.write`).

## Entry points
Sidebar "Catalog › Coupons", "Create › Coupon", order detail coupon chip.

## Layout
- **Desktop:** h1 "Coupons", status chips (Active, Scheduled, Expired, Exhausted, Inactive), search, "New coupon".
- `DataTable`: Code (monospace, copy), Type & value (10% / ₹500), Valid (from – to), Redemptions (used / max), Restrictions (product chips, "First purchase"), Status, Created by, ⋯: Edit, Deactivate/Activate, Duplicate, View orders.
- Editor `Sheet`: Code* (uppercase, 4–20, uniqueness check, "Generate"), Kind `RadioGroup` (Percentage / Fixed amount) + Value* (+ currency for fixed = base), Starts at / Ends at (`DatePicker`s), Max redemptions (blank = unlimited), First purchase only `Switch`, Restrict to products (`MultiSelect`, blank = all), Active `Switch`, internal note.
- Preview line: "10% off any product, until 31 Oct, max 50 uses".
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `DataTable`, `Sheet`, `Form`, `Input`, `RadioGroup`, `DatePicker`, `Switch`, `Combobox`/`MultiSelect`, `Badge`, `Button`, `DropdownMenu`, `Skeleton`
- custom: `MoneyInput`, `CouponPreview`.

## Content & copy notes
- Codes are case-insensitive (stored citext) — note shown.
- Deactivate copy: "Customers can no longer apply this code; orders already using it are unaffected." Redemptions count only on Paid (docs/06 API-COM-02).

## Interactions
- `upsertCoupon`, `deactivateCoupon`, `listCoupons` (API-COM-08).
- View orders → orders list filtered by coupon.

## States
- **Default:** active first.
- **Loading:** skeleton.
- **Empty:** "No coupons — create one for launch".
- **Error:** code conflict; value validation (percent ≤ 100; fixed > 0).
- **Success:** toasts.
- **Permission-denied:** read-only.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg–tv full table; sheet 640 px (760 px at tv).

## Accessibility
- Code copy button announces; date pickers keyboard operable; preview line in live region.

## Motion
- Standard.
- Reduced motion: none.

## Navigation
→ `/orders?coupon=`, `/products/[id]`.

## Data dependencies
Tables: `T-coupons`, `coupon_redemptions`, `T-products`, `T-orders`, `T-audit_logs`.
Queries/actions: `listCoupons`/`upsertCoupon`/`deactivateCoupon` (API-COM-08), `listProductsAdmin` (API-CAT-18).

## Requirement IDs
D-409, A-401, D-408, D-1104.

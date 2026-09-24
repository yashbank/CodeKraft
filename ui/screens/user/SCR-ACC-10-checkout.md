# SCR-ACC-10 — Checkout (single offering)

**Route:** `/checkout/[offeringId]?coupon=&renewal=<subscriptionId>` (in the `(account)` route group, MASTER_SPEC §7 "Auth and checkout URLs") · **Render:** Client · **App:** Account · **Requires:** Customer with verified email (D-1201)

## Purpose
Turn one chosen offering into an order in three steps on one page: (1) billing details, (2) coupon and totals, (3) payment method (UPI QR or bank transfer — whichever the offering enables, D-110, D-501). Creates the order in Pending Payment and hands over to the order status page where the customer pays and submits the transaction reference. No cart (ADR-12). Also used for subscription renewals (`renewal=`) and never for custom quotes (SCR-ACC-12).

## User/role
Customer (verified). Unverified → verify interstitial. Visitor → login redirect.

## Entry points
Product page "Buy now" (offering preselected), wishlist "Buy now" (via product page), entitlement "Renew now" (renewal mode), overview "Renew" action.

## Layout
- **Desktop:** Minimal account shell (sidebar collapsed, top bar with "Back to product"). h1 "Checkout".
- Two columns: left (7/12) stepper form; right (5/12) sticky **Order summary** card.
- Left steps (accordion-style, all visible, current expanded):
1. **Billing details** — Full name*, Email* (read-only, from account), Country* (`Combobox`), Company, Billing address (collapsed "Add address" → fields), GST number (shown when country = IN, optional, D-410). "Save to my profile" `Checkbox` (default on).
2. **Review & discounts** — Coupon `Input` + "Apply" (removable chip when applied, shows "−₹500 (SAVE10)"); line items table: offering name, unit price, discount, tax ("GST 18%" or "No tax"), total; note on charge currency.
3. **Payment method** — `RadioGroup` cards for each enabled method: "UPI" (icon, "Scan a QR with any UPI app — instant") and "Bank transfer" (icon, "NEFT/IMPS/RTGS — up to 1 working day"). Consent `Checkbox`* "I agree to the Terms of service, Refund & cancellation policy and Product license terms" (links). Primary "Place order" (label shows total: "Place order · ₹11,800").
- Right summary: product cover + name, offering name, purchase model line ("Monthly subscription · renews every month", "One-time · lifetime access"), delivery type, price breakdown (subtotal, discount, tax, total in INR bold; "≈ $141.60" display-currency estimate), and a "What happens next" mini-timeline: Place order → Pay via UPI/bank → Submit reference → We confirm (usually < 1 working day) → Access unlocked.
- **Phone:** single column; summary collapsed into a top `Collapsible` "Order summary · ₹11,800"; sticky bottom "Place order" button.

## Components
- shadcn/ui: `Form`, `Input`, `Combobox`, `Checkbox`, `RadioGroup`, `Accordion`/`Collapsible`, `Card`, `Badge`, `Button`, `Alert`, `Table`, `Tooltip`, `Dialog` (blocking submit progress), `Skeleton`
- custom: `Stepper`, `OrderSummary`, `CouponField`, `PaymentMethodCard`, `NextStepsTimeline`.

## Content & copy notes
- Tax copy: "No tax" when rate 0 (no GSTIN configured or product not tax-enabled), else "GST 18% · ₹1,800".
- Duplicate purchase: page replaced by `Alert` "You already own this — Open in dashboard" (BR-10).
- Coming soon / inactive / custom-quote offering: "This offering can't be purchased right now" with links.
- Expiry note: "Unpaid orders are cancelled automatically after 7 days" (BR-10).
- Renewal mode header: "Renew FitDesk Pro · Monthly" with period preview "New period: 3 Oct – 2 Nov 2026".
- Currency note: "You'll be charged in INR. Other currencies are shown as estimates" (D-502).

## Interactions
- Mount → `previewCheckout` (API-COM-01) with `coupon` param; warnings shown in summary.
- Coupon apply → re-run preview; invalid → inline error ("This code has expired" / "First purchase only" / "Not valid for this product").
- Country change toggles GST field and tax note (tax rule server-side; UI only re-previews).
- Place order → blocking `Dialog` "Creating your order…" → `createOrder` (API-COM-02) or `renewSubscription` (API-DEL-04) → navigate to `/account/orders/[orderId]#pay` (SCR-ACC-11) which shows the QR/bank details. Analytics `checkout_start`.
- Idempotent: double-click safe; back navigation after order creation returns to order page not checkout.

## States
- **Default:** steps with billing prefilled from profile.
- **Loading:** summary skeleton while previewing; button spinner; blocking dialog on submit.
- **Empty:** n/a.
- **Error:** validation inline; `DUPLICATE_PURCHASE`, `STATE_INVALID` (method disabled, offering inactive) as page-level `Alert`; `EMAIL_UNVERIFIED` interstitial; `RATE_LIMITED`; network error keeps form.
- **Success:** redirect to order status page with toast "Order CK-ORD-000012 created — pay to continue".
- **Permission-denied:** visitor → login; suspended → sign-out.

## Responsive behaviour
xs stacked + sticky CTA + collapsible summary; md two columns 7/5; lg+ same with sticky summary; tv max 1320 px, 56 px controls.

## Accessibility
- Stepper sections are `<section>` with `h2`; required marks; coupon result announced; payment radio cards have full names ("Pay by UPI QR code"); consent checkbox error announced; blocking dialog has `aria-busy` and status text; summary totals in a table with headers.

## Motion
- Step expand/collapse 200 ms; summary total count-up on coupon (none under reduced motion); dialog fade.

## Navigation
→ `/account/orders/[id]` (success), `/products/[slug]` (back), `/legal/*`, `/account/purchases/[id]` (duplicate), `/auth/verify` (unverified).

## Data dependencies
Tables: `T-offerings`, `T-offering_prices`, `T-offering_payment_methods`, `T-products`, `T-coupons`/`coupon_redemptions`, `T-customer_profiles`, `T-users`, `T-orders`, `T-order_items`, `T-payments`, `T-subscriptions` (renewal), `T-site_settings` (base currency, tax, GSTIN, UPI/bank), `T-fx_rates`, `T-analytics_events`, `email_outbox`, `T-notifications`.
Queries: `previewCheckout` (API-COM-01), `getMe` (API-AUTH-02). Actions: `createOrder` (API-COM-02), `renewSubscription` (API-DEL-04), `updateProfile` (API-AUTH-03, when "save to profile").

## Requirement IDs
D-204, D-410, D-412, D-413, D-501, D-502, D-504, D-519, D-110, D-409, A-401, D-1201, D-521, D-1004, BR-03, BR-08, BR-10, BR-14, ADR-12, X-001, D-1302.

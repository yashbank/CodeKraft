# SCR-ACC-12 — Custom quote pay page

**Route:** `/quote/[token]` (MASTER_SPEC §7 "Auth and checkout URLs") · **Render:** Client (SSR shell) · **App:** Account (minimal shell)

## Purpose
Let a specific customer view and accept a private, negotiated offer created by an admin (D-520) and pay it through the same manual UPI/bank flow. Quotes are private (tokenised), time-limited, and not discoverable in the catalog.

## User/role
Any signed-in customer holding the token can **read** the quote (signed-out visitors are redirected to login with `returnTo`, BR-03); **accepting** requires the session user to equal `custom_quotes.customer_id` with a verified email — otherwise the page is read-only with a "sign in as the invited customer" prompt (MASTER_SPEC §7 "Custom quote pay link", docs/06 API-COM-10 `canAccept`).

## Entry points
Email "Your quote from CodeKraft" pay link, notification "Quote sent", admin-shared link, overview action card "Quote awaiting your response".

## Layout
- **Desktop:** Minimal account shell.
- Card (max 720 px) centred: eyebrow "Private quote", h1 quote title, "Prepared for <name> · valid until <date>" with countdown chip, description rich text, optional linked product/offering summary (cover, name, delivery type), amount block (INR bold + display estimate), "What's included" from description, payment method `RadioGroup` (enabled methods from the linked offering or platform defaults), billing details section (prefilled; same fields as checkout, collapsed if complete), consent checkbox, primary "Accept & pay ₹X", secondary "Ask a question" (opens query prefilled with quote title).
- Status banner variants at top: Sent (default), Accepted (link to order), Paid (link to purchase), Expired, Cancelled.
- **Read-only variant** (`canAccept=false`): signed in as a different user → billing/payment sections hidden, prompt "This quote was prepared for another customer — sign in as the invited customer" with a "Switch account" link (`/auth/login?returnTo=/quote/<token>`); no accept button.
- **Phone:** card full width; sticky bottom "Accept & pay".

## Components
- shadcn/ui: `Card`, `Badge`, `Button`, `RadioGroup`, `Form`, `Input`, `Combobox`, `Checkbox`, `Alert`, `Collapsible`, `Skeleton`
- custom: `QuoteHeader`, `PaymentMethodCard`, `RichText`.

## Content & copy notes
- "Quotes are private to you and expire on <date>." Coupons are not applicable (note absent, just no field).
- Tax line shown as in checkout.
- Expired: "This quote has expired — ask us for a refreshed one" with "Open a query".
- Unknown or malformed token: 404. Wrong customer: read-only view with the sign-in prompt (the token is the secret; no other hint).

## Interactions
- Load → `getQuote` (API-COM-10) by token; the response carries `canAccept` (session user = invited customer). Lookups are rate-limited (`quote_lookup`, docs/06 §1.7).
- Accept → `acceptCustomQuote` (API-COM-10 with method + billing) → creates order → redirect to SCR-ACC-11 `#pay`.
- Already accepted → banner links to the order.
- Ask a question → `createQuery` with `source='dashboard'`, subject "Quote: <title>".

## States
- **Default:** Sent quote.
- **Loading:** card skeleton.
- **Empty:** n/a.
- **Error:** `ORDER_EXPIRED` → Expired banner; `STATE_INVALID` (cancelled/paid) banners; `NOT_FOUND` → 404; `FORBIDDEN` → read-only prompt.
- **Success:** redirect with toast "Order created from your quote".
- **Permission-denied:** signed-out → `/auth/login?returnTo=/quote/<token>`; wrong customer → read-only + sign-in prompt (`FORBIDDEN` on accept); unverified → verify interstitial on accept.

## Responsive behaviour
Centred card; tv larger type and buttons.

## Accessibility
- Countdown as text with absolute date; radios labelled; consent error announced; banner `role="status"`.

## Motion
- Card fade-in 200 ms. **Reduced motion:** none.

## Navigation
→ `/account/orders/[id]`, `/account/purchases/[id]`, `/account/queries/[id]`, `/products/[slug]`, `/auth/login?returnTo=`.

## Data dependencies
Tables: `T-custom_quotes`, `T-offerings`, `T-offering_payment_methods`, `T-products`, `T-customer_profiles`, `T-orders`, `T-payments`, `T-site_settings`, `T-queries` (write).
Queries: `getQuote` (API-COM-10). Actions: `acceptCustomQuote` (API-COM-10), `createQuery` (API-CHAT-01).

## Requirement IDs
D-520, R-302, D-501, D-410, D-1201, BR-03, D-808.

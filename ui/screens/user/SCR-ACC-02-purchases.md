# SCR-ACC-02 — Purchases & access (list)

**Route:** `/account/purchases?status=&type=` · **Render:** Client · **App:** Account

## Purpose
List every entitlement the customer holds (one per purchased offering per order), with its delivery type, status, access period and the single most useful action, plus the orders that are not yet entitlements (pending payment, failed, cancelled). This is where "what did I buy and how do I use it" is answered (D-1001, A-602).

## User/role
Customer.

## Entry points
Sidebar/tab "Purchases", overview "View all purchases", email "Access your purchase", product page "Open in dashboard".

## Layout
- **Desktop:** h1 "Purchases & access".
- `Tabs`: **Active** (default) · **Pending & past orders** · **Expired & revoked**.
- Toolbar: search by product name, filter chips by delivery type (Download, License, Hosted, Product + service, Custom, Subscription).
- Active tab: list of `EntitlementRow` cards (cover thumbnail 64 px, product name + offering name, delivery type icon + label, status `Badge`, access line "Lifetime" / "Until 12 Mar 2027" / "Renews 3 Oct · monthly", secondary line specific to type: "3 of 5 downloads left" / "Key available" / "Being set up — we'll notify you" (SaaS with manual provisioning is `active` with `provisioning_state = pending`, MASTER_SPEC §7 "Order fulfilled") / "Step 2 of 4 complete" / "Next renewal ₹999", primary action button, "Details" link).
- Pending & past orders tab: `OrderRow`s (order no, date, product/offering, total, status badge, action "Pay now"/"Submit reference"/"Retry payment"/"View").
- Expired & revoked: rows with "Renew" (subscriptions) or "Buy again" (fixed-term one-time where allowed by update policy) or "Contact support" (revoked).
- **Phone:** tabs become a segmented control; rows stack into cards; actions full-width at card bottom.

## Components
- shadcn/ui: `Tabs`, `Input` (search), `ToggleGroup` chips, `Card`, `Badge`, `Button`, `Progress`, `Skeleton`, `Pagination`
- custom: `EntitlementRow`, `OrderRow`, `DeliveryTypeIcon`.

## Content & copy notes
- Delivery labels: "Download", "License key", "Hosted account", "SaaS account", "Product + service", "Custom delivery".
- Subscription status copy: "Active · renews 3 Oct", "Past due · grace until 10 Oct", "Suspended · pay to restore access", "Cancelled · access until 3 Oct".
- Download cap copy: "N of M downloads left" and when 0: "Download limit reached — ask us to reset it".
- Never show partner/ownership (BR-02).

## Interactions
- Row primary action: Download (opens `Sheet` listing release files → SCR-ACC-03 behaviour), Reveal key (dialog), View instructions, View progress, Manage subscription — all deep-link to SCR-ACC-03 sections except quick Download/Reveal which run inline.
- Order rows → SCR-ACC-11.
- Search filters client-side (small list); tabs update URL.

## States
- **Default:** active entitlements newest first.
- **Loading:** 5 skeleton rows.
- **Empty:** Active tab: "No purchases yet — Explore products"; Pending tab: "No open orders"; Expired: "Nothing here".
- **Error:** `Alert` + retry.
- **Success:** inline toasts for download/key actions.
- **Permission-denied:** n/a (own rows only).

## Responsive behaviour
xs cards; md two-line rows; lg+ full rows with right-aligned actions; tv larger thumbnails and 56 px buttons.

## Accessibility
- List as `<ul>`; each card has a heading (product name) as `h2`; status badges include text; progress bars have `aria-valuenow` and text; tab panels labelled; row action names include product ("Download Resume Website").

## Motion
- Tab content cross-fade 150 ms; card hover lift. **Reduced motion:** none.

## Navigation
→ `/account/purchases/[id]`, `/account/orders/[id]`, `/checkout/[offeringId]?renewal=`, `/products/[slug]`, `/account/queries?new=1&entitlement=`.

## Data dependencies
Tables: `T-entitlements`, `T-subscriptions`, `T-service_progress`, `T-release_files`, `T-orders`, `T-order_items`, `T-payments`, `T-offerings`, `T-products`, `T-media`.
Queries: `listMyEntitlements` (API-DEL-01), `listMyOrders` (API-COM-05). Actions: `issueDownloadLink` (API-DEL-02), `revealLicenseKey` (API-DEL-03).

## Requirement IDs
D-1001, A-602, D-602, D-603, D-605, D-606, D-608, D-521, D-411, D-416, BR-02, BR-14, BR-15.

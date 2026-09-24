# SCR-ACC-01 — Account overview

**Route:** `/account` · **Render:** Client (SSR shell) · **App:** Account

## Purpose
The customer's home: what they own, what needs their action (pending payments, renewals due, unverified email), and what's new (admin replies, notifications). One glance answers "is everything OK?" (D-1001).

## User/role
Customer.

## Entry points
Post-login redirect, avatar menu "Dashboard", sidebar/tab "Overview", email links ("View your order"), wordmark inside the account shell.

## Layout
- **Desktop:** Account shell (sidebar + top bar).
- Content: greeting h1 "Hi, <first name>" with email-verification `Alert` if unverified ("Verify your email to buy products" + Resend). **Action strip** (only when non-empty): cards for each pending item — "Order CK-ORD-000012 awaiting your payment · expires in 5 days → Pay now", "Renewal due 3 Oct for FitDesk Pro → Renew", "Reply from CodeKraft on 'Install issue' → Open".
- Then a 2-column grid: left "Your products" (up to 5 `EntitlementCard`s: product cover, name, offering, status badge, primary action per delivery type — Download / Reveal key / Open instructions / View progress / Manage subscription; "View all purchases" link); right column stack: "Recent invoices" (3 rows: number, date, amount, PDF icon), "Open queries" (3 rows), "Wishlist" count with link, "Ask the assistant" card → chat.
- **Phone:** single column in order: verification alert, action strip (horizontal snap cards), products list (compact rows), invoices, queries, assistant card.
- Bottom tab bar visible.

## Components
- shadcn/ui: `Alert`, `Card`, `Badge`, `Button`, `Skeleton`, `Progress` (service checklist mini), `Avatar`
- custom: `EntitlementCard`, `ActionCard`, `InvoiceRow`, `QueryRow`.

## Content & copy notes
- Status copy for entitlements: "Active", "Active until 12 Mar 2027", "Suspended — payment overdue", "Expired", "Access revoked", "Being set up" (pending provisioning).
- Countdown copy for pending orders uses days then hours.
- Empty products copy: "You don't own anything yet — Explore products".
- Never mention partners (BR-02).

## Interactions
- Action cards navigate to the relevant screen; "Pay now" → `/account/orders/[id]`; "Renew" → `/checkout/[offeringId]?renewal=<subscriptionId>`.
- Entitlement primary actions perform the same actions as SCR-ACC-03 (download issues a link inline; reveal key opens the key dialog).
- Notifications badge in shell polls every 30 s (API-NOTIF-02).

## States
- **Default:** populated overview.
- **Loading:** skeleton greeting, 3 skeleton cards, 2 skeleton lists.
- **Empty:** no purchases/orders/queries → hero-style empty card "Welcome to CodeKraft" with "Explore products" and "Ask the assistant" buttons; sidebar unchanged.
- **Error:** `Alert` with retry in the affected region.
- **Success:** toasts from inline actions ("Download started · 4 downloads left").
- **Permission-denied:** suspended account → signed out to login `reason=suspended`.

## Responsive behaviour
xs–md single column with bottom tabs; lg+ sidebar + 2-column grid (7/5); 2xl+ max 1200 px content; tv centred, larger cards.

## Accessibility
- `h1` greeting; regions as `<section aria-labelledby>`; action strip is a list; countdowns rendered as text with absolute date in `title`; skeletons `aria-busy` on container; live region announces new admin replies when polling detects them.

## Motion
- Cards fade-up 200 ms stagger 40 ms on first load; badge pulse once on new notification (no pulse under reduced motion). **Reduced motion:** instant.

## Navigation
→ `/account/purchases`, `/account/purchases/[id]`, `/account/orders/[id]`, `/account/invoices`, `/account/queries/[id]`, `/account/chat`, `/account/wishlist`, `/account/settings`, `/products`, `/auth/verify`.

## Data dependencies
Tables: `T-users`, `T-entitlements`, `T-subscriptions`, `T-orders`, `T-payments`, `T-invoices`, `T-queries`, `T-notifications`, `T-wishlists`, `T-products`/`T-media`.
Queries: `getDashboardOverview` (API-DASH-01), `getMe` (API-AUTH-02), `pollNotifications` (API-NOTIF-02). Actions: `issueDownloadLink` (API-DEL-02), `revealLicenseKey` (API-DEL-03), `sendVerificationEmail`.

## Requirement IDs
D-1001, D-1004, D-521, D-1201, D-1002, BR-02, BR-14, D-412, D-605.

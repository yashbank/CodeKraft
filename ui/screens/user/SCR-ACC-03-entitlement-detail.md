# SCR-ACC-03 — Entitlement detail (per delivery type)

**Route:** `/account/purchases/[entitlementId]` · **Render:** Client · **App:** Account

## Purpose
The delivery surface for one entitlement. The layout is shared; the **delivery panel** changes with `delivery_type` (A-602): downloads with cap, license key reveal, SaaS/hosted credentials and instructions, product-plus-service checklist progress, custom instructions. Subscriptions add renewal and cancellation (BR-14, D-1004).

## User/role
Customer (owner of the entitlement).

## Entry points
Purchases list, overview cards, emails ("Your key is ready", "Your account is set up", "Renewal reminder"), chatbot "Downloads" menu.

## Layout
- **Desktop:** Breadcrumb (Purchases › Product).
- Header card: cover, product name (links to product page if published, else static), offering name, status `Badge`, access line, order number link, invoice link, "Need help? Open a query" link (prefilled with entitlement).
- Two columns: left (8/12) **Delivery panel**, right (4/12) **Details** card (purchased on, access period, update policy sentence, version owned, license type) and, for subscriptions, the **Subscription** card.
- Delivery panels:
- **Download:** list of `release_files` for the product allowed by update policy (`all_free` → all versions; `during_access` → versions released before `access_ends_at`; `major_paid` → same major only), each row: file name, version, size, released date, "Download" button. Counter chip "N of M downloads left" (BR-15) with tooltip; when 0 → button disabled + "Ask us to reset" opens a query prefilled. Changelog accordion.
- **License:** masked key `•••• •••• •••• 4F2A` with "Reveal key" (audit-logged) → shows full key 60 s with "Copy"; "Key not issued yet — we'll notify you" state (the notification and email carry a link back here; the key itself is only ever shown in this dashboard, MASTER_SPEC §7 "License key delivery"); instructions rich text (activation steps from offering `instructions_json`).
- **SaaS / Hosted:** provisioning state: "Being set up" (pending — expected timeframe copy) or "Ready": login URL button "Open <Product>", username, "Credentials sent to your email on <date>" note (credentials are never stored in plain text on this page; provisioning notes may include a username), instructions rich text.
- **Service (product + service):** `Progress` "2 of 4 steps complete", checklist with each step title, description, done date; "Fulfilled" banner when all done; instructions.
- **Custom:** instructions rich text + attachments (signed links) + status.
- Subscription card: interval, current period end, status copy, "Renew now" primary (enabled from 14 days before period end and through grace), "Cancel at period end" secondary (`AlertDialog`), cancelled state shows "Access until <date>" and "Resume" is not offered (no proration, V2).
- **Phone:** header stacks; details card collapses into an `Accordion` under the delivery panel; sticky bottom bar hosts the primary action (Download latest / Reveal key / Open app / Renew).

## Components
- shadcn/ui: `Breadcrumb`, `Card`, `Badge`, `Button`, `Progress`, `Accordion`, `Dialog` (key reveal), `AlertDialog` (cancel), `Tooltip`, `Alert`, `Sheet` (file list on phone), `Skeleton`
- custom: `DeliveryPanel/*` (one per type), `ReleaseFileRow`, `SubscriptionCard`, `RichText`.

## Content & copy notes
- Update policy sentences (D-604): "All future updates are included", "Updates are included until <date>", "Major versions are sold separately".
- Access period (D-605): "Lifetime access" / "Access until <date>".
- Revoked state: "Access revoked on <date>. If you think this is a mistake, open a query." Refund requests: "Refunds are reviewed by our team — request one from your order page." No partner data (BR-02).

## Interactions
- Download → `GET /api/files/download/[entitlementId]/[mediaId]` (API-DEL-02) → 302 to 5-min link; row shows "Preparing…" then counter decrements; `LIMIT_EXCEEDED` → inline error with query link (D-606).
- Reveal key → `revealLicenseKey` (API-DEL-03) → dialog with key, Copy button, auto-hide timer; re-reveal allowed.
- Renew → `renewSubscription` (API-DEL-04) creates/returns renewal order → SCR-ACC-11 with payment instructions (or SCR-ACC-10 in renewal mode to pick method when several are enabled). The renewal order's `expires_at` equals `subscriptions.grace_until`, so the subscription card shows one combined countdown (MASTER_SPEC §7 "Renewal order expiry").
- Cancel → `cancelSubscription` (API-DEL-05) → status "Cancelled · access until <date>".
- Open query → `/account/queries?new=1&entitlement=<id>`.

## States
- **Default:** by type as above.
- **Loading:** header + panel skeleton.
- **Empty:** download list empty ("No files released yet — we'll notify you"); key not issued; provisioning pending.
- **Error:** action errors inline; expired access → panel replaced by "Access ended on <date>" with Renew/Buy again if applicable.
- **Success:** toasts "Download started · 3 left", "Key copied", "Renewal order created", "Subscription will end on <date>".
- **Permission-denied:** not owner → 404; suspended entitlement → banner "Suspended — pay your renewal to restore access" with Renew.

## Responsive behaviour
xs stacked + sticky action bar; md two columns 7/5; lg+ 8/4; tv 8/4 with larger type and 56 px buttons.

## Accessibility
- Key reveal dialog announces "License key revealed" and offers Copy; masked key uses `aria-label="License key hidden"`; checklist is an ordered list with `aria-checked` semantics via check icons + text "Done on"; download buttons include file name in accessible name; countdown/timer not sole indicator.

## Motion
- Progress bar animates to value 400 ms; key reveal fade 150 ms; step completion check draws in. **Reduced motion:** instant.

## Navigation
→ `/account/purchases`, `/account/orders/[id]`, `/account/invoices`, `/checkout/[offeringId]?renewal=`, `/account/queries?new=1`, `/products/[slug]`.

## Data dependencies
Tables: `T-entitlements`, `T-subscriptions`, `T-service_progress`, `T-release_files`, `T-product_versions`, `T-downloads` (write), `T-offerings` (instructions, delivery_config), `T-products`, `T-media`, `T-orders`, `T-invoices`, `T-audit_logs` (key reveal).
Queries: `getMyEntitlement` (API-DEL-01). Actions: `issueDownloadLink` (API-DEL-02), `revealLicenseKey` (API-DEL-03), `renewSubscription` (API-DEL-04), `cancelSubscription` (API-DEL-05), `createQuery` (API-CHAT-01).

## Requirement IDs
A-602, A-601, D-601, D-602, D-603, D-604, D-605, D-606, D-607, D-608, D-1004, D-521, BR-14, BR-15, BR-02, D-313.

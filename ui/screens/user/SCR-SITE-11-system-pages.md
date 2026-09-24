# SCR-SITE-11 — System pages (404, error, 403, offline, maintenance)

**Route:** `not-found.tsx`, `error.tsx`, `global-error.tsx`, `/403` (admin host), offline fallback · **Render:** SSG · **App:** Site, Account, Admin (shared component, shell differs)

## Purpose
Handle every non-happy route consistently: unknown URLs, unpublished/archived products, expired tokens, route render errors, permission denials on the admin host, and network loss. Each page keeps the user oriented and gives one obvious way forward. Never leaks stack traces or internal IDs beyond a Sentry event reference.

## User/role
Visitor, Customer, Admin.

## Entry points
Any broken/expired link, archived product slug, `admin.<domain>` without admin role, server exceptions, service worker offline fallback.

## Layout
- **Desktop:** Centered column (max 560 px) inside the current app shell (site header/footer, account shell, or admin shell when the session is valid).
- Large type status code as decorative glyph, h1 message, one sentence explanation, primary button, secondary link, and for `error.tsx` a small "Reference: <sentry id>" line and "Try again" button.
- Variants:
- **404 site:** h1 "We couldn't find that page" · primary "Go home" · secondary "Browse products" · search input (products).
- **404 product (archived/unpublished):** h1 "This product is no longer available" · primary "Browse products"; if the signed-in customer owns it: "It's still in your purchases → Open".
- **410 quote expired / token invalid (verify/reset):** rendered by the owning screen, styled identically.
- **403 admin:** h1 "You don't have access to the admin app" · primary "Sign out" · secondary "Go to the site". Logged as auth event.
- **error.tsx:** h1 "Something went wrong" · primary "Try again" (calls `reset()`) · secondary "Go home / Go to dashboard".
- **Offline:** h1 "You're offline" · "Retry" button; account pages show cached shell.
- **Maintenance (env flag):** h1 "Back shortly" with optional admin-set message.
- **Phone:** same, full-width buttons, glyph smaller.

## Components
`Button`, `Input` (404 search), `Alert` (error details), `Card`.

## Content & copy notes
- Plain, calm, no jokes at the user's expense; no contact details (D-808) — instead "Signed in? Open a query from your dashboard." Error reference text is selectable.

## Interactions
- "Try again" re-renders the segment; "Go home" → `/` or `/account` or `/dashboard` depending on shell.
- 404 search submits to `/products?q=`.

## States
- **Default:** as per variant.
- **Loading:** n/a (static).
- **Empty:** n/a.
- **Error:** `global-error.tsx` renders a minimal HTML page without shell (theme applied via cookie script).
- **Success:** n/a.
- **Permission-denied:** the 403 variant.

## Responsive behaviour
Centered column at all sizes; tv type scale +2, buttons ≥ 56 px.

## Accessibility
- `h1` is the first focusable-announced element (focus moved on mount); status code glyph `aria-hidden`; buttons have full labels; no auto-redirects without a countdown that can be cancelled.

## Motion
- Glyph fade-in 200 ms.
- Reduced motion: none.

## Navigation
→ `/`, `/products`, `/account`, `/dashboard`, `/auth/login`, sign-out action.

## Data dependencies
Tables: `T-entitlements` (owned check on product 404), `T-audit_logs` (403 event), `T-site_settings` (maintenance message).
Queries: `listMyEntitlements` (API-DEL-01). Actions: Better Auth `signOut` (API-AUTH-01).

## Requirement IDs
D-808, D-1104, A-1202, D-907, BR-11 (archived product handling), D-314.

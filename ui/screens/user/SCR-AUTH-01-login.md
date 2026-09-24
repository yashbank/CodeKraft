# SCR-AUTH-01 — Login

**Route:** `/auth/login?returnTo=&reason=` · **Render:** SSR shell + client form · **App:** Site (auth)

## Purpose
Sign a customer in with email + password or Google (D-1201, D-1603). Phone OTP entry link appears only when flag `phone_otp` is on. Enforces single active session (a new login ends the previous one, D-1203) and returns the user to the page that required login (Buy, wishlist, chat).

## User/role
Visitor (becoming Customer). Admins do not use this page (admin login is SCR-ADM-01 on the admin host).

## Entry points
Header "Sign in", Buy now / wishlist / chat redirects with `returnTo`, register page link, verify-email success, reset-password success, session-replaced or suspended redirect (`reason=`).

## Layout
- **Desktop:** Split layout: left 45 % brand panel (Theme 1: gradient glow + short line "Buy once, build forever." from `site_settings.auth_tagline`; no 3D); right 55 % centred card (max 420 px): wordmark, h1 "Sign in", contextual `Alert` when `reason` present, "Continue with Google" button (full width, Google glyph), divider "or", Email `Input`, Password `Input` with show/hide toggle, row: "Remember this device" `Checkbox` (session cookie vs 30-day) and "Forgot password?" link, primary "Sign in", footer "New to CodeKraft? Create an account".
- If `phone_otp` flag on: link "Sign in with phone instead".
- **Phone:** brand panel collapses to a slim top band with wordmark; card full width with 16 px gutters; buttons 48 px.

## Components
- shadcn/ui: `Card`, `Form`, `Input`, `Checkbox`, `Button`, `Alert`, `Separator`, `Toast`
- custom: `GoogleButton`, `PasswordInput`, `BrandPanel`.

## Content & copy notes
- `reason` copy: `suspended` → "This account is suspended. Sign in to another account or open a query."; `replaced` → "You were signed out because you signed in on another device."; `expired` → "Your session timed out after 60 minutes of inactivity."; `verify` → "Verify your email to continue — check your inbox." Error copy never reveals whether the email exists ("Email or password is incorrect").
- Rate-limit copy: "Too many attempts. Try again in N minutes." No social proof, no contact details.

## Interactions
- Submit → Better Auth `signIn.email` (API-AUTH-01); success → redirect to sanitised same-origin `returnTo` or `/account`.
- Google → OAuth popup/redirect; on return, same redirect logic; Google accounts are pre-verified (D-1201).
- Enter submits; Caps-lock warning under password when detected.
- Unverified email login succeeds but sets `reason=verify` banner on the destination and blocks purchase until verified.
- Analytics `login` with method (D-1302).

## States
- **Default:** empty form; email autofocused on desktop only.
- **Loading:** primary button spinner, form disabled; Google button disabled.
- **Empty:** n/a.
- **Error:** invalid credentials inline `Alert` above the form; field validation under fields; OAuth cancelled → toast "Google sign-in was cancelled"; rate limited (D-1204).
- **Success:** redirect; toast "Welcome back, <name>" on destination.
- **Permission-denied:** signed-in visitor → redirect to `/account` before render.

## Responsive behaviour
- xs–md: single column, slim brand band, card full width, 48 px inputs and buttons, Google button first.
- lg–2xl: 45/55 split, card 420 px centred vertically.
- tv: split retained, card 520 px, 56 px inputs, 4 px focus ring, tagline type +2 steps.

## Accessibility
- `h1` focus on mount; labels visible; password toggle button has `aria-pressed` and label "Show password"; error `Alert` `role="alert"`; Google button's accessible name "Continue with Google"; `autocomplete="email"` / `current-password`.

## Motion
- Card fade+rise 200 ms on mount. **Reduced motion:** none.

## Navigation
→ `returnTo` / `/account`, `/auth/register`, `/auth/reset`, `/auth/otp` (flag), `/legal/privacy`.

## Data dependencies
Tables: `T-users`, `sessions`, `accounts`, `T-audit_logs` (auth event), `T-analytics_events`, `T-site_settings` (tagline, flags).
Actions/queries: Better Auth `signIn.email`, `signIn.social('google')` (API-AUTH-01); `getPublicSettings` (API-AUTH-09).

## Requirement IDs
D-1201, D-1203, D-1204, D-1603, D-204, BR-03, D-1302, X-001, A-1202.

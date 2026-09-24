# SCR-AUTH-05 — Phone OTP login (feature-flagged)

**Route:** `/auth/otp?returnTo=` · **Render:** SSR shell + client form · **App:** Site (auth) · **Flag:** `phone_otp` (D-1603) — route returns 404 and all entry links are hidden while the flag is off.

## Purpose
Let a customer sign in or sign up with a phone number and SMS one-time code once an SMS provider is configured (V1.1). Built now so enabling it is a settings change, not a release. Phone accounts still need an email for receipts and download links, so the flow collects email on first login.

## User/role
Visitor.

## Entry points
Login/register "Sign in with phone instead" (only with flag), direct URL (404 when off).

## Layout
- **Desktop:** Auth split layout, card max 420 px.
- **Step 1 — Phone:** h1 "Sign in with your phone", country-code `Select` (default +91) + phone `Input`, primary "Send code", link "Use email instead". Turnstile invisible.
- **Step 2 — Code:** h1 "Enter the 6-digit code", "Sent to +91 •••• ••42", `InputOTP` (6 boxes, auto-advance, paste support), "Resend code" with 30 s cooldown, primary "Verify", link "Change number".
- **Step 3 — Email (first login only):** h1 "Add your email", copy "We send receipts, invoices and download links by email.", Email `Input`, primary "Continue" → sends verification email (account marked phone-verified, email unverified until link clicked).
- **Phone:** full-width; numeric keyboard (`inputmode="numeric"`, `autocomplete="one-time-code"`).

## Components
- shadcn/ui: `Card`, `Form`, `Select`, `Input`, `InputOTP`, `Button`, `Alert`, Turnstile
- custom: `CountdownButton`.

## Content & copy notes
- Rate-limit copy: "Too many codes requested. Try again in 15 minutes." Wrong code: "That code isn't right — 2 attempts left." Expired: "Code expired — request a new one." Never reveal whether a number is registered.

## Interactions
- Send code → Better Auth phone plugin `sendOtp` (rate-limited per number and IP, D-1204).
- Verify → `verifyOtp`; new user → step 3; existing → redirect to `returnTo`/`/account`. Single-session rule applies (D-1203).
- Analytics `login`/`signup` with method `phone`.

## States
- **Default:** step 1.
- **Loading:** button spinners; OTP boxes disabled while verifying.
- **Empty:** n/a.
- **Error:** invalid number, wrong/expired code with attempts left, rate limited, SMS provider failure ("We couldn't send the code — try email sign-in").
- **Success:** redirect or step 3.
- **Permission-denied:** flag off → 404 (SCR-SITE-11).

## Responsive behaviour
- xs–md: as SCR-AUTH-01 single column; OTP boxes 44 px with 8 px gaps; numeric keyboard; resend button full width.
- lg–2xl: split layout, card 420 px.
- tv: OTP boxes 56 px, card 520 px, countdown text enlarged.

## Accessibility
- OTP boxes are a single labelled group ("6-digit code") with each box `aria-label="Digit n"`; step headings focused on transition; countdown announced once; phone input `type="tel"`.

## Motion
- Step cross-fade 150 ms; box focus ring transition 100 ms. **Reduced motion:** none.

## Navigation
→ `/auth/login`, `returnTo`, `/account`, `/auth/verify` (email step).

## Data dependencies
Tables: `T-users` (`phone`, `phone_verified`), `verifications`, `sessions`, `T-audit_logs`, `T-analytics_events`, `T-site_settings` (flag).
Actions: Better Auth phone-number plugin `sendOtp`/`verifyOtp` (API-AUTH-01); `getPublicSettings` (API-AUTH-09).

## Requirement IDs
D-1603, D-1201, D-207, D-1203, D-1204, R-1201, D-1302.

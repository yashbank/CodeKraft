# SCR-AUTH-02 — Register

**Route:** `/auth/register?returnTo=` · **Render:** SSR shell + client form · **App:** Site (auth)

## Purpose
Create a customer account with email + password (verification link required before purchase) or Google (pre-verified). One login per customer, no team seats (BR-04). Signup collects the minimum (D-209); billing details are collected at checkout (D-410).

## User/role
Visitor.

## Entry points
Login page link, header "Sign in" → "Create an account", Buy redirect when no account, chatbot prompt for visitors (none — chatbot is login-only, so the product page CTA), custom quote email for non-registered recipients (admin creates quotes for existing customers only, so rare).

## Layout
- **Desktop:** Same split layout as SCR-AUTH-01.
- Card: h1 "Create your account", "Continue with Google", divider, Full name `Input`, Email `Input`, Password `Input` with strength meter (min 10 chars, shows rule checklist), consent line "By creating an account you agree to the Terms of service and Privacy policy" (links), primary "Create account", footer "Already have an account? Sign in".
- Invisible Turnstile (D-1204).
- **Phone:** stacked, full-width.

## Components
- shadcn/ui: `Card`, `Form`, `Input`, `Progress` (strength), `Button`, `Alert`, `Separator`, Turnstile
- custom: `PasswordInput`, `PasswordRules`.

## Content & copy notes
- No phone field at launch (phone login is flagged, D-1603); when `phone_otp` is on, a secondary link "Sign up with phone" appears.
- Existing-email error: "An account with this email already exists — sign in or reset your password" (acceptable disclosure at signup per A-1202 rate limits).
- Post-submit copy: "Check your inbox — we sent a verification link to <email>. It expires in 24 hours."

## Interactions
- Submit → Better Auth `signUp.email` with name; sends verification email; page transitions to the "Check your inbox" panel with "Resend" (60 s cooldown) and "Open your inbox" hints; `returnTo` preserved in the verification link.
- Google → creates verified account → redirect to `returnTo` or `/account`.
- Password rules update live; submit allowed when rules pass.
- Analytics `signup` with method.

## States
- **Default:** empty form.
- **Loading:** spinner in button.
- **Empty:** n/a.
- **Error:** validation; duplicate email; Turnstile failure; rate limited.
- **Success:** inbox panel (email) or redirect (Google).
- **Permission-denied:** signed-in → `/account`.

## Responsive behaviour
As SCR-AUTH-01.

## Accessibility
- Strength meter has text equivalent ("Weak/Good/Strong") and rules as a live-updating list with checkmarks announced politely; consent links open in same tab; `autocomplete="new-password"`, `name`, `email`.

## Motion
- As SCR-AUTH-01; strength bar width transition 150 ms (none under reduced motion).

## Navigation
→ `/auth/login`, `/auth/verify` (via email), `/legal/terms`, `/legal/privacy`, `/auth/otp` (flag).

## Data dependencies
Tables: `T-users` (`email_verified=false`), `accounts`, `verifications`, `T-user_roles` (customer), `email_outbox`, `T-audit_logs`, `T-analytics_events`.
Actions: Better Auth `signUp.email`, `signIn.social` (API-AUTH-01), `sendVerificationEmail`.

## Requirement IDs
D-1201, D-1204, D-1603, D-206, D-209, BR-04, D-1302, A-1202, X-004.

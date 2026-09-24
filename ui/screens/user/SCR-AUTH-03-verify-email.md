# SCR-AUTH-03 — Verify email

**Route:** `/auth/verify?token=&returnTo=` (also the "verify required" interstitial rendered inside `/checkout/*` and `/account/chat`) · **Render:** SSR · **App:** Site (auth)

## Purpose
Consume the emailed verification token and mark the account verified so the customer can purchase and use the chatbot (D-1201, BR-03). Also provides the resend flow for signed-in but unverified customers who try to check out.

## User/role
Visitor with token; signed-in unverified Customer.

## Entry points
Verification email link, register success panel, checkout/chat interstitial, login `reason=verify` banner, account overview banner.

## Layout
- **Desktop:** Centred card (max 460 px) in the auth split layout.
- Three variants:
1. **Verifying (token present):** spinner + "Verifying your email…"; server resolves on load.
2. **Verified:** success icon, h1 "Email verified", "You can now buy products and use the assistant.", primary "Continue" → `returnTo`/`/account`, secondary "Sign in" if no session.
3. **Needs verification (interstitial/no token):** h1 "Verify your email to continue", explanation with the masked email, primary "Resend verification email" (60 s cooldown counter), secondary "Change email" → settings, small "Didn't get it? Check spam; links expire after 24 hours."
- Expired/invalid token variant: h1 "This link has expired", primary "Send a new link" (requires sign-in), secondary "Sign in".
- **Phone:** full-width card.

## Components
- shadcn/ui: `Card`, `Button`, `Alert`, `Spinner` (in-button and standalone `Loader`)
- custom: `CountdownButton`.

## Content & copy notes
- Never show the full email to an unauthenticated visitor (mask as `p•••@iauro.com`).
- Success copy is short; no marketing.

## Interactions
- On load with token → Better Auth `verifyEmail`; success sets `email_verified=true`, audit `auth.email_verified`, then shows variant 2 (auto-redirect after 3 s with a visible countdown that can be cancelled).
- Resend → `sendVerificationEmail`, rate-limited (3/hour), toast "Sent".
- "Continue" → `returnTo` (same-origin) or `/account`.

## States
- **Default:** variant 3 when no token.
- **Loading:** variant 1.
- **Empty:** n/a.
- **Error:** invalid/expired token variant; rate-limited resend shows remaining wait.
- **Success:** variant 2.
- **Permission-denied:** already verified → variant 2 immediately.

## Responsive behaviour
Card centred at all sizes; tv larger type.

## Accessibility
- Status changes announced via `aria-live="polite"`; countdown announced once, not per second; auto-redirect cancellable (WCAG 2.2.1); focus on `h1` per variant.

## Motion
- Success icon draw 300 ms. **Reduced motion:** static icon.

## Navigation
→ `returnTo`, `/account`, `/auth/login`, `/account/settings`.

## Data dependencies
Tables: `T-users`, `verifications`, `email_outbox`, `T-audit_logs`.
Actions: Better Auth `verifyEmail`, `sendVerificationEmail` (API-AUTH-01).

## Requirement IDs
D-1201, BR-03, D-1204, D-205, A-1202.

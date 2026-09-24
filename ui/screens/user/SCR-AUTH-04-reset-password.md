# SCR-AUTH-04 — Reset password (request + set)

**Route:** `/auth/reset` (request) and `/auth/reset?token=` (set new) · **Render:** SSR shell + client form · **App:** Site (auth)

## Purpose
Password recovery by emailed link (D-1201). Two steps on one route: request a link, then set a new password from the tokenised link. Also the landing for admin-sent reset links (D-1108) for customer accounts.

## User/role
Visitor (with or without token). Admin-initiated resets land here too.

## Entry points
Login "Forgot password?", admin "Send reset link" (SCR-ADM-11), settings › security "Change password" (for forgotten current password), email link.

## Layout
- **Desktop:** Auth split layout, card max 420 px.
- **Request:** h1 "Reset your password", copy "Enter your email and we'll send a reset link.", Email `Input`, primary "Send reset link", link "Back to sign in". Turnstile invisible.
- **Sent:** h1 "Check your inbox", "If an account exists for <masked email>, a link is on its way. It expires in 1 hour.", "Resend" with 60 s cooldown, "Back to sign in".
- **Set (token):** h1 "Choose a new password", New password `Input` with rules/strength, Confirm password `Input`, primary "Update password", note "You'll be signed out of other devices."
- **Done:** h1 "Password updated", primary "Sign in".
- **Invalid/expired token:** h1 "This link is no longer valid", primary "Request a new link".
- **Phone:** full width.

## Components
- shadcn/ui: `Card`, `Form`, `Input`, `Button`, `Alert`, `Progress`, Turnstile
- custom: `PasswordInput`, `PasswordRules`, `CountdownButton`.

## Content & copy notes
- Request step never confirms existence of the account (same copy either way).
- Google-only accounts receive an email saying "Sign in with Google instead" (no password to reset).
- Copy avoids blame.

## Interactions
- Request → Better Auth `forgetPassword` (API-AUTH-01), rate-limited per IP and per email (D-1204).
- Set → `resetPassword(token, newPassword)`; on success all sessions revoked (single-session rule, D-1203), audit `auth.password_reset`, show Done.
- Confirm mismatch validated on blur.

## States
- **Default:** request form.
- **Loading:** button spinners.
- **Empty:** n/a.
- **Error:** validation, invalid token variant, rate limit ("Try again in N minutes"), server error `Alert`.
- **Success:** Sent / Done variants.
- **Permission-denied:** signed-in user opening request step is allowed (may want to reset); token step allowed regardless of session.

## Responsive behaviour
As SCR-AUTH-01.

## Accessibility
- Each step has its own `h1` focused on transition; live region announces "Reset link sent"; password fields `autocomplete="new-password"`; rules list is a live-updated `ul`.

## Motion
- Step cross-fade 150 ms; none under reduced motion.

## Navigation
→ `/auth/login`, `/auth/reset` (new request).

## Data dependencies
Tables: `T-users`, `accounts`, `verifications`, `sessions` (revoked), `email_outbox`, `T-audit_logs`.
Actions: Better Auth `forgetPassword`, `resetPassword` (API-AUTH-01); admin `sendResetLink` (API-ADM-09) generates the same token.

## Requirement IDs
D-1201, D-1203, D-1204, D-1108, A-1202.

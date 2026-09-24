# SCR-ADM-01 — Admin login + TOTP

**Route:** `admin.<domain>/login`, `/login/totp` · **Render:** SSR shell + client form · **App:** Admin

## Purpose
Authenticate founders (Super Admin) and future partners (Admin) on the separate admin host with email + password, then an optional TOTP second factor (D-1202). Enforces single session and a 30-minute idle timeout (D-1203). Non-admin accounts are refused even with valid credentials.

## User/role
Admin, Super Admin. (Staff role in future.)

## Entry points
Direct URL, idle-timeout sign-out redirect (`?reason=expired`), session-replaced redirect, TOTP setup completion, invitation email link (sets password first via SCR-AUTH-04-style token on the admin host).

## Layout
- **Desktop:** Centred card (max 400 px) on a plain dark canvas (no marketing panel, no 3D): wordmark + "Admin" tag, environment `Badge` (Staging/Production), h1 "Sign in to CodeKraft admin", Email, Password (show/hide), primary "Sign in", link "Forgot password?" (same reset flow, admin host).
- No Google button (admins use credentials + TOTP).
- `/login/totp`: h1 "Enter your authenticator code", `InputOTP` 6 digits, "Use a backup code" toggle (text input), primary "Verify", "Cancel and sign out".
- **Phone:** card full width — login is supported at every width so the read-mostly Approvals, payment-confirmation and Notifications screens are reachable (MASTER_SPEC §7 "Admin minimum width").

## Components
- shadcn/ui: `Card`, `Badge`, `Form`, `Input`, `InputOTP`, `Button`, `Alert`
- custom: `PasswordInput`.

## Content & copy notes
- `reason` copy: `expired` → "Signed out after 30 minutes of inactivity."; `replaced` → "Signed out because you signed in elsewhere."; `forbidden` → "This account has no admin access." Errors do not disclose account existence.
- Backup code copy: "Each backup code works once."

## Interactions
- Submit → Better Auth `signIn.email` on admin host (API-AUTH-01); if the user lacks an admin-class role → sign out + `forbidden` message + audit `auth.admin_forbidden`.
- If `two_factor.enabled` → redirect to `/login/totp`; verify via `verifyTotp` (API-AUTH-07); 5 attempts then 15-min lock (D-1204).
- Success → `/dashboard`. Single session: previous admin session revoked.
- TOTP enrolment is not here; it lives in the avatar menu → "Security" dialog (QR + confirm code + backup codes), referenced from SCR-ADM-31.

## States
- **Default:** empty form.
- **Loading:** button spinner.
- **Empty:** n/a.
- **Error:** invalid credentials; wrong code with attempts left; locked; rate limited.
- **Success:** redirect.
- **Permission-denied:** non-admin → `forbidden` state (stays on login).

## Responsive behaviour
- xs–md: card full width with 16 px gutters, 48 px inputs; environment badge under the wordmark.
- lg–2xl: card 400 px centred; no marketing panel.
- tv: card 480 px, 56 px inputs, OTP boxes 56 px.

## Accessibility
- `h1` focus; OTP group labelled; environment badge has text; errors `role="alert"`; no auto-submit on 6th digit without announcing (auto-submit allowed with live status "Verifying").

## Motion
- Card fade 150 ms. **Reduced motion:** none.

## Navigation
→ `/dashboard`, `/login/totp`, `/reset` (admin host variant of SCR-AUTH-04).

## Data dependencies
Tables: `T-users`, `T-user_roles`, `sessions`, `two_factor`, `T-audit_logs`.
Actions: Better Auth `signIn.email`, `twoFactor.verifyTotp`/`verifyBackupCode` (API-AUTH-01, API-AUTH-07).

## Requirement IDs
D-1202, D-1203, D-1204, A-1201, D-202, D-1104, A-1202.

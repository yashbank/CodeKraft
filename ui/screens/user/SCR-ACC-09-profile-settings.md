# SCR-ACC-09 — Profile & settings

**Route:** `/account/settings?tab=profile|preferences|security|notifications|danger` · **Render:** Client · **App:** Account

## Purpose
Everything about the account itself: profile and billing defaults, display currency and theme (D-111, D-905), reduce-motion preference, security (password, active session), email notification preferences, and self-service account deletion with records retained (D-1003, BR-18). Customer 2FA is intentionally absent (X-003).

## User/role
Customer.

## Entry points
Sidebar "Settings", avatar menu, checkout "Edit billing details", notification inbox footer, legal pages ("Change email" from verify screen).

## Layout
- **Desktop:** h1 "Settings".
- Left vertical `Tabs` (240 px): Profile · Preferences · Security · Notifications · Delete account.
- Right panel per tab (max 640 px):
- **Profile:** avatar upload (optional), Full name, Email (read-only with "Change" → dialog requiring password; sends verification to new address), Phone (shown only if flag `phone_otp`), "Billing details" fieldset: Billing name, Company, Address (line1, line2, city, state, postal code), Country (`Combobox`), GST number (India only; format hint). Save button.
- **Preferences:** Display currency `Select` (INR, USD, EUR, GBP, CAD) with note "You're charged in INR; other currencies are shown as estimates"; Theme `RadioGroup` (Dark cinematic / Light editorial — second option only when flag on, otherwise the group is hidden and a line says "Theme: Dark cinematic"); "Reduce motion" `Switch` (mirrors OS preference, overrides when set). Auto-saves.
- **Security:** Change password (current, new, confirm); "Active session" card: device, IP, last active, note "Only one session is active at a time; signing in elsewhere signs this one out" (D-1203); "Sign out everywhere" button; login history (last 5 auth events from audit).
- **Notifications:** Email toggles: Order and payment updates (locked on, explanation), Product updates for owned products (on/off). In-app notifications always on. No marketing toggle at release 1.
- **Delete account:** explanation of what happens (personal data anonymised **immediately** on deletion — no grace window, BR-18 / MASTER_SPEC §7 "Anonymisation timing"; orders, invoices and records retained 7 years; active subscriptions cancelled at period end), blocker note if a service delivery is in progress, `Input` "Type DELETE", password field (credential accounts), destructive "Delete my account".
- **Phone:** tabs become a segmented scroller at top; panels full width.

## Components
- shadcn/ui: `Tabs`, `Form`, `Input`, `Select`, `Combobox`, `RadioGroup`, `Switch`, `Button`, `Card`, `Dialog` (change email), `AlertDialog` (delete), `Avatar`, `Alert`, `Toast`
- custom: `AddressFields`, `SessionCard`.

## Content & copy notes
- GST hint: "15-character GSTIN, e.g. 27ABCDE1234F1Z5".
- Currency note reflects BR-08/D-502.
- Delete copy is explicit about BR-18 retention.
- Password rules as register.
- Theme labels are the full names, never "dark mode/light mode".

## Interactions
- Profile save → `updateProfile` (API-AUTH-03); toast "Profile saved".
- Preferences change → `updateSettings` (API-AUTH-04) immediately; theme applies instantly (`data-theme` + cookie); currency re-renders prices app-wide.
- Change password → `changePassword` (API-AUTH-05); other sessions revoked.
- Sign out everywhere → `revokeSession` for all (API-AUTH-06) then redirect to login.
- Notifications → `updateNotificationPreferences` (API-NOTIF-04).
- Delete → `deleteAccount` (API-AUTH-08) → sign out → `/` with toast "Your account has been deleted" (anonymisation is immediate).

## States
- **Default:** populated forms.
- **Loading:** skeleton fields.
- **Empty:** billing empty shows placeholders; no login history → "No recent sign-ins".
- **Error:** inline field errors; wrong current password; `STATE_INVALID` on delete → `Alert` "A service delivery is in progress — open a query to close it first"; flag-off theme choice → `FORBIDDEN` (not reachable in UI).
- **Success:** toasts; delete → redirect.
- **Permission-denied:** n/a.

## Responsive behaviour
xs stacked; md+ side tabs; tv panel 760 px with larger controls.

## Accessibility
- Tabs are Radix vertical tabs with arrow-key navigation; auto-saving controls announce "Saved" via live region; theme radios have full labels; delete confirmation requires typed phrase and is keyboard operable; password fields have proper `autocomplete`.

## Motion
- Theme switch cross-fades page colours 200 ms (instant under reduced motion); tab cross-fade 150 ms.

## Navigation
→ `/auth/login` (after sign-out/delete), `/legal/privacy`, `/account/notifications`.

## Data dependencies
Tables: `T-users` (`display_currency`, `theme_pref`, `status`, `deleted_at`), `T-customer_profiles` (billing, `notification_prefs`), `sessions`, `accounts`, `verifications`, `T-audit_logs` (login history), `T-subscriptions` (cancel on delete), `T-site_settings` (flags).
Queries: `getMe` (API-AUTH-02), `getSecurityOverview` (API-DASH-03), `getNotificationPreferences` (API-NOTIF-04). Actions: `updateProfile` (API-AUTH-03), `updateSettings` (API-AUTH-04), `changeEmailRequest`/`changePassword` (API-AUTH-05), `listSessions`/`revokeSession` (API-AUTH-06), `updateNotificationPreferences` (API-NOTIF-04), `deleteAccount` (API-AUTH-08).

## Requirement IDs
D-111, D-502, D-518, D-905, D-907, D-1001, D-1003, D-1203, D-410, D-1002, BR-18, X-003, D-1603.

# SCR-ADM-31 — Admin users & roles

**Route:** `admin.<domain>/admin-users` · **Render:** Client · **App:** Admin

## Purpose
Manage who can use the admin app: invite admins (as Admin or Super Admin; Staff defined but not seeded, D-201), change roles, remove access, and maintain the partner record (display name, payout bank details) for admins who hold ownership shares (D-114). Every change is dual-approved (BR-13). Also where each admin sets up their own TOTP (D-1202).

## User/role
Super Admin (`users.admin.manage`); any admin can open their own Security dialog.

## Entry points
Sidebar "System › Admin users", avatar menu "Security" (own TOTP), product editor Ownership "Add partner", approvals inbox (admin.user_change).

## Layout
- **Desktop:** h1 "Admin users".
- Toolbar: "Invite admin" primary. A `warning` banner "Only one active admin — dual-approval actions (publish, splits, refunds, payouts, adjustments) cannot be executed until a second admin is active" appears whenever fewer than two active admin-class users exist (MASTER_SPEC §7 "Approver set").
- `DataTable`: User (avatar, name, email), Role badge (Super Admin / Admin / Staff), Partner (display name + active share count, or "—"), TOTP (enabled/not), Last sign-in, Status (Active / Invited / Pending change), ⋯: Change role, Edit partner details, Remove access, Resend invite, Revoke sessions.
- Pending approval chips link to the request.
- Invite `Dialog`: Email*, Role* (`RadioGroup` with permission summary from the matrix), "Also a partner" `Switch` → Partner display name*; explanation "The other admin(s) must approve before the invite is sent" (BR-13).
- Change role / Remove `AlertDialog`s with consequences ("Removing the last Super Admin is not allowed" — a change leaving zero active `super_admin` users is rejected; one leaving fewer than two admin-class users is allowed with the warning above, MASTER_SPEC §7 "Admin removal"; "This partner holds active shares — reassign ownership first").
- Partner details `Sheet`: display name, payout bank details (encrypted at rest; masked display with reveal audited), active `Switch`.
- **Security (self) `Dialog`:** TOTP setup (QR + manual secret, confirm code), backup codes (download once), disable TOTP (requires password + code); active session info.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `DataTable`, `Dialog`, `AlertDialog`, `Sheet`, `Form`, `Input`, `RadioGroup`, `Switch`, `InputOTP`, `Badge`, `Avatar`, `Button`, `DropdownMenu`, `Alert`, `Skeleton`
- custom: `PermissionSummary`, `TotpSetup`, `BankDetailsFields`.

## Content & copy notes
- Role summaries pulled from docs/06 §1.2 matrix in plain words ("Admin: own products, own share, assigned leads; cannot change settings").
- Invite email copy mentions the admin host and TOTP recommendation.
- Backup codes warning "Store these somewhere safe; each works once."

## Interactions
- Invite / Change role / Remove → `inviteAdmin`/`changeAdminRole`/`removeAdmin` (API-ADM-11) → approval request; on approval the invite email is sent and roles applied.
- Partner → `updatePartner` (API-ADM-12).
- TOTP → `enableTotp`/`verifyTotp`/`disableTotp` (API-AUTH-07).
- Revoke sessions → `revokeSession` (API-AUTH-06) for that user (audited).

## States
- **Default:** list.
- **Loading:** skeleton.
- **Empty:** never empty (two seeded Super Admins).
- **Error:** `STATE_INVALID` messages; validation.
- **Success:** toasts "Invite approval requested", "TOTP enabled".
- **Permission-denied:** non-Super Admin sees own row and Security only.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ table; tv wider.

## Accessibility
- QR has manual secret text alternative; OTP input labelled; dialogs explicit; role radios describe permissions.

## Motion
- Standard.
- Reduced motion: none.

## Navigation
→ `/approvals/[id]`, `/products/[id]?tab=ownership`, `/audit?actor=`.

## Data dependencies
Tables: `T-users`, `T-user_roles`, `T-roles`/`permissions`/`role_permissions`, `T-partners`, `two_factor`, `sessions`, `T-approval_requests`, `T-product_ownership_lines` (share check), `email_outbox`, `T-audit_logs`.
Queries: `listPartners` (API-ADM-12). Actions: API-ADM-11, API-ADM-12, API-AUTH-06, API-AUTH-07.

## Requirement IDs
D-114, D-201, D-202, D-1103, D-1105, D-1202, D-1203, BR-13, A-201, D-1104.

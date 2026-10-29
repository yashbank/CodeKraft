# CodeKraft Access Policy

> Applies once P10-01/P10-02 are deployed.

This page explains who can do what in CodeKraft, how people get access, how passwords work, and how to remove access. It is written for founders and for whoever administers the admin console next. Examples use placeholders such as `<admin-email>`. Never paste real passwords, tokens, or secret values into this page, into chat, or into email.

## 1. Roles

CodeKraft has four login roles. Each user has one role.

| Role | Who it is for | Summary |
| --- | --- | --- |
| `super_admin` | Founders and the most trusted operators | Everything an admin can do, with no data scoping. Also manages admin users and roles, changes site settings, reads all ledgers and leads, and exports audit data. |
| `admin` | Trusted day-to-day operators | Runs catalog, orders, invoices, delivery, leads, queries, and customer support. Sees finance only for their own product and partner lines. Approves requests from others, never their own. Cannot manage admin users or change settings. |
| `staff` | Support and content helpers | Edits catalog and content, handles orders, invoices, delivery tasks, leads, queries, and customer notes. Can read settings and the dashboard. No finance, no approvals, no audit log, no suspending or resetting customers. |
| `customer` | Buyers | Manages their own account, purchases, delivery, support chat, and the chatbot. No admin screens. |

Partners are not a login role. A partner is a business record linked to a user (for payouts and statements). Partner access to money views comes from the admin role and the partner record, not from a separate login.

The admin console is open only to `super_admin` and `admin`, and `staff` have a limited admin view. Customers never reach admin screens.

## 2. Inviting an admin

- An invite creates a single-use link that is valid for **7 days**.
- The inviter can copy the link and share it through a channel the invitee trusts. Do not send it to a shared inbox or public chat.
- Regenerating an invite **invalidates the old link**. Only the newest link works.
- Inviting any admin-class user (`admin` or `super_admin`) needs approval from a second admin-class user. The request appears under Approvals as `admin.user_change`. The requester cannot approve their own request.
- Gap to close: the current code lets any other active admin-class user approve, not only a second super admin. Until that is tightened, approve admin-class invites only when you would trust the approver with full access.

## 3. Temporary passwords

- The policy is that no one shares a temporary password. An admin never sets a password for another person.
- Where a temporary password is shown, it is shown **once** at creation. Copy it straight into a password manager and hand it over in person or in a secure channel.
- Temporary passwords are never stored in readable form. If it is lost, regenerate it.
- The user **must change it on first login**.
- Regenerating a temporary password **invalidates the old one** immediately.
- Gap to check: the current customer flow sends a set-password email instead of creating a temporary password. Confirm with the team which flow is live before relying on this section.

## 4. Password reset

- **Email flow.** When email is configured, a user who forgets their password requests a reset email. The reset link is valid for **1 hour**.
- **Admin-generated link.** An admin with `customers.reset_link` can send a single-use reset link. It is valid for **1 hour**. The admin never sees the link itself.
- **Signing out.** A successful reset signs out all other sessions for that user.
- **Super admins only.** Only a `super_admin` can reset another `super_admin`'s password.
- Failed or expired reset links cannot be reused. Request a new one.

## 5. Password rules

Enforced by the server on every sign-up, change, and reset (`src/modules/auth/password-policy.ts` and `src/modules/auth/config.ts`):

- **Minimum length:** 12 characters for customers, **14 characters for admin-class users**.
- **Maximum length:** 128 characters.
- **No forced symbols or digits.** Length matters more than character mix. Use a passphrase.
- **Not blank.** Spaces alone are rejected.
- **Must not contain your email name.** For example, if your email is `<admin-email>`, the local part before `@` cannot appear in the password.
- **Breach check.** Passwords found in known data breaches are refused.

## 6. Two-factor login (2FA)

- The code supports **authenticator-app codes (TOTP)** with **10 one-time backup codes**. Backup codes are shown once and each works once.
- Users turn it on from their own Security (TOTP) screen. Setup needs their password.
- Admin users with TOTP enabled are asked for a six-digit code after the password step on the admin login.
- **Recommendation:** every `admin` and `super_admin` must enable 2FA. Treat an admin account without 2FA as a risk to fix on day one.
- Gap to check: the code does not appear to force 2FA on admin accounts. Confirm the enforcement before relying on it.

## 7. Sessions

- Admin sessions sign out after **30 minutes idle**.
- Customer sessions sign out after **1 hour idle**.
- Gap: the code defines a 12-hour (admin) and 7-day (customer) absolute session cap, but nothing enforces it yet.
- Suspending a customer deletes all of their sessions at once.

## 8. Offboarding a person

Do these in order, the same day:

1. **Revoke access.** Remove the admin role through Admin users (this goes through approval). For customers, suspend the account. Either action ends their sessions.
2. **Check the last super admin.** The system refuses to remove or demote the last active `super_admin`. Make another super admin first.
3. **Rotate shared secrets.** If the person ever knew a shared secret (a payment key, an email API key, a database URL, or the auth secret), rotate it in the hosting dashboard and update the environment. Do not put new values in this repo or in chat.
4. **Reset shared passwords** the person knew, such as shared vendor logins.
5. **Review the audit log** for the last 30 days of their actions, especially exports, settings changes, and approvals they made.
6. **Record it.** Note the date and who approved the offboarding in your own records.

## 9. Audit log

- Every sign-in, sign-out, role change, approval, settings change, and password action is recorded.
- Find it in the admin console under **Audit log**. Only `super_admin` and `admin` can read it. Only `super_admin` and `admin` can export it.
- Review it after every offboarding and once a month for admin accounts.

## 10. What never to do

- Never share a password, reset link, invite link, or 2FA code in chat, email, or a ticket.
- Never reuse a temporary password, and never reuse a password across services.
- Never commit credentials, keys, tokens, or `.env` values to the repository, even in a private branch.
- Never paste secrets into screenshots, bug reports, or this document.
- Never give an admin account to a shared login. One person, one account.
- Never approve your own admin request, and never skip the approval step.
- Never leave an offboarded person's session or 2FA device active.
- Never disable 2FA on an admin account without a replacement plan.

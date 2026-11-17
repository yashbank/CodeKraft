---
id: admin-security-totp
title: Secure admin login with TOTP
roles: [admin, super_admin]
keywords: [TOTP, 2FA, authenticator, two factor, login verification, backup code, security, admin login]
---
1. Open Admin users, then the Login verification area (the Security button).
2. Click Enable TOTP.
3. Scan the QR code with an authenticator app, or copy the Manual secret.
4. Enter the six-digit code under Confirm code.
At the next sign-in the admin login asks for "Enter your authenticator code". If you lose the phone, choose Use a backup code. Super admins can see who is covered under Login verification. Disable TOTP only when you have a replacement.

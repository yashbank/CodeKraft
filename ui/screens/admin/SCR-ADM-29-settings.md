# SCR-ADM-29 — Settings

**Route:** `admin.<domain>/settings/general|currencies|tax|payment-methods|theme|ai|notifications|flags|retention` · **Render:** Client · **App:** Admin

## Purpose
Platform configuration that must never require a deploy: seller identity, base currency and FX, tax and GSTIN, manual payment details (UPI VPA, bank account), default theme, AI model and caps, notification channels, feature flags and retention. Every change is audited with before/after (D-1104).

## User/role
Super Admin (`settings.write`); Admin/staff read-only (`settings.read`).

## Entry points
Sidebar "System › Settings", contextual links (product editor tax hint, chatbot monitor "Adjust caps", checkout copy, admin login).

## Layout
- **Desktop:** h1 "Settings".
- Left rail of sections; right form (max 760 px) with sticky save bar per section ("Save changes" / "Discard"; unsaved guard).
- Sections:
- **General / seller:** Site name (CodeKraft, read-only), Domain (placeholder until launch, D-1502), Seller details for invoices: legal name*, address*, contact phones (invoice-only, D-406), email (invoice-only), logo (media), Support reply-time copy, Query snippets (5 canned replies), Environment badge.
- **Currencies & FX:** Base currency `Select` (INR; **read-only once the first paid order exists**, MASTER_SPEC §7 "Base currency lock"; before that, changing is refused while pending orders exist — both explained inline), Enabled display currencies checkboxes (INR, USD, EUR, GBP, CAD, D-518), FX table (quote, rate, as of, source) with "Refresh rates now" and per-currency override input + "clear override"; staleness warning > 3 days (docs/04 §10).
- **Tax & GSTIN:** GSTIN input (15-char validation, D-1501), Tax rate % (bps), Seller state (for CGST/SGST vs IGST), explanation card "Tax applies only to tax-enabled products and only once a GSTIN is set (BR-08)"; invoice format preview toggles between plain and GST breakdown.
- **Payment methods:** UPI: enabled `Switch`, VPA* (`name@bank`), payee name (CodeKraft), sample QR preview; Bank transfer: enabled, account name*, account number*, IFSC*, bank name*, SWIFT (optional), instructions note; Gateway cards (Razorpay, Stripe, PayPal) shown disabled with "Enable in Feature flags after configuring keys (V1.1)". Warning if disabling a method used by active offerings (lists them).
- **Theme:** Default site theme `RadioGroup` (Dark cinematic / Light editorial — second disabled until flag on), "Allow visitor toggle" (locked on per D-905), preview thumbnails.
- **AI:** Model `Select` (from provider list; default per docs/04 §9) with pricing note, Platform daily message cap*, Per-user daily cap*, Timeout (s), Max output tokens, "Menu-only mode" emergency switch, link to Chatbot › Prompts, usage today read-out.
- **Notifications:** Customer channels: Email (on), In-app (on), WhatsApp (flag-gated, off; cost note, D-1604); Admin channel: In-app only (read-only note, D-707); Overdue follow-up digest email: enabled + send time (R-701); Resend sender address (read-only from env) with "Send test email".
- **Feature flags:** table of flags (`phone_otp`, `whatsapp_channel`, `theme_light_editorial`, `provider_razorpay`, `provider_stripe`, `provider_paypal`, `automated_provisioning`, `three_hero`, `bundles`, `vendor_marketplace` — docs/04 §7.9, MASTER_SPEC §4.11) with description, env override indicator, `Switch`, and dependency warnings (e.g. phone_otp needs SMS provider env; `bundles` and `vendor_marketplace` are V1.1/V2 placeholders shown disabled).
- **Retention:** Chat transcripts (months, default 12), Records (years, default 7, read-only min 7), note "Personal data is anonymised immediately when a customer deletes the account (BR-18)" (no delay setting), next purge run time from `job_runs`, "Run retention job now".
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Tabs`/rail, `Form`, `Input`, `Select`, `Checkbox`, `Switch`, `RadioGroup`, `Table`, `Card`, `Alert`, `AlertDialog` (base currency, disabling methods), `Button`, `Tooltip`, `Skeleton`
- custom: `FxTable`, `QrPreview`, `InvoicePreview`, `FlagRow`.

## Content & copy notes
- Every section starts with a one-line "why this matters".
- Dangerous changes use `AlertDialog` with consequence text (base currency, disabling UPI, lowering caps to 0, turning off `three_hero`).
- Values that are env-overridden show a lock icon "Set by environment".

## Interactions
- Load `getSettings` (API-ADM-10); Save → `updateSettings` with patch per section; validation errors inline (GSTIN format; VPA required when UPI enabled).
- FX → `refreshFxRates`/`setFxOverride` (API-FIN-12).
- Retention run / test email → cron trigger endpoints (secret-protected, admin-invoked) with `listJobRuns` (API-OPS-02) feedback.

## States
- **Default:** section forms.
- **Loading:** skeleton.
- **Empty:** unset payment details show "Not configured — checkout will hide this method".
- **Error:** validation; `STATE_INVALID` for base currency change (pending orders) — the field is not editable at all after the first paid order.
- **Success:** toast "Settings saved" + audit link.
- **Permission-denied:** read-only forms with banner for non-Super Admin.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ rail + form; tv wider form.

## Accessibility
- Sections as `h2`; switches labelled with consequence; env-locked fields `aria-disabled` with explanation; dialogs explicit; FX table with headers.

## Motion
- Standard.
- Reduced motion: none.

## Navigation
→ `/chatbot`, `/content/legal`, `/audit?subject=site_settings`, `/products` (affected offerings).

## Data dependencies
Tables: `T-site_settings`, `T-fx_rates`, `job_runs`, `T-offerings`/`T-offering_payment_methods` (affected offerings), `T-orders` (pending check), `T-media` (logo), `T-audit_logs`.
Queries: `getSettings` (API-ADM-10), `listJobRuns` (API-OPS-02). Actions: `updateSettings` (API-ADM-10), `refreshFxRates`/`setFxOverride` (API-FIN-12).

## Requirement IDs
D-401, D-406, D-502, D-504, D-518, D-519, D-1501, D-1502, D-501, D-905, D-708, D-707, D-1002, D-1604, D-1603, D-1602, D-1605, D-1503, BR-08, BR-18, R-701, docs/04 §7.9.

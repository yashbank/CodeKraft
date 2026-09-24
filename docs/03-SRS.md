# 03 — SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

**Product:** CodeKraft · **Version:** 1.0 · **Date:** 2026-09-24 · **Status:** Draft for engineering
**Implements:** `docs/02-PRD.md` (US-nn), `docs/01-BRD.md`, `discovery/01-REQUIREMENTS-BASELINE.md` (BR-nn), `MASTER_SPEC.md` §4, §6.
**Feeds:** `docs/04-SOLUTION-ARCHITECTURE.md`, `docs/06-API-SPECIFICATION.md`, `docs/09-SECURITY-DESIGN.md`, `docs/10-QA-TEST-STRATEGY.md`, `implementation/`.
**Conventions:** `FR-<AREA>-nn` functional, `NFR-<AREA>-nn` non-functional; areas per MASTER_SPEC §6. Each FR is one testable sentence, cites its source IDs (D-/BR-/A-/US-) and the tables it touches (`T-` per `docs/05-DATABASE-DESIGN.md`; tables without a `T-` prefix in docs/05 are named directly). Values marked **(proposed)** were not fixed in discovery and need founder confirmation. Money is integer minor units with a currency code (MASTER_SPEC §4.8). "Admin" below means any user with role `super_admin` or `admin` unless a rule says otherwise; release-1 admins are the two Super Admins.

---

## 1. Functional requirements

### 1.1 AUTH — identity, sessions, roles

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-AUTH-01 | The system shall register a customer with email + password, create the account with `email_verified = false`, and send a single-use verification link valid 24 h (proposed). | D-1201, US-08 | T-users, verifications |
| FR-AUTH-02 | The system shall block checkout ("Buy now") for any account whose email is unverified and offer a resend, rate-limited to 3 per hour (proposed). | D-1201, BR-03, US-08 | T-users |
| FR-AUTH-03 | The system shall sign in or create a pre-verified account via Google OAuth and link it to an existing account with the same verified email. | D-1201, US-09 | T-users, accounts |
| FR-AUTH-04 | The system shall issue password-reset links that are single-use and expire after 60 min (proposed), responding identically whether or not the email exists. | D-1201, US-10 | verifications |
| FR-AUTH-05 | The system shall keep exactly one active session per account, deleting all other sessions on every new login. | D-1203, US-10 | sessions |
| FR-AUTH-06 | The system shall expire idle sessions after 30 min for admin-role users and 60 min for customers, measured from the last authenticated request. | D-1203, D-211 | sessions |
| FR-AUTH-07 | The system shall offer optional TOTP 2FA with backup codes to admin-role users and require the code before any admin page or Server Action executes when enabled. | D-1202, US-12 | two_factor |
| FR-AUTH-08 | The system shall serve the admin application only on the host that exactly matches the `ADMIN_HOST` environment value (`admin.<domain>` once the domain exists; a second `*.vercel.app` project hostname during the interim), return 404 for `/admin/*` on any other host, and use host-only cookies so admin and site sessions are separate. | A-1201, docs/04 §8, MASTER_SPEC §7 "Admin host during interim" | — |
| FR-AUTH-09 | The system shall store roles as rows in T-user_roles on a single identity table and derive permissions from T-role_permissions; no role is an account type. | A-201, D-201 | T-users, T-roles, T-user_roles, permissions, role_permissions |
| FR-AUTH-10 | The system shall assert the required permission string inside every Server Action and route handler, independent of any layout-level check. | D-1103, docs/04 §8 | — |
| FR-AUTH-11 | The system shall expose phone-OTP registration and login only when the `phone_otp` feature flag is on and an SMS provider is configured, with 6-digit codes valid 5 min (proposed) and max 5 attempts (proposed). | D-1603, D-1201, US-11 | T-users, verifications, site_settings |
| FR-AUTH-12 | The system shall refuse login for users with `status ∈ {suspended, deleted}` and end their existing sessions on status change. | D-1003, D-1108, US-72 | T-users, sessions |
| FR-AUTH-13 | The system shall write an audit row for every auth event (login success/failure, logout, 2FA enable/disable, reset, session revoke) with actor, IP and user agent. | D-1104 | T-audit_logs |

### 1.2 CAT — catalog, offerings, ownership, content pages

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-CAT-01 | The system shall store every product as an admin-created row; no product, offering or price shall be defined in code. | D-018, MASTER_SPEC §4.7 | T-products |
| FR-CAT-02 | The system shall enforce a category tree of depth ≤ 2 and allow free-form tags per product. | D-303 | T-categories, T-tags, T-product_tags |
| FR-CAT-03 | The system shall require every product to have ≥ 1 offering and every offering to have a price row in the platform base currency before it can be submitted for publish. | A-301, D-502, US-54 | T-offerings, T-offering_prices |
| FR-CAT-04 | The system shall store on each offering: purchase model, billing interval (subscription only), trial days, license type, delivery type + config, service steps, instructions, enabled payment methods, access months (null = lifetime), update policy and download cap. | D-304, D-404, D-405, D-110, D-601–D-608, US-51 | T-offerings, T-offering_payment_methods |
| FR-CAT-05 | The system shall list on `/products` only products with `status = published` and `is_unlisted = false`, and shall render `is_coming_soon` products without a "Buy now" control. | D-314, US-13, US-14 | T-products |
| FR-CAT-06 | The system shall filter products by category, price range (in display currency), purchase model, delivery type, tech stack, industry and target audience, and sort by newest, price asc/desc, most popular (paid order count) and featured. | D-310, A-303 | T-products, T-offerings, T-offering_prices |
| FR-CAT-07 | The system shall search products only, via `products.search_vector` full-text over name, descriptions, tags, tech stack and industry. | A-303, A-304 | T-products |
| FR-CAT-08 | The system shall render on the product page: description blocks, features, benefits, audience, use cases, industry, tech stack, requirements, FAQs, curated testimonials, images, screenshots, gallery, embedded or uploaded video, inline PDF presentation, optional live-demo link, current version and public changelog. | D-309, D-312, D-313, D-805, US-14 | T-products, T-product_media, T-media, T-product_faqs, T-product_testimonials, T-product_versions |
| FR-CAT-09 | The system shall never expose partner identity, ownership or split data on any public or customer-facing surface or API response. | BR-02, D-116 | T-product_ownerships |
| FR-CAT-10 | The system shall display prices in the viewer's display currency — a cookie for visitors, `users.display_currency` for logged-in users (login loads the account value; saving it refreshes the cookie) — using an explicit T-offering_prices row when present, else converting from base with the latest T-fx_rates row and an "approx." label. | D-502, D-518, D-111, US-15, MASTER_SPEC §7 "Visitor currency selector" | T-offering_prices, T-fx_rates, T-users |
| FR-CAT-11 | The system shall show `compare_at_minor` struck through beside the current price when it exceeds `amount_minor`. | D-408 | T-offering_prices |
| FR-CAT-12 | The system shall store ownership as effective-dated versions whose partner lines sum to exactly 10000 bps, with at most one `active` version per product, and shall activate a new version only when its approval request is applied. | BR-05, BR-06, BR-07, D-508, D-509, US-53 | T-product_ownerships, T-product_ownership_lines, T-approval_requests |
| FR-CAT-13 | The system shall keep a wishlist per customer (add/remove/list) and require login to use it. | D-311, US-16 | wishlists |
| FR-CAT-14 | The system shall render `/blog` and `/blog/[slug]` for published product blogs, embed the blog card below all product details, and show teasers on the landing "What we sell" chapter. | D-121, D-804, US-06, US-67 | T-product_blogs |
| FR-CAT-15 | The system shall publish `/projects` and `/projects/[slug]` case studies and `/services` with one section per published service and no service pricing. | D-803, D-806, BR-01, US-03, US-04 | case_studies, services |
| FR-CAT-16 | The system shall allow admins to record a new product version with a public changelog and attach release files per version. | D-313, D-604, US-32 | T-product_versions, T-release_files, T-media |

### 1.3 COM — commerce: orders, checkout, coupons, quotes, manual orders

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-COM-01 | The system shall create, on "Buy now", one order of type `product` containing exactly one item at quantity 1 for the chosen offering, in the base currency, status `pending_payment`, `expires_at = now + 7 days`. | MASTER_SPEC §7, ADR-12, D-412, US-18 | T-orders, T-order_items |
| FR-COM-02 | The system shall require login with a verified email to create any order and shall never offer guest checkout. | D-204, BR-03, X-001 | T-users |
| FR-COM-03 | The system shall require name, email and country at checkout and accept optional company, billing address and GST number, snapshotting them on the order and defaulting them into the customer profile. | D-410, US-19 | T-orders, T-customer_profiles |
| FR-COM-04 | The system shall compute order totals as `subtotal − discount + tax` in integer minor units, with tax = `subtotal_after_discount × tax_rate_bps / 10000` only when the product is `tax_enabled` and `site_settings.gstin` is set, rounding half-up to the minor unit. | BR-08, D-504, D-519, D-1501 | T-orders, T-order_items, site_settings |
| FR-COM-05 | The system shall refuse creation of a new order for a `one_time` offering the customer has already paid for. | BR-10, D-413, US-23 | user_offering_purchases |
| FR-COM-06 | The system shall, via cron, set `pending_payment` orders whose `expires_at` has passed with no confirmed payment to `failed` (reason `expired`; this also covers a reference an admin marked invalid with no retry before expiry), mark their open payments `failed`, and notify the customer; `cancelled` is used only for a customer or admin cancel. | BR-10, D-412, D-416, US-23, MASTER_SPEC §7 "Order failed" | T-orders, T-payments, notifications |
| FR-COM-07 | The system shall validate a coupon at apply time against active flag, `starts_at..ends_at`, `max_redemptions`, `product_ids` and `first_purchase_only`, record the redemption on the order, and lock the discount for the life of that order. | A-401, D-409, US-24 | T-coupons, coupon_redemptions, T-orders |
| FR-COM-08 | The system shall compute a percent coupon as `subtotal × value / 10000` and a fixed coupon as `min(value, subtotal)` in the order currency. | A-401 | T-orders |
| FR-COM-09 | The system shall let an admin create a custom quote for one customer with a negotiated price, an expiry and a tokenised pay link, and shall create an order only when the addressed customer accepts before expiry. | D-520, US-25 | T-custom_quotes, T-orders |
| FR-COM-10 | The system shall let an admin create a manual order of type `project` or `product` with customer or client details, offering-linked or free-form line items, tax and a payment record, using the same order, invoice and ledger paths. | D-1107, D-510, A-502, US-59 | T-orders, T-order_items, T-payments |
| FR-COM-11 | The system shall store on every `project` order line a `split_snapshot` (company cut + partner shares summing to 10000 bps) set by the creating admin, create a `project_order.split` approval request for the order, refuse to invoice or record payment for the order until that request is applied, and then post ledger entries and allocations from the snapshot exactly as from a product ownership version. | A-502, D-510, BR-05, MASTER_SPEC §7 "Project order splits" | T-order_items, T-approval_requests, T-allocations |
| FR-COM-12 | The system shall snapshot on each order item the `ownership_id` in force at payment time so later split changes never alter it. | BR-05, D-006, D-509 | T-order_items, T-product_ownerships |
| FR-COM-13 | The system shall number orders `CK-ORD-nnnnnn` sequentially and expose the number as the required payment narration. | docs/05 §5, D-501 | T-orders |
| FR-COM-14 | The system shall emit analytics events for product view, wishlist, checkout start, payment submitted and payment confirmed, with product and order IDs. | D-1302 | analytics_events |

### 1.4 PAY — payments, invoices, refunds

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-PAY-01 | The system shall implement a `PaymentProvider` interface and ship only `ManualProvider` (`manual_upi`, `manual_bank`) in release 1; order and ledger code shall not reference any provider key. | A-402, D-402, MASTER_SPEC §4.4 | T-payments |
| FR-PAY-02 | The system shall show at payment only the methods enabled on the offering whose provider feature flag is on. | D-110, docs/04 §7.9, US-20 | T-offering_payment_methods, site_settings |
| FR-PAY-03 | The system shall generate for a UPI payment a QR encoding `upi://pay?pa=<vpa>&pn=CodeKraft&am=<amount>&cu=INR&tn=<order_no>` from `site_settings.upi_vpa` and store the instructions on the payment row. | D-501, US-21 | T-payments, site_settings |
| FR-PAY-04 | The system shall show for a bank payment the configured account name, number, IFSC and optional SWIFT with the order number as narration. | D-402, US-22 | T-payments, site_settings |
| FR-PAY-05 | The system shall accept a customer transaction reference (1–64 chars, proposed), move the payment to `submitted`, and notify admins in-app. | D-501, US-21 | T-payments, notifications |
| FR-PAY-06 | The system shall let an admin confirm a `submitted` payment by recording `amount_received_minor`, computing `bank_shortfall_minor = max(0, amount_due − amount_received)`, and in the same transaction mark the order `paid`, issue the invoice, create entitlements, post ledger entries and allocations, and queue the customer email. | D-516, D-411, BR-06, US-57 | T-payments, T-orders, T-invoices, T-entitlements, T-ledger_entries, T-allocations, email_outbox |
| FR-PAY-07 | The system shall, when `amount_received > amount_due`, record the excess as `payments.customer_credit_minor`, show it to admins on the order and never allocate it to partners (ledger posts on `amount_due`). | D-516, MASTER_SPEC §7 "Overpayment" | T-payments |
| FR-PAY-08 | The system shall let an admin mark a `submitted` payment `failed` with a reason, keep the order `pending_payment` until expiry, and allow the customer to start a new attempt. | D-416, US-23, US-57 | T-payments, T-orders |
| FR-PAY-09 | The system shall make a payment row immutable once `confirmed`, allowing exactly one later change: the transition `confirmed → refunded` together with `amount_refunded_minor`, written only by the refund apply step. | MASTER_SPEC §4.1, §7 "Payment immutability", docs/05 §12 | T-payments |
| FR-PAY-10 | The system shall issue one invoice per paid order numbered `CK/<FY>/<seq>` gaplessly per Indian financial year under a row lock, in the name "CodeKraft", store the PDF in private storage, and email it. | BR-16, D-414, D-401, US-26 | T-invoices, invoice_sequences, T-media, email_outbox |
| FR-PAY-11 | The system shall render the invoice with a CGST/SGST/IGST breakdown by buyer state only when `site_settings.gstin` is set, and without any GST lines otherwise. | D-1501, BR-08 | T-invoices, site_settings |
| FR-PAY-12 | The system shall let a customer request a refund only through "Request refund" on the order page, which opens a query with `source = order` flagged as a refund request (at most one open per order; email via the invoice contact details remains possible), shall allow the admin to propose a refund only for orders whose product is `is_refundable` and whose payment provider is `manual_*`, and shall execute it only through an applied `refund.issue` approval. | BR-09, D-415, D-505, BR-13, US-41, US-60, MASTER_SPEC §7 "Refund request channel" | T-queries, T-refunds, T-approval_requests |
| FR-PAY-13 | The system shall, on refund apply, write a T-refunds row, issue a credit note numbered per FY, post proportional `refund_*` ledger entries (FR-FIN-05), add the amount to `payments.amount_refunded_minor` and flip the payment `confirmed → refunded` when fully refunded, revoke or task-revoke the entitlement, and set the order to `refunded` or `partially_refunded`. | D-414, D-607, baseline §7, US-60, MASTER_SPEC §7 | T-refunds, credit_notes, T-ledger_entries, T-payments, T-entitlements, T-orders |
| FR-PAY-14 | The system shall, on an admin-recorded chargeback, revoke the entitlement and tag the customer `chargeback` on the profile. | D-416 | T-entitlements, T-customer_profiles |
| FR-PAY-15 | The system shall store on every order and ledger entry the INR FX rate from T-fx_rates for the payment date. | D-515 | T-orders, T-ledger_entries, T-fx_rates |

### 1.5 DEL — entitlements and delivery

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-DEL-01 | The system shall create exactly one entitlement per paid order item, copying `delivery_type`, `update_policy`, `download_cap` and access period from the offering. | A-602, D-605, US-27 | T-entitlements, T-offerings |
| FR-DEL-02 | The system shall dispatch delivery behaviour by `entitlement.delivery_type` through per-type handlers (`saas`, `hosted`, `download`, `license`, `service`, `custom`). | MASTER_SPEC §4.3, docs/04 §7.3 | T-entitlements |
| FR-DEL-03 | The system shall, for `saas`/`hosted` with manual provisioning, open a `provision` task, and mark `provisioning_state = done` with admin notes that are shown to the customer and emailed. | D-601, US-27 | T-delivery_tasks, T-entitlements, notifications |
| FR-DEL-04 | The system shall issue downloads only as presigned GET URLs valid 5 min tied to the entitled user, log every issuance, and increment `downloads_used`. | BR-15, D-602, D-606, US-28 | T-downloads, T-entitlements, T-media |
| FR-DEL-05 | The system shall refuse a download when `downloads_used ≥ download_cap` and offer a one-click query to request a reset, which an admin performs by setting `downloads_used = 0` with an audit row. | D-606, US-28 | T-entitlements, T-queries, T-audit_logs |
| FR-DEL-06 | The system shall hide downloads and keys for entitlements not in `active`. | D-605, D-607 | T-entitlements |
| FR-DEL-07 | The system shall store license keys encrypted at rest, reveal them only inside the authenticated dashboard (masked with an audited reveal control), and send an email plus in-app notification that carry a link to the dashboard and never the key itself (no SMS; the founder may relax this to plaintext email). | D-603, D-406, D-1002, US-29, MASTER_SPEC §7 "License key delivery" | T-entitlements, notifications, email_outbox |
| FR-DEL-08 | The system shall create service-progress rows from the offering's `service_steps`, let admins tick steps with notes, show progress to the customer, and set the order `fulfilled` when all steps are done. | D-608, US-30 | T-service_progress, T-orders |
| FR-DEL-09 | The system shall show the offering's `instructions_json` (fallback: product text) on the order page and in the confirmation email for every delivery type. | A-601, US-31 | T-offerings, T-orders |
| FR-DEL-10 | The system shall expire entitlements whose `access_ends_at` has passed via cron and apply the update policy (`all_free`, `during_access`, `major_paid`) when listing release files. | D-604, D-605, US-32 | T-entitlements, T-release_files |
| FR-DEL-11 | The system shall on revocation set platform-controlled entitlements to `revoked` immediately and, for external SaaS/hosted accounts, create a `revoke_external` task and email admins daily until done. | D-607, US-33 | T-entitlements, T-delivery_tasks, email_outbox |
| FR-DEL-12 | The system shall let a Super Admin manually grant or revoke an entitlement for a customer with a mandatory reason, recording `granted_manually_by` (with `order_item_id` null — no synthetic order) or `revoke_reason`, writing an audit row, notifying the other admins in-app, and never posting ledger entries or allocations; manual grants are not dual-approved. | D-1108, US-72, MASTER_SPEC §7 "Manual entitlement grants" | T-entitlements, T-audit_logs, notifications |
| FR-DEL-13 | The system shall create a subscription sub-record for subscription offerings with `current_period_start/end` and `trialing` status when `trial_days > 0`. | D-503, BR-14 | T-subscriptions |
| FR-DEL-14 | The system shall send one renewal reminder 7 days (proposed) before `current_period_end`, set the subscription `past_due` with `grace_until = period_end + 7 days` when unpaid while the entitlement stays `active`, and set both subscription and entitlement `suspended` when grace passes. | BR-14, D-521, US-34, US-35, MASTER_SPEC §7 "Subscription grace" | T-subscriptions, T-entitlements, notifications |
| FR-DEL-15 | The system shall create a renewal order for the same offering on "Renew" with `expires_at` equal to the subscription's `grace_until` (so BR-10 and BR-14 coincide) and, on confirmation, roll the period forward by one interval and restore `active`. | D-1004, US-34, MASTER_SPEC §7 "Renewal order expiry" | T-orders, T-subscriptions |
| FR-DEL-16 | The system shall on cancel set `cancel_at_period_end = true`, stop reminders, and at period end set subscription `cancelled` and entitlement `expired`, with no proration. | BR-14, D-521, US-36 | T-subscriptions, T-entitlements |

### 1.6 FIN — ledger, allocations, payouts, expenses, reports

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-FIN-01 | The system shall post, per paid order item, ledger entries `sale`, `discount`, `tax_collected`, `gateway_fee`, `bank_charge`, `company_cut` and one `partner_allocation` per ownership line, in the transaction currency with INR equivalent. | D-507, D-515, D-516, BR-06 | T-ledger_entries |
| FR-FIN-02 | The system shall compute `distributable = gross − discount − tax − gateway_fee − bank_shortfall`, `company = distributable × company_cut_bps / 10000`, and partner amounts as `(distributable − company) × share_bps / 10000` using largest-remainder rounding in minor units (floor each line, then distribute the leftover minor units one at a time to the lines with the largest fractional remainders; ties → earliest partner row) so the lines sum exactly to the distributable amount. | BR-06, D-508, MASTER_SPEC §7 "Split rounding" | T-allocations |
| FR-FIN-03 | The system shall write one immutable T-allocations row per order item mirroring the entries, and shall guarantee `company + Σ partner = distributable` exactly. | D-006, BR-05 | T-allocations |
| FR-FIN-04 | The system shall reject any UPDATE or DELETE on T-ledger_entries, T-allocations, T-payouts, T-invoices, credit_notes and confirmed T-payments at the database level. | BR-17, MASTER_SPEC §4.1 | all listed |
| FR-FIN-05 | The system shall post refund reversals as negative-direction `refund_sale`, `refund_discount`, `refund_tax`, `refund_company_cut` and `refund_partner_allocation` entries proportional to the refunded fraction; `gateway_fee` and `bank_charge` entries are never reversed. | baseline §7, R-005, MASTER_SPEC §7 "Refund reversal scope", docs/05 §7 | T-ledger_entries, T-refunds |
| FR-FIN-06 | The system shall compute each partner's balance as Σ partner_allocation − Σ refund_partner_allocation − Σ payout − Σ expense share, per currency and in INR, via the `partner_balances` view. | D-511, D-514 | partner_balances |
| FR-FIN-07 | The system shall record a payout (partner, amount, date, reference, note) only through an applied `payout.record` approval, posting one `payout` entry, and shall reject at request time any payout larger than the partner's current balance in that currency (no overdraw override). | D-511, D-1105, US-62, MASTER_SPEC §7 "Payout > balance" | T-payouts, T-ledger_entries, T-approval_requests |
| FR-FIN-08 | The system shall let an admin record an expense with optional product, receipt and `shared_by_split`, posting `expense` entries split by the product's active ownership when shared, else company-only. | D-514, US-63 | T-expenses, T-ledger_entries |
| FR-FIN-09 | The system shall post ledger adjustments only through an applied `ledger.adjustment` approval as new `adjustment` entries referencing the request. | BR-17, D-517, US-64 | T-ledger_entries, T-approval_requests |
| FR-FIN-10 | The system shall provide reports for revenue by product, by partner and by period, tax collected, refunds and outstanding payouts, in INR with transaction-currency detail. | D-513, US-65 | T-ledger_entries, T-allocations |
| FR-FIN-11 | The system shall export a partner statement for a period as PDF and CSV listing every entry affecting that partner and opening/closing balances. | D-513, US-65 | T-ledger_entries, T-payouts |
| FR-FIN-12 | The system shall show an Admin-role user only entries, balances, reports and statements for their own partner record, and Super Admins everything. | D-512, D-1103 | T-partners, T-ledger_entries |
| FR-FIN-13 | The system shall refresh daily FX rates for INR↔{USD, EUR, GBP, CAD} via cron, allow admin override, and warn admins when the newest rate is older than 3 days. | D-515, D-518, docs/04 §10 | T-fx_rates, notifications |
| FR-FIN-14 | The system shall compute product profit as Σ sale − discount − refunds − Σ expenses linked to the product, per period. | D-514 | T-ledger_entries, T-expenses |

### 1.7 LEAD — leads and queries

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-LEAD-01 | The system shall create a lead from the inquiry form, product CTA, chatbot and manual entry with the matching `source` and optional `product_id`, `user_id`, `service_interest`. | D-704, D-315, US-05, US-17, US-50 | T-leads |
| FR-LEAD-02 | The system shall accept public inquiry submissions only after invisible captcha verification and within rate limits, storing `turnstile_verified`. | D-1204, US-05 | T-leads |
| FR-LEAD-03 | The system shall place new leads and queries in a shared unassigned pool and let any admin claim or assign them, writing an activity row. | D-705, US-47 | T-leads, lead_activities, T-queries |
| FR-LEAD-04 | The system shall allow lead status transitions only along New → Contacted → Qualified → Proposal → Won | Lost, with any state → Lost requiring `lost_reason`. | D-703, US-48 | T-leads, lead_activities |
| FR-LEAD-05 | The system shall store notes, priority and `next_follow_up_at` per lead, flag overdue follow-ups in admin widgets, and email each admin a daily digest of their overdue leads. | D-706, R-701, US-49 | T-leads, email_outbox |
| FR-LEAD-06 | The system shall let a Won lead link to `won_order_id` for conversion tracking. | D-703, spec §10 | T-leads, T-orders |
| FR-LEAD-07 | The system shall create a query from the dashboard, an order page, the visitor form or a chatbot escalation, or by an admin on a customer's behalf (`source = email` for a request received via the invoice contact details, `manual` otherwise), with source, optional order/product and thread messages. | D-702, US-41, US-46, docs/05 T-queries | T-queries, query_messages |
| FR-LEAD-08 | The system shall notify the customer by email + in-app on every admin reply and flip status `open ↔ waiting_customer` by author kind. | D-702, D-1002, US-42 | T-queries, notifications |
| FR-LEAD-09 | The system shall auto-close `resolved` queries after 7 days (proposed) without a customer reply and let a customer reopen a `resolved` query. | US-42 | T-queries |
| FR-LEAD-10 | The system shall show an Admin-role user only leads assigned to them by default, and Super Admins all leads. | D-512 | T-leads |
| FR-LEAD-11 | The system shall retain leads 7 years and never delete them on customer account deletion. | D-1503, BR-18 | T-leads |

### 1.8 CHAT — hybrid chatbot

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-CHAT-01 | The system shall require a logged-in customer to open the chatbot and show visitors a login prompt plus inquiry-form link. | D-205, BR-03, US-43 | T-conversations |
| FR-CHAT-02 | The system shall answer menu intents (order status, my downloads, contact support) from the user's own records without calling the LLM. | D-701, US-43 | T-orders, T-entitlements |
| FR-CHAT-03 | The system shall answer free text only from top-8 T-knowledge_chunks retrieved by full-text rank, with a system prompt forbidding answers outside the provided context, streamed via SSE, max 600 output tokens, 20 s timeout. | D-701, docs/04 §9, US-44 | knowledge_chunks, chat_messages |
| FR-CHAT-04 | The system shall check T-chat_usage_daily for the user and for `platform` before every LLM call and fall back to menus when either cap (`site_settings.ai_daily_user_cap`, `ai_daily_platform_cap`) is reached, notifying admins once per day for the platform cap. | D-708, US-45 | chat_usage_daily, site_settings, notifications |
| FR-CHAT-05 | The system shall escalate a conversation to a query with the transcript attached on user request or when the bot cannot answer, and create a lead on confirmed project intent. | D-702, D-704, US-46 | T-queries, T-leads, T-conversations |
| FR-CHAT-06 | The system shall rebuild T-knowledge_chunks on content publish and nightly from products, offerings, services, FAQs, legal pages and case studies. | docs/04 §9 | knowledge_chunks |
| FR-CHAT-07 | The system shall call the LLM through an `LLMProvider` interface with the model ID read from `site_settings.ai_model`, and fall back to a menu answer on `stop_reason = refusal` or provider error. | ADR-08, docs/04 §9 | site_settings, prompt_versions |
| FR-CHAT-08 | The system shall version system prompts, let admins view, edit, activate and roll back, and record the prompt version on each conversation. | spec §12, docs/04 §9 | prompt_versions, T-conversations |
| FR-CHAT-09 | The system shall purge conversations and messages 12 months after `started_at` via cron. | D-1503, BR-18 | T-conversations, chat_messages |
| FR-CHAT-10 | The system shall record chatbot started, escalated and lead-captured analytics events. | D-1302 | analytics_events |

### 1.9 CONT — content management

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-CONT-01 | The system shall let Super Admins edit landing chapters (copy, media, CTA, featured products), services, case studies, testimonials, client logos, FAQs and legal pages without code changes. | D-1106, US-66 | landing_chapters, services, case_studies, testimonials, client_logos, faqs, legal_pages, featured_products |
| FR-CONT-02 | The system shall store rich text as Tiptap JSON and render it server-side through an allow-list sanitizer. | ADR-10, A-1202 | all body_json columns |
| FR-CONT-03 | The system shall revalidate affected public pages within 60 s of a content save or publish. | docs/04 §6, US-66 | — |
| FR-CONT-04 | The system shall version legal pages, incrementing `version` and `published_at` on publish, and serve only the latest published version. | D-807, US-07 | legal_pages |
| FR-CONT-05 | The system shall allow at most one blog per product, with draft/published status, own slug, cover and SEO fields. | D-121, D-804, US-67 | T-product_blogs |
| FR-CONT-06 | The system shall validate uploads by MIME allow-list and size (images ≤ 10 MB, PDF ≤ 25 MB, video ≤ 200 MB, attachments ≤ 100 MB — proposed) and store them privately with presigned access. | A-1202, A-1402, US-52 | T-media, files_upload_intents |
| FR-CONT-07 | The system shall support demo video as external embed (YouTube/Vimeo) or uploaded file, embed-first. | D-309, A-1402 | T-product_media |
| FR-CONT-08 | The system shall require a non-empty `alt` on every product image (`product_media.alt`) and store a `blur_hash` on `media` at upload for placeholder rendering. | A-1301, D-907, docs/05 T-product_media, T-media | T-product_media, T-media |

### 1.10 ADM — admin operations, approvals, audit, settings

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-ADM-01 | The system shall implement one generic approval request with types `product.publish`, `ownership.change`, `ledger.adjustment`, `refund.issue`, `payout.record`, `product.archive`, `product.delete`, `admin.user_change`, `project_order.split`. | A-1101, D-1105, BR-13, MASTER_SPEC §7 "Project order splits" | T-approval_requests |
| FR-ADM-02 | The system shall require a decision from every active user holding `super_admin` or `admin` other than the requester (with two founders: the other one) before a request is `approved`, reject the request on any single `reject`, refuse a decision by the requester at the database level, and shall be unable to apply any request while no such approver exists. | BR-12, BR-13, D-1102, MASTER_SPEC §4.5, §7 "Approver set" | T-approval_requests, approval_decisions |
| FR-ADM-03 | The system shall, on the final approval, execute the owning module's apply function in one transaction, set `applied`, and on failure store `error` and keep `approved` for retry. | docs/04 §7.4, US-56 | T-approval_requests |
| FR-ADM-04 | The system shall let the requester cancel a `pending` request, and shall never expire requests automatically. | docs/04 §13 | T-approval_requests |
| FR-ADM-05 | The system shall move a product Draft → Pending Approval on submit, → Published or Scheduled on approval, Scheduled → Published by cron at `publish_at`, Published ↔ Unpublished without approval, and → Archived only via approval. | A-302, D-305–D-307, BR-12, US-54, US-55 | T-products |
| FR-ADM-06 | The system shall permit delete only for products with zero order items, via `product.delete` approval; otherwise offer archive only. | BR-11, D-308, US-55 | T-products, T-order_items |
| FR-ADM-07 | The system shall write an audit row (actor, role, action, subject, before, after, IP, user agent, request ID) inside the same transaction as every admin domain mutation; read-only Server Actions (widget loaders, list queries) are exempt, and Better Auth's own auth events are audited by hooks immediately after the auth transaction. | D-1104, MASTER_SPEC §4.9, §7 "Audit atomicity" | T-audit_logs |
| FR-ADM-08 | The system shall provide an audit screen filterable by actor, action, subject type/ID and period, with CSV export, and no edit or delete. | D-1104, US-73 | T-audit_logs |
| FR-ADM-09 | The system shall let Super Admins edit site settings (base currency, tax rate, GSTIN, seller details, UPI VPA, bank details, enabled methods, default theme, AI model and caps, retention, feature flags) effective immediately. | D-502, D-504, D-1501, D-905, D-708, US-71 | site_settings |
| FR-ADM-10 | The system shall make `site_settings.base_currency` read-only after the first paid order. | D-502, MASTER_SPEC §7 "Base currency lock" | site_settings, T-orders |
| FR-ADM-11 | The system shall let Super Admins add notes/tags, suspend/unsuspend, and send reset or one-time login links for a customer, each audited. | D-1108, US-72 | T-customer_profiles, T-users |
| FR-ADM-12 | The system shall process admin invite, removal and role change only via `admin.user_change` approval, refuse removal of the last `super_admin`, and warn on the admin-users screen whenever fewer than two active admin-class users exist (dual-approval actions cannot execute until a second one does). | D-1105, D-114, US-74, MASTER_SPEC §7 "Approver set" | T-user_roles, T-partners, T-approval_requests |
| FR-ADM-13 | The system shall provide an operations queue listing payments awaiting confirmation, provisioning tasks, revoke tasks, service checklists due and pending approvals, sorted by age. | D-1101, D-707 | T-payments, T-delivery_tasks, T-service_progress, T-approval_requests |
| FR-ADM-14 | The system shall register 18–20 dashboard widgets with group, default/min size, permission and data loader, and persist each admin's layout independently. | D-120, D-1101, US-68 | dashboard_layouts |
| FR-ADM-15 | The system shall confine Admin-role users to their own products, their own share and their assigned leads by default. | D-512 | T-partners, T-products, T-leads |

### 1.11 DASH — customer dashboard

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-DASH-01 | The system shall provide sections Profile, Settings, Security, Notifications, Purchases & Access, Invoices & Payment history, Queries & Conversations and Wishlist. | D-1001, US-37 | T-users, T-customer_profiles |
| FR-DASH-02 | The system shall show per order its status, latest payment status and one next action (submit reference / awaiting confirmation / retry / download / renew / view instructions). | D-1001, D-416, US-37 | T-orders, T-payments, T-entitlements |
| FR-DASH-03 | The system shall list every invoice and credit note as PDF download and every payment attempt with method, reference, amount, status and timestamps. | D-414, US-38 | T-invoices, credit_notes, T-payments |
| FR-DASH-04 | The system shall let the customer set display currency and theme, persisting to the account and the device. | D-111, D-905, US-39 | T-users |
| FR-DASH-05 | The system shall let the customer change password (ending other sessions) and view the active session. | D-1203, US-39 | sessions |
| FR-DASH-06 | The system shall show subscription next due date, grace deadline, Renew and Cancel controls per subscription. | D-1004, US-34, US-36 | T-subscriptions |
| FR-DASH-07 | The system shall show service checklist progress (n/m, per-step status) for `service` entitlements. | D-608, US-30 | T-service_progress |
| FR-DASH-08 | The system shall let the customer delete the account, set `status = deleted`, `deleted_at` and `anonymized_at`, end sessions immediately, and anonymise personal fields immediately in the same transaction (no grace window) while retaining orders, invoices, ledger and audit rows. | BR-18, D-1003, US-40, MASTER_SPEC §7 "Anonymisation timing" | T-users, T-customer_profiles |
| FR-DASH-09 | The system shall poll for order, payment and notification changes every 30 s while the dashboard is open. | docs/04 §7.5 | notifications |
| FR-DASH-10 | The system shall record download history (date, file, version) per entitlement for the customer's view. | BR-15 | T-downloads |

### 1.12 NOTIF — notifications

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-NOTIF-01 | The system shall write customer notifications in-app and queue an email, honouring `customer_profiles.notification_prefs` (order and delivery updates always on), for: verification, reset, payment submitted/confirmed/failed, order expired, invoice, provisioning done, key delivered, service step done, order fulfilled, renewal reminder, past due, suspended, cancelled, query reply, refund/credit note, account deletion. | D-1002, US-69 | notifications, email_outbox |
| FR-NOTIF-02 | The system shall deliver admin notifications in-app only, persisted until read, for: payment awaiting confirmation, new lead, new query, customer reply, approval pending/decided, provisioning task, revoke task, AI cap reached, FX stale, cron failure. | D-707, D-015, US-70 | notifications |
| FR-NOTIF-03 | The system shall poll admin notifications every 10 s with focus refetch and show badge and toast on new rows. | docs/04 §7.5 | notifications |
| FR-NOTIF-04 | The system shall send admins one daily digest email of overdue lead follow-ups and open revoke-external tasks, and no other admin email. | D-706, D-707, R-701, D-607 | email_outbox |
| FR-NOTIF-05 | The system shall retry failed emails from T-email_outbox up to 5 times (proposed) with exponential backoff and surface persistent failures on the system widget. | docs/04 §10 | email_outbox, job_runs |
| FR-NOTIF-06 | The system shall route channels through a pluggable channel interface (`inapp`, `email`, `whatsapp` behind flag) with no SMS or push channel in release 1. | D-1604, D-1002, X-012 | notifications |

### 1.13 SEO

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-SEO-01 | The system shall server-render every public route (`/`, `/services`, `/products*`, `/projects*`, `/blog*`, `/contact`, `/legal/*`) with complete HTML before hydration. | A-1301, MASTER_SPEC §4.10 | — |
| FR-SEO-02 | The system shall emit per-page title, meta description, canonical, OG and Twitter cards from admin SEO fields with sensible fallbacks. | A-1301, spec §13 | T-products, T-product_blogs, case_studies |
| FR-SEO-03 | The system shall emit JSON-LD Organization (site), Product (product pages), Article (blogs, case studies) and BreadcrumbList. | A-1301 | — |
| FR-SEO-04 | The system shall generate `sitemap.xml` (excluding unlisted products, drafts, auth, checkout, account and admin routes) and `robots.txt` disallowing `/auth`, `/checkout`, `/account`, `/admin`, `/api`. | A-801, D-314, MASTER_SPEC §7 "Auth and checkout URLs" | T-products |
| FR-SEO-05 | The system shall serve images through the framework optimizer with explicit dimensions, and generate OG images at `/api/og/*`. | A-1301, D-1303 | T-media |
| FR-SEO-06 | The system shall record built-in analytics events with anonymous IDs and integrate Umami without cookies requiring consent. | D-1301, D-1302, A-1501 | analytics_events |
| FR-SEO-07 | The system shall, when the slug of a published product, case study or blog changes, keep the old slug in `slug_redirects` and serve it as a 301 to the new URL. | MASTER_SPEC §7 "Slug changes", docs/05 T-slug_redirects | T-slug_redirects |

### 1.14 PERF, SEC, A11Y, OPS

| ID | Requirement | Source | Tables |
|----|-------------|--------|--------|
| FR-PERF-01 | The system shall lazy-load the WebGL hero after first paint via IntersectionObserver and skip it entirely on mobile viewports, reduced-motion or missing WebGL. | D-904, D-907, D-1605 | — |
| FR-PERF-02 | The system shall cache public reads with ISR (60–3600 s) and tag invalidation so the database is not on the first-paint path. | docs/04 §6, §13 | — |
| FR-SEC-01 | The system shall rate-limit login, OTP, signup, inquiry/query forms, chatbot and downloads per IP and per account (limits in NFR-SEC-03). | D-1204 | — |
| FR-SEC-02 | The system shall verify Cloudflare Turnstile on every public form and fail closed. | D-1204, docs/04 §10 | — |
| FR-SEC-03 | The system shall hash passwords with argon2id (Better Auth configured explicitly; its scrypt default is not used), enforce HTTPS, CSRF protection on mutations, output encoding, parameterised queries and secrets only from the environment. | A-1202 | — |
| FR-SEC-04 | The system shall keep all uploaded and generated files in private buckets accessed only through presigned URLs, except media explicitly marked `public`. | D-602, A-1202 | T-media |
| FR-SEC-05 | The system shall encrypt license keys and partner bank details at rest with a key from the environment. | D-603, docs/05 §1 | T-entitlements, T-partners |
| FR-A11Y-01 | The system shall meet WCAG 2.1 AA on all pages in both themes, with visible focus, keyboard operability, labelled forms and ≥ 4.5:1 text contrast. | D-907 | — |
| FR-A11Y-02 | The system shall disable all motion-based animation and scroll effects when `prefers-reduced-motion: reduce` is set; opacity crossfades of ≤ 200 ms for state changes remain. | D-907, MASTER_SPEC §7 "Reduced motion" | — |
| FR-OPS-01 | The system shall run cron jobs (order and quote expiry, subscription reminders/grace/suspend, scheduled publish, entitlement expiry, retention purge, FX refresh, knowledge re-index, email retry, backups check) idempotently through two consolidated secret-protected endpoints, `/api/cron/frequent` (every 15 min) and `/api/cron/daily`, fired by a GitHub Actions scheduler on Vercel Hobby, Vercel Cron on Pro, or `node-cron` in a container, and record each run. | docs/04 §4, §6, docs/12 §2.3, MASTER_SPEC §7 "Cron on free tier" | job_runs |
| FR-OPS-02 | The system shall run identically on Vercel and in a Node 22 container with no Vercel-only primitive in domain modules. | D-1401, D-1606 | — |
| FR-OPS-03 | The system shall gate phone OTP, WhatsApp, each gateway provider, Theme 2, automated provisioning, the 3D hero (kill switch), bundles and the vendor marketplace behind feature flags (`phone_otp`, `whatsapp_channel`, `provider_razorpay`, `provider_stripe`, `provider_paypal`, `theme_light_editorial`, `automated_provisioning`, `three_hero`, `bundles`, `vendor_marketplace`) in site settings with env overrides. | MASTER_SPEC §4.11, docs/04 §7.9 | site_settings |
| FR-OPS-04 | The system shall seed roles, permissions, two Super Admins/partners, five example products, content and settings as data only. | D-018, docs/05 §14 | all |
| FR-OPS-05 | The system shall run unit, integration and e2e suites in CI on every push and block merge on failure, Lighthouse and axe budgets. | D-1607, D-1404 | — |

## 2. Non-functional requirements

| ID | Requirement | Target | Source |
|----|-------------|--------|--------|
| NFR-PERF-01 | Core Web Vitals on every public page, mid-range mobile (Moto G class, slow 4G) | LCP < 2.5 s, INP < 200 ms, CLS < 0.1; CI cannot measure INP, so Lighthouse Total Blocking Time ≤ 300 ms is the lab proxy and field INP arrives via `web-vitals` → `analytics_events` | D-1303, MASTER_SPEC §7 "INP measurement" |
| NFR-PERF-02 | Public page JS on first load (excluding lazy 3D bundle) | ≤ 200 KB gzipped (proposed) | D-1303 |
| NFR-PERF-03 | 3D hero bundle | Loaded after LCP; ≤ 600 KB gzipped (proposed); never on mobile | D-904, D-1605 |
| NFR-PERF-04 | Admin and account page interactive | TTI ≤ 3 s on desktop broadband (proposed) | — |
| NFR-PERF-05 | Server Action p95 latency (non-PDF) | ≤ 800 ms warm; PDF generation ≤ 5 s (proposed) | — |
| NFR-PERF-06 | Chatbot first token | ≤ 3 s p95; hard timeout 20 s | docs/04 §9 |
| NFR-SEC-01 | Session idle timeout | Admin 30 min, customer 60 min; absolute max 7 days (proposed) | D-1203 |
| NFR-SEC-02 | Password policy | ≥ 10 chars, breached-password check (proposed) | A-1202 |
| NFR-SEC-03 | Rate limits (proposed; canonical values, mirrored verbatim in docs/06 §1.7 and docs/09 §7) | Login 10/15 min per IP and 5/15 min per account (lock 15 min); TOTP verify 5/5 min per session; signup 5/h per IP; verification resend 3/h per email; reset 3/h per email and 10/h per IP; phone OTP 5/h per phone and 10/h per IP; inquiry/contact/product-CTA/visitor-query form 5/h per IP (+ Turnstile); chatbot 30 messages/10 min per user plus daily caps; download issuance 20/h per user plus cap per entitlement; license key reveal 10/h per user; checkout (create order, submit reference) 10/day per user; coupon validation 10/10 min per user; quote token lookup 10/h per IP; upload intents 30/h per user; notification poll 30/min per session; admin actions 300/min per user; analytics ingest 120/min per anon/user; cron endpoints 1 concurrent per job | D-1204 |
| NFR-SEC-04 | Signed download URL lifetime | 5 min | docs/04 §6 |
| NFR-SEC-05 | Verification / reset / quote link lifetimes | Verify 24 h, reset 60 min, one-time login 15 min, quote per admin-set `expires_at` (proposed) | D-1201, D-520 |
| NFR-SEC-06 | Encryption | TLS 1.2+; AES-256-GCM at rest for license keys and bank details (proposed) | A-1202 |
| NFR-SEC-07 | Admin subdomain headers | HSTS, CSP without `unsafe-inline` for scripts, `frame-ancestors 'none'` (proposed) | A-1201 |
| NFR-SEC-08 | Audit completeness | 100 % of admin mutations and auth events audited (tested) | D-1104 |
| NFR-DATA-01 | Retention | Chat transcripts 12 months; leads, orders, invoices, ledger, audit 7 years; deleted users anonymised immediately on self-delete | BR-18, D-1503, MASTER_SPEC §7 |
| NFR-DATA-02 | Backups | Nightly encrypted `pg_dump` to R2 with 7-day retention (Neon Free PITR is hours only), weekly off-site copy; restore tested before launch | A-1401, MASTER_SPEC §7 "Backups" |
| NFR-DATA-03 | Money precision | Integer minor units; FX `numeric(18,8)`; no float anywhere in money paths (lint rule) | MASTER_SPEC §4.8 |
| NFR-DATA-04 | Ledger invariant | For every order item: gross − discount − tax − gateway − bank_charge = company + Σ partner, verified by property tests and a nightly reconciliation job | BR-06, docs/04 §13 |
| NFR-AVAIL-01 | Availability (interim free tiers) | Best effort; uptime ping every 5 min; admins alerted in-app on ≥ 2 consecutive failures (proposed) | A-1401 |
| NFR-AVAIL-02 | External dependency failure | R2/Resend/LLM/FX failures degrade gracefully per docs/04 §10; only Postgres is fatal | docs/04 §10 |
| NFR-SCALE-01 | Design envelope | 1–30 orders/year, < 50 products, ≤ 5 admins, ≤ 10k customers, ≤ 1k chat messages/day without redesign | D-107, A-304 |
| NFR-RT-01 | Admin "real-time" | New notification visible ≤ 10 s; customer ≤ 30 s | D-015, D-707, docs/04 §7.5 |
| NFR-A11Y-01 | Accessibility | WCAG 2.1 AA; zero critical/serious axe violations in CI; reduced-motion honoured | D-907 |
| NFR-COMPAT-01 | Browsers | Last 2 versions of Chrome, Edge, Firefox, Safari desktop and iOS Safari | D-1304 |
| NFR-RESP-01 | Responsive breakpoints | 360, 768, 1024, 1440, 1920, 2560+ px deliberately designed (proposed) | D-012 |
| NFR-THEME-01 | Theming | Zero component code branches on theme name; both themes pass A11Y on the same components | D-011, MASTER_SPEC §4.6 |
| NFR-PORT-01 | Portability | Same build runs on Vercel and in Docker; switch ≤ 1 day | D-1401, D-1606 |
| NFR-OPS-01 | CI gates | Unit + integration + e2e + Lighthouse + axe on every push; no manual step | D-1607 |
| NFR-OPS-02 | Email volume | ≤ 3 000/month on Resend free tier; digest batching keeps admin mail ≤ 2/day | D-1403 |
| NFR-OPS-03 | Storage | ≤ 10 GB R2; uploaded video capped per FR-CONT-06; embed-first | R-1402, A-1402 |
| NFR-AI-01 | AI cost control | Daily platform and per-user caps enforced before every call; default caps 200/day platform, 20/day per user (proposed) | D-708 |
| NFR-I18N-01 | Currencies | INR base; USD, EUR, GBP, CAD display; charge in base | D-502, D-518 |
| NFR-LEGAL-01 | Invoice numbering | Gapless per Indian FY; verified by test that concurrent confirmations never skip or duplicate | BR-16 |

## 3. State machines

### 3.1 Order status (T-orders) — D-411

| From | To | Trigger | Guard / side effects |
|------|----|---------|----------------------|
| — | pending_payment | Buy now / quote accept / manual order create | `expires_at = +7 d`; payment `initiated` |
| pending_payment | paid | Admin confirms payment | Invoice, entitlements, ledger, allocations in one txn |
| pending_payment | cancelled | Customer or admin cancel | Reason stored; customer emailed |
| pending_payment | failed | Expiry cron: `expires_at` passed with no confirmed payment (incl. after an admin marked the reference invalid and no retry followed) | Open payments `failed('expired')`; customer emailed. A failed *payment* before expiry leaves the order `pending_payment` for retry (D-416, MASTER_SPEC §7) |
| paid | fulfilled | Every entitlement the order created is `active` and every service checklist on it is complete (manual SaaS `provisioning_state` is tracked separately and does not block `active`) | `fulfilled_at` (MASTER_SPEC §7 "Order fulfilled") |
| paid / fulfilled | partially_refunded | Refund approval applied, amount < total | Credit note; reversal entries |
| paid / fulfilled / partially_refunded | refunded | Refund approval applied, cumulative = total | Entitlement revoked |

### 3.2 Payment status (T-payments)

| From | To | Trigger |
|------|----|---------|
| — | initiated | Method chosen; instructions generated |
| initiated | submitted | Customer submits reference |
| submitted | confirmed | Admin confirms with amount received (immutable after) |
| submitted | failed | Admin rejects with reason |
| initiated | failed | Order expires |
| confirmed | refunded | Refund apply when cumulative `amount_refunded_minor` = amount confirmed; the only permitted post-confirmation change (trigger also allows `amount_refunded_minor`) |

### 3.3 Product status (T-products) — A-302

| From | To | Trigger | Approval |
|------|----|---------|----------|
| — | draft | Create | — |
| draft / unpublished | pending_approval | Submit (needs offering, base price, active ownership) | creates `product.publish` |
| pending_approval | draft | Rejected or cancelled | — |
| pending_approval | published | Approved, `publish_at` null or past | applied |
| pending_approval | scheduled | Approved, `publish_at` future | applied |
| scheduled | published | Cron at `publish_at` | — |
| published | unpublished | Admin unpublish | none |
| any except archived | archived | `product.archive` applied | required |
| any with zero order items | (deleted) | `product.delete` applied | required |

`is_coming_soon` is a flag on a published product, not a status.

### 3.4 Entitlement status (T-entitlements)

| From | To | Trigger |
|------|----|---------|
| — | pending | Created before provisioning (saas/hosted) |
| — / pending | active | Order paid (download, license, service, custom) or provisioning done; manual SaaS provisioning marks `provisioning_state` separately |
| active | suspended | Subscription grace expired; admin suspend |
| suspended | active | Renewal confirmed; admin unsuspend |
| active | expired | `access_ends_at` passed; subscription cancelled at period end |
| active / suspended / expired | revoked | Refund, chargeback, manual revoke |

### 3.5 Subscription status (T-subscriptions) — BR-14

| From | To | Trigger |
|------|----|---------|
| — | trialing | Paid with `trial_days > 0` |
| trialing / — | active | Trial ends / paid without trial |
| active | past_due | `current_period_end` passed unpaid; `grace_until = +7 d` |
| past_due | active | Renewal confirmed |
| past_due | suspended | `grace_until` passed |
| suspended | active | Renewal confirmed (new period starts at confirmation) |
| active / past_due | cancelled | `cancel_at_period_end` reached, or admin cancel |

### 3.6 Lead status (T-leads) — D-703

| From | To | Guard |
|------|----|-------|
| new | contacted | — |
| contacted | qualified | — |
| qualified | proposal | — |
| proposal | won | optional `won_order_id` |
| any | lost | `lost_reason` required |
| lost | new | Admin reopen (audited) (proposed) |

### 3.7 Approval request status (T-approval_requests)

| From | To | Trigger |
|------|----|---------|
| — | pending | Requester submits |
| pending | approved | Last required approver approves |
| pending | rejected | Any approver rejects |
| pending | cancelled | Requester cancels |
| approved | applied | Module apply succeeds (same txn as final approval; retry if `error`) |

### 3.8 Query status (T-queries)

| From | To | Trigger |
|------|----|---------|
| — | open | Customer/visitor/chatbot creates |
| open | waiting_customer | Admin replies |
| waiting_customer | open | Customer replies |
| open / waiting_customer | resolved | Admin resolves |
| resolved | open | Customer replies within 7 d |
| resolved | closed | Cron after 7 d (proposed) or admin closes |

### 3.9 Custom quote status (T-custom_quotes) — D-520

draft → sent → accepted → paid; sent → expired (cron at `expires_at`); draft/sent → cancelled (admin).

## 4. Traceability: business rules → functional requirements

| BR | FR IDs |
|----|--------|
| BR-01 | FR-CAT-15 |
| BR-02 | FR-CAT-09 |
| BR-03 | FR-AUTH-02, FR-COM-02, FR-CHAT-01, FR-LEAD-02 |
| BR-04 | FR-AUTH-05, FR-AUTH-09 (no team seats: X-004) |
| BR-05 | FR-CAT-12, FR-COM-12, FR-FIN-03 |
| BR-06 | FR-COM-04, FR-FIN-01, FR-FIN-02, NFR-DATA-04 |
| BR-07 | FR-CAT-12 |
| BR-08 | FR-COM-04, FR-PAY-11 |
| BR-09 | FR-PAY-12, FR-PAY-13 |
| BR-10 | FR-COM-01, FR-COM-05, FR-COM-06 |
| BR-11 | FR-ADM-06 |
| BR-12 | FR-ADM-02, FR-ADM-05 |
| BR-13 | FR-ADM-01, FR-ADM-02, FR-COM-11, FR-FIN-07, FR-FIN-09, FR-PAY-12, FR-ADM-12 |
| BR-14 | FR-DEL-13–FR-DEL-16, FR-DASH-06 |
| BR-15 | FR-DEL-04, FR-DEL-05, FR-DASH-10, NFR-SEC-04 |
| BR-16 | FR-PAY-10, NFR-LEGAL-01 |
| BR-17 | FR-FIN-04, FR-FIN-09, FR-PAY-09 |
| BR-18 | FR-DASH-08, FR-CHAT-09, FR-LEAD-11, NFR-DATA-01 |

PRD coverage: US-01–US-07 → CAT/CONT/SEO/PERF; US-08–US-12 → AUTH; US-13–US-17 → CAT; US-18–US-26 → COM/PAY; US-27–US-36 → DEL; US-37–US-40 → DASH; US-41–US-46 → LEAD/CHAT; US-47–US-50 → LEAD; US-51–US-56 → CAT/ADM; US-57–US-60 → PAY/COM; US-61–US-65 → FIN; US-66–US-67 → CONT; US-68 → ADM-14; US-69–US-70 → NOTIF; US-71–US-74 → ADM; US-75–US-77 → V1.1/V2 (FR-PAY-01, FR-OPS-03).

## 5. Edge cases and failure scenarios

| Area | Scenario | Required behaviour | FR |
|------|----------|--------------------|----|
| AUTH | Google email matches an existing unverified password account | Link and mark verified; audit | FR-AUTH-03 |
| AUTH | Admin loses authenticator | Backup code; if none, other Super Admin disables TOTP via `admin.user_change` approval | FR-AUTH-07, FR-ADM-12 |
| AUTH | Login from second device during checkout | First device loses session; order persists and is resumable | FR-AUTH-05 |
| CAT | Product submitted with offering lacking base price | Submit refused with field-level error | FR-CAT-03 |
| CAT | Category deleted with products | Refuse; reassign first | FR-CAT-02 |
| CAT | FX rate stale (> 3 days) | Last rate used; "approx." shown; admin warned; checkout unaffected (charged in base) | FR-CAT-10, FR-FIN-13 |
| CAT | Split proposal totals 9999 bps | Refused at save (deferred constraint) | FR-CAT-12 |
| COM | Coupon expires or hits limit between apply and confirmation | Locked discount stands; redemption already recorded | FR-COM-07 |
| COM | Coupon `first_purchase_only` and customer has a pending (unpaid) order | Allowed; only paid orders count | FR-COM-07 |
| COM | Customer opens quote link while logged in as another account | 403; no order | FR-COM-09 |
| COM | Quote expires while checkout open | Order already created keeps its price; quote `expired` only if no order | FR-COM-09 |
| COM | Product unpublished after order created but before payment | Order remains payable until expiry, then `failed` | FR-COM-06 |
| COM | Buy now on a `custom_quote` offering | No "Buy now"; "Request quote" creates a lead | FR-COM-01, FR-LEAD-01 |
| PAY | Bank shortfall (received < due) | Confirm with shortfall; `bank_charge` entry; distributable reduced; invoice shows full amount | FR-PAY-06, FR-FIN-01 |
| PAY | Overpayment | Excess stored as `customer_credit_minor` on the payment, shown to admins, never allocated | FR-PAY-07 |
| PAY | Duplicate UTR submitted on two orders | Warn admin on confirmation screen (same reference exists) | FR-PAY-05 |
| PAY | Two admins confirm the same payment simultaneously | Row lock; second sees "already confirmed" | FR-PAY-06 |
| PAY | Invoice sequence contention on same FY | `SELECT … FOR UPDATE` on invoice_sequences; no gaps | FR-PAY-10 |
| PAY | GSTIN set after some invoices issued | Earlier invoices unchanged; new ones GST format | FR-PAY-11 |
| PAY | Refund requested on gateway payment (V1.1) | Unavailable; reason shown; legal page text governs (R-502) | FR-PAY-12 |
| PAY | PDF generation fails | Order still `paid`; invoice row without PDF; retry job; admin notified | FR-PAY-10, NFR-AVAIL-02 |
| DEL | Download cap reached | Refuse; query prefilled; admin reset audited | FR-DEL-05 |
| DEL | R2 unavailable | Download button shows retry message; catalog and dashboard render; uploads queued in intents | FR-DEL-04, NFR-AVAIL-02 |
| DEL | Signed URL shared with third party | Expires in 5 min; every issuance logged with user/IP | FR-DEL-04 |
| DEL | Refund on SaaS with external account | `revoke_external` task + daily reminder until done | FR-DEL-11 |
| DEL | Access period ends mid-download session | Existing URL valid until expiry; no new URLs | FR-DEL-10 |
| DEL | Subscription renewal paid during grace | Period rolls from previous `current_period_end`, not payment date | FR-DEL-15 |
| DEL | Renewal paid after suspension | New period starts at confirmation date | FR-DEL-15 |
| DEL | Customer cancels then renews before period end | Cancel flag cleared on renewal confirmation | FR-DEL-16 |
| DEL | Customer deletes account with active subscription | Warned; access ends and PII is anonymised immediately; no refund | FR-DASH-08 |
| FIN | Split changed while a payment is `submitted` | Allocation uses ownership active at confirmation time | FR-COM-12 |
| FIN | Partner removed with non-zero balance | Removal approval blocked until balance settled by payout (proposed) or the partner holds an active share (`STATE_INVALID`) | FR-ADM-12, FR-FIN-06 |
| FIN | Payout larger than balance | Refused at request; no override | FR-FIN-07 |
| FIN | Expense on product with no active ownership | Company-only expense; warning shown | FR-FIN-08 |
| FIN | Integer remainder in split | Largest-remainder rounding; leftover minor units go to the largest fractional remainders (ties → earliest) | FR-FIN-02 |
| FIN | Refund after partner already paid out | Reversal entry makes balance negative until next allocation; report flags it | FR-FIN-05, FR-FIN-06 |
| ADM | Approval when requester is the only active admin | Admin-users screen warns; no request can be applied until a second active admin exists | FR-ADM-12, FR-ADM-02 |
| ADM | Requester tries to approve own request | DB trigger rejects | FR-ADM-02 |
| ADM | Apply fails after final approval (e.g., product now has an order and type is delete) | `error` stored, status stays `approved`, admin retries or cancels | FR-ADM-03 |
| ADM | Scheduled publish reached while another change is pending approval | Cron publishes approved snapshot; new changes go through submit again | FR-ADM-05 |
| ADM | Base currency change after the first paid order | Field read-only | FR-ADM-10 |
| LEAD | Same visitor submits the inquiry form 3× | Rate-limited after 5/h; duplicates by email flagged in pool | FR-LEAD-02 |
| LEAD | Lead assigned to admin who is later removed | Returns to unassigned pool on removal apply | FR-LEAD-03 |
| CHAT | AI cap reached mid-conversation | Menu-only reply with explanation; escalation still possible | FR-CHAT-04 |
| CHAT | LLM timeout or refusal | Menu fallback; message logged with `role = menu` | FR-CHAT-07 |
| CHAT | Question about another customer's order | Menu answers use only the caller's records; LLM has no order data | FR-CHAT-02, FR-CHAT-03 |
| CHAT | Content published but chunks not yet rebuilt | Answers may be stale ≤ rebuild; publish triggers rebuild | FR-CHAT-06 |
| CONT | Legal page edited after customers accepted terms | New version; prior version retained for the record | FR-CONT-04 |
| CONT | Upload exceeds size | Rejected before presign | FR-CONT-06 |
| NOTIF | Resend down | Email queued; in-app delivered; retried; failures on system widget | FR-NOTIF-05 |
| NOTIF | Admin offline for days | Inbox retains unread; digest email still sent daily | FR-NOTIF-02, FR-NOTIF-04 |
| SEO | Unlisted product linked publicly | Reachable, `noindex`, absent from sitemap | FR-SEO-04 |
| OPS | Cron missed (GitHub Actions scheduler / Vercel Cron) | `job_runs` gap shown on system widget; jobs idempotent so next run catches up | FR-OPS-01 |
| OPS | Neon cold start | ISR serves cached public pages; account/admin show loading state | FR-PERF-02 |
| OPS | Migration to purchased host | Same container image; env swap; cron via scheduler flag | FR-OPS-02 |

## 6. Open inconsistencies

All ten items are resolved by `MASTER_SPEC.md` §7 and applied in the requirements above.

| # | Resolution |
|---|------------|
| 1 | Resolved: approver set = every active `super_admin`/`admin` except the requester; fewer than two active admins only triggers a warning (FR-ADM-02, FR-ADM-12). |
| 2 | Resolved: the trigger whitelists `confirmed → refunded` plus `amount_refunded_minor` (FR-PAY-09, FR-PAY-13, §3.2). |
| 3 | Resolved: docs/04 §7.4 no longer lists `required_approver_role`; FR-ADM-01/02 follow docs/05. |
| 4 | Resolved: `failed` only when `expires_at` passes with no confirmed payment (FR-COM-06, §3.1). |
| 5 | Resolved: daily overdue-follow-up digest email (FR-NOTIF-04, MASTER_SPEC §7 R-701). |
| 6 | Resolved: key revealed only in the dashboard; email/in-app carry a link (FR-DEL-07). |
| 7 | Resolved: anonymisation is immediate on self-delete (FR-DASH-08, NFR-DATA-01). |
| 8 | Resolved: "real-time" = 10 s admin / 30 s customer polling with focus refetch (NFR-RT-01, MASTER_SPEC §7). |
| 9 | Resolved: toggle hidden until `theme_light_editorial` is on; Theme 2 token CSS still ships in release 1 (MASTER_SPEC §7). |
| 10 | Resolved: largest-remainder rounding (FR-FIN-02), overpayment → `customer_credit_minor` (FR-PAY-07), payout > balance rejected (FR-FIN-07), fewer-than-two-admins is a warning (FR-ADM-12) — all fixed by MASTER_SPEC §7; FR-FIN-02's tie rule remains a (proposed) detail. |

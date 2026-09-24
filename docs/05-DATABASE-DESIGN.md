# 05 — DATABASE DESIGN

**Implements:** `docs/04-SOLUTION-ARCHITECTURE.md` §7, `MASTER_SPEC.md` §4 rules, baseline §5–§8, BR-05–BR-18.
**Feeds:** `06-API-SPECIFICATION`, `09-SECURITY-DESIGN`, `10-QA-TEST-STRATEGY`, `diagrams/database.md`, `implementation/`.

Conventions: PostgreSQL 16. Primary keys `id uuid default gen_random_uuid()`. Every table has `created_at timestamptz default now()`; mutable tables also `updated_at`. Money columns are `bigint` minor units + `currency char(3)`; never numeric/float. Enums are Postgres enums. Soft delete only where stated. Table IDs `T-<name>` are referenced by other documents.

---

## 1. Identity & access

**T-users** — single identity table (A-201)
```
users(id, email citext unique null, email_verified bool, phone text unique null, phone_verified bool,
      name text, image text, status enum('active','suspended','deleted'), display_currency char(3) default 'INR',
      theme_pref enum('dark-cinematic','light-editorial') null, deleted_at timestamptz null, anonymized_at timestamptz null,
      created_at, updated_at)
```
Better Auth also owns: `sessions(id, user_id, token, expires_at, ip, user_agent)`, `accounts` (OAuth/password), `verifications`, `two_factor(user_id, secret, backup_codes, enabled)`. Single-session rule: on session create, delete other sessions for the user (D-1203).

**T-roles / T-user_roles**
```
roles(key text pk)  -- 'super_admin','admin','staff','customer'
user_roles(user_id fk, role_key fk, granted_by fk users null, created_at, pk(user_id, role_key))
permissions(key text pk, description)              -- e.g. 'catalog.write','finance.payout.record'
role_permissions(role_key, permission_key, pk both)
```

**T-partners** — a partner is an admin who can hold ownership shares
```
partners(id, user_id fk unique, display_name, payout_bank_details_enc text null, active bool, created_at, updated_at)
```

**T-customer_profiles**
```
customer_profiles(user_id pk fk, company text, billing_name, billing_address jsonb, country char(2), gst_number text null,
                  tags text[], internal_notes text, notification_prefs jsonb default '{"email":true,"inapp":true}', updated_at)
```

## 2. Catalog

**T-categories**
```
categories(id, parent_id fk null, name, slug unique, position int, description, created_at, updated_at)
CHECK: depth ≤ 2 enforced by trigger (D-303)
```
**T-tags** `(id, name unique, slug unique)`; **T-product_tags** `(product_id, tag_id)`.
**T-slug_redirects** `(id, entity enum('product','case_study','blog'), old_slug, new_slug, created_at, UNIQUE(entity, old_slug))` — 301s after slug changes.

**T-products**
```
products(id, name, slug unique, short_description, description_json jsonb (Tiptap), category_id fk null,
         status enum('draft','pending_approval','scheduled','published','unpublished','archived'),
         publish_at timestamptz null, published_at null, archived_at null,
         is_featured bool, is_unlisted bool, is_coming_soon bool, is_refundable bool default false, tax_enabled bool default false,
         current_version text, features jsonb, benefits jsonb, target_audience jsonb, use_cases jsonb, industry text[],
         tech_stack text[], requirements_json jsonb, live_demo_url text null,
         seo_title, seo_description, og_image_media_id fk null, canonical_url text null,
         search_vector tsvector generated always as (...) stored,
         created_by fk users, updated_by fk users, created_at, updated_at)
INDEX gin(search_vector); INDEX(status, publish_at); UNIQUE(slug)
```
**T-product_versions** `(id, product_id, version, changelog_json jsonb, released_at, created_by)` — public changelog (D-313).
**T-product_faqs** `(id, product_id, question, answer_json, position)`.
**T-product_testimonials** `(id, product_id, author_name, author_title, company, quote, avatar_media_id, position, published)` (D-312).
**T-product_media**
```
product_media(id, product_id, kind enum('image','screenshot','gallery','video_embed','video_file','presentation','attachment','og'),
              media_id fk null, embed_url text null, title, alt text, position, created_at)
```
**T-media** — every stored file
```
media(id, bucket, object_key unique, mime, size_bytes, width, height, duration_s, checksum, blur_hash text null, visibility enum('public','private'),
      uploaded_by fk, created_at)
```
**T-product_blogs** `(id, product_id unique, slug unique, title, excerpt, body_json, cover_media_id, status enum('draft','published'), published_at, seo_title, seo_description, author_id, created_at, updated_at)` (D-121, D-804).

## 3. Offerings & pricing

**T-offerings**
```
offerings(id, product_id fk, name, slug, position, is_default bool,
          purchase_model enum('one_time','subscription','custom_quote'),
          billing_interval enum('monthly','quarterly','annual') null,
          trial_days int null, license_type text null,
          delivery_type enum('saas','hosted','download','license','service','custom'),
          delivery_config jsonb,          -- per type: {provisioning:'manual'|'automated', instructions_json, download_cap, access_months|null(lifetime), update_policy:'all_free'|'during_access'|'major_paid', repo/url hints}
          service_steps jsonb null,       -- [{key,title,description}] (D-608)
          instructions_json jsonb null,   -- post-purchase (A-601)
          status enum('active','inactive'), created_at, updated_at)
UNIQUE(product_id, slug)
```
**T-offering_prices** `(offering_id, currency char(3), amount_minor bigint, compare_at_minor bigint null, pk(offering_id,currency))` — base currency row mandatory; others optional (D-502, D-408).
**T-offering_payment_methods** `(offering_id, method enum('manual_upi','manual_bank','razorpay','stripe','paypal'), pk)` (D-110).

## 4. Ownership (effective-dated, dual-approved)

**T-product_ownerships**
```
product_ownerships(id, product_id fk, version int, company_cut_bps int default 0, status enum('pending','active','superseded'),
                   effective_from timestamptz null, approval_request_id fk null, created_by, created_at)
UNIQUE(product_id, version); partial UNIQUE(product_id) WHERE status='active'
```
**T-product_ownership_lines** `(ownership_id fk, partner_id fk, share_bps int, pk)` — CHECK sum(share_bps) = 10000 per ownership enforced by deferred constraint trigger (BR-06, BR-07; 100% single partner allowed).

## 5. Commerce

**T-coupons**
```
coupons(id, code citext unique, kind enum('percent','fixed'), value int (bps or minor), currency null, starts_at, ends_at,
        max_redemptions int null, redemptions_count int, first_purchase_only bool, product_ids uuid[] null, active bool, created_by, created_at)
coupon_redemptions(id, coupon_id, order_id, user_id, created_at, UNIQUE(coupon_id, order_id))
```
**T-custom_quotes** (D-520)
```
custom_quotes(id, customer_id fk users, offering_id fk null, title, description, currency, amount_minor, token unique,
              expires_at, status enum('draft','sent','accepted','paid','expired','cancelled'), order_id fk null, created_by, created_at)
```
**T-orders**
```
orders(id, order_no text unique (CK-ORD-000001), type enum('product','project'), user_id fk null (project orders may have client_* instead),
       client_name, client_email, client_company,
       status enum('pending_payment','paid','fulfilled','failed','cancelled','refunded','partially_refunded'),
       currency char(3), subtotal_minor, discount_minor, tax_minor, total_minor,
       coupon_id fk null, custom_quote_id fk null, split_approval_request_id fk approval_requests null (project orders),
       billing_snapshot jsonb (name,email,country,company,address,gst_number),
       tax_rate_bps int, tax_snapshot jsonb, fx_rate_to_inr numeric(18,8),
       expires_at timestamptz null (pending +7d), paid_at, fulfilled_at, cancelled_at, refunded_at,
       created_by fk null (admin for manual), created_at, updated_at)
INDEX(user_id, created_at desc); INDEX(status, expires_at)
```
**T-order_items**
```
order_items(id, order_id fk, offering_id fk null, product_id fk null, description text (free-form for project lines),
            quantity int default 1, unit_minor, discount_minor, tax_minor, total_minor,
            ownership_id fk product_ownerships null (snapshot of version used; product lines),
            split_snapshot jsonb null ({company_cut_bps, lines:[{partner_id, share_bps}]} for project lines, dual-approved via 'project_order.split'), created_at)
```
Duplicate-purchase rule (BR-10): partial unique index on `(user_id, offering_id)` via a `user_offering_purchases` helper table populated on `paid` for one_time offerings.

**T-payments**
```
payments(id, order_id fk, provider enum(...methods), status enum('initiated','submitted','confirmed','failed','refunded'),
         amount_due_minor, amount_received_minor null, bank_shortfall_minor null, amount_refunded_minor bigint null, customer_credit_minor bigint null (overpayment), currency,
         instructions jsonb (upi vpa, qr data url, bank details), customer_reference text null (UTR/txn id),
         customer_submitted_at, confirmed_by fk null, confirmed_at, failure_reason, provider_payload jsonb, created_at)
Immutable after status='confirmed' (trigger) except the single transition confirmed → refunded and `amount_refunded_minor`; `order_items.ownership_id` is written once at confirm time and then frozen
```
**T-refunds** `(id, order_id, payment_id, amount_minor, currency, reason, approval_request_id, credit_note_id, executed_by, executed_at, created_at)`.

**T-invoices**
```
invoices(id, invoice_no text unique (CK/2026-27/0001), order_id fk unique, fy text, seq int, issued_at, seller_snapshot jsonb,
         buyer_snapshot jsonb, lines jsonb, subtotal_minor, discount_minor, tax_minor, total_minor, currency,
         gst_breakdown jsonb null (cgst/sgst/igst), pdf_media_id fk, created_at)
invoice_sequences(fy text pk, last_seq int)   -- row-locked on issue (BR-16)
credit_notes(id, credit_no unique (CK/CN/2026-27/0001), invoice_id fk, refund_id fk, amount_minor, currency, issued_at, pdf_media_id, created_at)
credit_note_sequences(fy text pk, last_seq int)   -- gapless like invoices
```
Immutable (trigger).

## 6. Entitlements & delivery

**T-entitlements**
```
entitlements(id, user_id fk, offering_id fk, order_item_id fk null (null = manual grant D-1108), product_id fk,
             delivery_type enum(...), status enum('pending','active','suspended','expired','revoked'),
             access_starts_at, access_ends_at null (lifetime), update_policy enum, download_cap int null, downloads_used int default 0,
             license_key_enc text null, provisioning_state enum('n/a','pending','done') , provisioning_notes jsonb,
             granted_manually_by fk null, revoked_at, revoke_reason, created_at, updated_at)
UNIQUE(order_item_id) WHERE order_item_id IS NOT NULL; INDEX(user_id, status)
```
**T-subscriptions**
```
subscriptions(id, entitlement_id fk unique, interval enum, current_period_start, current_period_end, grace_until,
              status enum('trialing','active','past_due','suspended','cancelled'), cancel_at_period_end bool,
              renewal_order_id fk null, reminder_sent_at, created_at, updated_at)
```
**T-service_progress** `(id, entitlement_id, step_key, done_at null, done_by fk null, note)` (D-608).
**T-downloads** `(id, entitlement_id, media_id, user_id, ip, user_agent, created_at)` (BR-15).
**T-delivery_tasks** `(id, entitlement_id, kind enum('provision','revoke_external'), status enum('open','done'), assigned_to null, done_at, note)` (D-607).
**T-release_files** `(id, product_id, version, media_id, notes, released_at)` — downloadable builds per version (D-604).

## 7. Finance ledger (append-only)

**T-ledger_entries**
```
ledger_entries(id, seq bigserial unique, entry_type enum('sale','discount','tax_collected','gateway_fee','bank_charge','company_cut',
               'partner_allocation','refund_sale','refund_discount','refund_tax','refund_company_cut','refund_partner_allocation','payout','expense','adjustment'),
               order_id fk null, order_item_id fk null, payment_id fk null, refund_id fk null, payout_id fk null, expense_id fk null,
               party_type enum('customer','company','partner','tax_authority','gateway','bank'), partner_id fk null,
               amount_minor bigint (signed), currency char(3), fx_rate_to_inr numeric(18,8), amount_inr_minor bigint,
               memo text, approval_request_id fk null, created_by fk, created_at)
TRIGGER: RAISE on UPDATE/DELETE (BR-17). INDEX(partner_id, created_at); INDEX(order_id)
```
**T-allocations** — human-readable snapshot per order item (derivable from entries, kept for reporting)
```
allocations(id, order_item_id fk, ownership_id fk, company_cut_bps, distributable_minor, company_minor,
            lines jsonb [{partner_id, share_bps, amount_minor}], currency, amount_inr_minor, created_at)  -- immutable
```
**T-payouts** `(id, partner_id, amount_minor, currency, paid_on date, reference, note, approval_request_id, recorded_by, created_at)` — immutable.
**T-expenses** `(id, product_id fk null, category text, description, amount_minor, currency, incurred_on, shared_by_split bool default true, receipt_media_id null, created_by, created_at)` → posts `expense` entries (D-514).
**T-fx_rates** `(base char(3), quote char(3), rate numeric(18,8), as_of date, source, pk(base,quote,as_of))`.
**VIEW customer_credits** = payments with `customer_credit_minor > 0` not yet refunded/applied, for the finance reports (overpayments).
**VIEW partner_balances** = Σ partner_allocation − Σ refund_partner_allocation − Σ payout − Σ expense share, per partner, per currency and in INR.

## 8. Approvals & audit

**T-approval_requests**
```
approval_requests(id, type enum('product.publish','ownership.change','ledger.adjustment','refund.issue','payout.record',
                  'product.archive','product.delete','admin.user_change','project_order.split'), subject_type, subject_id, payload jsonb,
                  requested_by fk, status enum('pending','approved','rejected','applied','cancelled'), applied_at, error text, created_at)
approval_decisions(id, request_id fk, decided_by fk, decision enum('approve','reject'), comment, created_at, UNIQUE(request_id, decided_by))
CHECK via trigger: decided_by <> requested_by (BR-13)
```
**T-audit_logs** `(id, actor_id fk null, actor_role, action text, subject_type, subject_id, before jsonb, after jsonb, ip, user_agent, request_id, created_at)` — append-only trigger; INDEX(subject_type, subject_id), INDEX(actor_id, created_at).

## 9. Leads, queries, chat

**T-leads**
```
leads(id, source enum('inquiry_form','product_cta','chatbot','manual'), product_id fk null, user_id fk null,
      name, email, phone, company, message, service_interest text[], budget_hint, status enum('new','contacted','qualified','proposal','won','lost'),
      assigned_to fk null, priority enum('low','normal','high'), next_follow_up_at, lost_reason, won_order_id fk null,
      turnstile_verified bool, created_at, updated_at)
lead_activities(id, lead_id, actor_id null, kind enum('note','status_change','assignment','follow_up_set','email','call'), body, meta jsonb, created_at)
```
**T-queries** (support threads)
```
queries(id, user_id fk null, guest_email null, subject, source enum('form','chatbot','order','dashboard','email','manual'), order_id null, product_id null,
        status enum('open','waiting_customer','resolved','closed'), assigned_to null, conversation_id fk null, created_at, updated_at)
query_messages(id, query_id, author_id null, author_kind enum('customer','admin','system'), body_json, attachments uuid[], created_at)
```
**T-conversations / T-chat_messages**
```
conversations(id, user_id fk, started_at, ended_at, escalated_query_id null, model, prompt_version_id fk, purge_after date)
chat_messages(id, conversation_id, role enum('user','assistant','system','menu'), content text, tokens_in int, tokens_out int, retrieved_chunk_ids uuid[], created_at)
chat_usage_daily(scope text ('platform' | user_id), day date, count int, pk(scope, day))
knowledge_chunks(id, source_type, source_id, title, body, search_vector tsvector, updated_at)  INDEX gin
prompt_versions(id, name, system_prompt text, version int, is_active bool, created_by, created_at)
```

## 10. Content

```
landing_chapters(id, key unique ('who','build','sell','proof','talk'), title, subtitle, body_json, media jsonb, cta jsonb, position, published)
services(id, slug unique, title, summary, deliverables jsonb, body_json, icon, position, published)
case_studies(id, slug unique, title, client_name, industry, problem_json, solution_json, results_json, tech_stack text[], cover_media_id, gallery jsonb, published, published_at, seo_title, seo_description)
testimonials(id, quote, author_name, author_title, company, avatar_media_id, context enum('site','product'), product_id null, position, published)
client_logos(id, name, media_id, url, position, published)
faqs(id, question, answer_json, scope enum('site','chatbot','product'), product_id null, position, published)
legal_pages(id, key unique ('privacy','terms','refunds','license'), title, body_json, version int, published_at)
legal_page_versions(id, legal_page_id fk, version int, body_json, published_at, published_by, UNIQUE(legal_page_id, version))   -- retained 7 years (FR-CONT-04)
site_settings(key text pk, value jsonb, updated_by, updated_at)   -- base_currency, tax_rate_bps, gstin, seller_details, upi_vpa, bank_details, default_theme, ai_model, ai_daily_platform_cap, ai_daily_user_cap, feature flags, retention days
featured_products(product_id pk, position)
```

## 11. Notifications, dashboard, analytics, ops

```
notifications(id, user_id fk, type text, title, body, link, payload jsonb, channel_state jsonb ({inapp:'sent',email:'queued'|...}), read_at, created_at) INDEX(user_id, read_at, created_at desc)
email_outbox(id, to_email, template, payload jsonb, priority smallint default 5, status enum('queued','sent','failed'), attempts int, last_error, sent_at, created_at)
rate_limit_buckets(key text pk (class:subject), count int, window_start timestamptz, expires_at)   -- docs/09 §7; purged by `daily`
dashboard_layouts(user_id pk, layout jsonb, updated_at)
wishlists(user_id, product_id, created_at, pk(user_id, product_id))
analytics_events(id, name text, user_id null, anon_id text null, product_id null, order_id null, props jsonb, created_at) INDEX(name, created_at)
job_runs(id, job text, started_at, finished_at, status enum('ok','error'), detail jsonb)
webhook_events(id, provider text, event_id text, received_at, processed_at, payload jsonb, UNIQUE(provider, event_id))   -- V1.1 gateways + Resend idempotency
files_upload_intents(id, user_id, purpose, mime, size_bytes, object_key, consumed bool, expires_at)
```

## 12. Integrity rules and triggers

| Rule | Mechanism |
|------|-----------|
| Append-only: ledger_entries, allocations, payouts, invoices, credit_notes, audit_logs | `BEFORE UPDATE OR DELETE` trigger raising exception |
| Confirmed payments frozen | Trigger allows only `status: confirmed → refunded` and `amount_refunded_minor`; all other column changes rejected |
| Ownership lines sum to 10000 bps | Deferred constraint trigger on `product_ownership_lines` |
| One active ownership per product | Partial unique index |
| Category depth ≤ 2 | Trigger on insert/update of `parent_id` |
| Approver ≠ requester | Trigger on `approval_decisions` |
| Invoice numbering gapless per FY | `SELECT … FOR UPDATE` on `invoice_sequences` inside the issuing transaction |
| One-time offering bought once | Partial unique index on `user_offering_purchases(user_id, offering_id)` |
| Order total = Σ items | Application invariant + test; recomputed on read for reports |
| Retention purge | Cron deletes `chat_messages/conversations` where `purge_after < today`; anonymises `users` immediately on self-delete (BR-18) |

## 13. Indexing summary
GIN on `products.search_vector`, `knowledge_chunks.search_vector`; B-tree on all FKs; `(status, expires_at)` on orders for expiry cron; `(user_id, read_at)` on notifications; `(partner_id, created_at)` on ledger; `(name, created_at)` on analytics events; `(day)` on chat_usage_daily.

## 14. Seed data
Roles and permissions; two Super Admin users + partners; five example products with offerings (FitDesk Pro — SaaS subscription; TradeFlow — license one-time; MIS Portal — hosted + service checklist; Resume/Portfolio Website — download one-time; E-commerce Website — download + service), each with ownership versions; landing chapters; eight services; sample case studies, testimonials, FAQs, legal pages; site settings with base currency INR and feature flags. Seeds are data only, never referenced by code (D-018).

## 15. Migration policy
Drizzle SQL migrations, forward-only, one migration per phase task; triggers and views live in `drizzle/custom/*.sql` applied by the same runner. Down migrations not maintained; use a restored backup to roll back (docs/12).

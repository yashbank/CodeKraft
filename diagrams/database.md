# Database ER Diagrams

**Implements:** `docs/05-DATABASE-DESIGN.md` §1–§12 (table IDs `T-<name>`) · `MASTER_SPEC.md` §4.1, §4.2, §4.3, §4.8 · baseline §5–§8
**Decision IDs:** A-201, A-301, A-302, A-602, A-1101, BR-05, BR-06, BR-07, BR-10, BR-13, BR-15, BR-16, BR-17, BR-18, D-303, D-502, D-508, D-509, D-515, D-516, D-517, D-521, D-606, D-607, D-608, D-1104, D-1203, D-1503

Conventions in every diagram: `id uuid` primary keys, money as `bigint` minor units plus `currency char3`, enums shown as `enum` with their values in the comment, `PK`/`FK`/`UK` markers as in `docs/05`. Composite primary keys are shown by marking each member column `PK`. Only key columns and the columns that drive behaviour are drawn; `created_at`/`updated_at` are omitted unless they matter. Types with parentheses in Postgres (`char(3)`, `numeric(18,8)`) are written `char3`, `numeric` for Mermaid.

---

## 1. Identity and access (T-users, T-roles, T-user_roles, T-partners, T-customer_profiles)

```mermaid
erDiagram
    users {
        uuid id PK
        citext email UK "nullable"
        bool email_verified
        text phone UK "nullable"
        bool phone_verified
        text name
        text image
        enum status "active | suspended | deleted"
        char3 display_currency "default INR"
        enum theme_pref "dark-cinematic | light-editorial | null"
        timestamptz deleted_at "nullable"
        timestamptz anonymized_at "nullable"
    }
    sessions {
        uuid id PK
        uuid user_id FK
        text token
        timestamptz expires_at
        text ip
        text user_agent
    }
    accounts {
        uuid id PK
        uuid user_id FK "OAuth or password credential"
    }
    verifications {
        uuid id PK
        text identifier
        text value
        timestamptz expires_at
    }
    two_factor {
        uuid user_id FK
        text secret
        text backup_codes
        bool enabled
    }
    roles {
        text key PK "super_admin | admin | staff | customer"
    }
    user_roles {
        uuid user_id PK
        text role_key PK
        uuid granted_by FK "nullable"
    }
    permissions {
        text key PK "e.g. catalog.write"
        text description
    }
    role_permissions {
        text role_key PK
        text permission_key PK
    }
    partners {
        uuid id PK
        uuid user_id FK "unique"
        text display_name
        text payout_bank_details_enc "nullable"
        bool active
    }
    customer_profiles {
        uuid user_id PK
        text company
        text billing_name
        jsonb billing_address
        char2 country
        text gst_number "nullable"
        text_arr tags
        text internal_notes
        jsonb notification_prefs "default email true, inapp true"
    }

    users ||--o{ sessions : "single active session, D-1203"
    users ||--o{ accounts : "has"
    users ||--o| two_factor : "optional TOTP, admins"
    users ||--o{ user_roles : "assigned"
    roles ||--o{ user_roles : "role_key"
    users o|--o{ user_roles : "granted_by"
    roles ||--o{ role_permissions : "grants"
    permissions ||--o{ role_permissions : "permission_key"
    users ||--o| partners : "admin who holds shares"
    users ||--o| customer_profiles : "billing details"
```

**Legend:** one identity table; roles are assignments, not account types (A-201). `sessions`, `accounts`, `verifications`, `two_factor` are owned by Better Auth (ADR-03). A partner is always an admin user (D-512).

---

## 2. Catalog, offerings and ownership (T-categories, T-products, T-product_*, T-media, T-offerings, T-offering_prices, T-offering_payment_methods, T-product_ownerships, T-product_ownership_lines)

```mermaid
erDiagram
    categories {
        uuid id PK
        uuid parent_id FK "nullable, depth max 2 by trigger"
        text name
        text slug UK
        int position
    }
    tags {
        uuid id PK
        text name UK
        text slug UK
    }
    product_tags {
        uuid product_id PK
        uuid tag_id PK
    }
    products {
        uuid id PK
        text name
        text slug UK
        text short_description
        jsonb description_json "Tiptap"
        uuid category_id FK "nullable"
        enum status "draft | pending_approval | scheduled | published | unpublished | archived"
        timestamptz publish_at "nullable"
        timestamptz published_at
        timestamptz archived_at
        bool is_featured
        bool is_unlisted
        bool is_coming_soon
        bool is_refundable "default false"
        bool tax_enabled "default false"
        text current_version
        jsonb features
        jsonb benefits
        text_arr industry
        text_arr tech_stack
        text live_demo_url
        uuid og_image_media_id FK
        text canonical_url
        tsvector search_vector "generated, GIN"
        uuid created_by FK
        uuid updated_by FK
    }
    product_versions {
        uuid id PK
        uuid product_id FK
        text version
        jsonb changelog_json
        timestamptz released_at
    }
    product_faqs {
        uuid id PK
        uuid product_id FK
        text question
        jsonb answer_json
        int position
    }
    product_testimonials {
        uuid id PK
        uuid product_id FK
        text author_name
        text quote
        uuid avatar_media_id FK
        bool published
    }
    product_media {
        uuid id PK
        uuid product_id FK
        enum kind "image | screenshot | gallery | video_embed | video_file | presentation | attachment | og"
        uuid media_id FK "nullable"
        text embed_url "nullable"
        text title
        text alt "mandatory for image kinds, WCAG"
        int position
    }
    media {
        uuid id PK
        text bucket
        text object_key UK
        text mime
        bigint size_bytes
        int width
        int height
        int duration_s
        text checksum
        text blur_hash "nullable, LQIP placeholder"
        enum visibility "public | private"
        uuid uploaded_by FK
    }
    slug_redirects {
        uuid id PK
        enum entity "product | case_study | blog"
        text old_slug "UNIQUE with entity"
        text new_slug
    }
    product_blogs {
        uuid id PK
        uuid product_id FK "unique"
        text slug UK
        text title
        jsonb body_json
        uuid cover_media_id FK
        enum status "draft | published"
        timestamptz published_at
        uuid author_id FK
    }
    release_files {
        uuid id PK
        uuid product_id FK
        text version
        uuid media_id FK
        timestamptz released_at
    }
    featured_products {
        uuid product_id PK
        int position
    }
    offerings {
        uuid id PK
        uuid product_id FK
        text name
        text slug "unique per product"
        bool is_default
        enum purchase_model "one_time | subscription | custom_quote"
        enum billing_interval "monthly | quarterly | annual | null"
        int trial_days "nullable"
        text license_type "nullable"
        enum delivery_type "saas | hosted | download | license | service | custom"
        jsonb delivery_config "provisioning, download_cap, access_months, update_policy"
        jsonb service_steps "nullable, D-608"
        jsonb instructions_json "nullable, A-601"
        enum status "active | inactive"
    }
    offering_prices {
        uuid offering_id PK
        char3 currency PK
        bigint amount_minor
        bigint compare_at_minor "nullable, strike-through"
    }
    offering_payment_methods {
        uuid offering_id PK
        enum method PK "manual_upi | manual_bank | razorpay | stripe | paypal"
    }
    product_ownerships {
        uuid id PK
        uuid product_id FK
        int version "unique per product"
        int company_cut_bps "default 0"
        enum status "pending | active | superseded"
        timestamptz effective_from "nullable"
        uuid approval_request_id FK "nullable"
        uuid created_by FK
    }
    product_ownership_lines {
        uuid ownership_id PK
        uuid partner_id PK
        int share_bps "sum = 10000 per ownership"
    }
    partners {
        uuid id PK
        uuid user_id FK
    }

    categories o|--o{ categories : "parent_id"
    categories o|--o{ products : "category_id"
    products ||--o{ product_tags : "tagged"
    tags ||--o{ product_tags : "tag_id"
    products ||--o{ product_versions : "public changelog"
    products ||--o{ product_faqs : "faqs"
    products ||--o{ product_testimonials : "curated"
    products ||--o{ product_media : "media"
    media o|--o{ product_media : "stored file"
    media o|--o{ products : "og_image_media_id"
    products ||--o| product_blogs : "one blog"
    products ||--o{ release_files : "builds per version"
    media ||--o{ release_files : "media_id"
    products ||--o| featured_products : "landing feature"
    products ||--|{ offerings : "1..n purchasable plans, A-301"
    offerings ||--|{ offering_prices : "base currency row mandatory"
    offerings ||--o{ offering_payment_methods : "enabled methods"
    products ||--o{ product_ownerships : "effective-dated versions"
    product_ownerships ||--|{ product_ownership_lines : "partner split"
    partners ||--o{ product_ownership_lines : "partner_id"
```

**Legend:** prices, purchase models and delivery live on offerings, never on products (MASTER_SPEC §4.2). `slug_redirects` keeps old slugs of published products, case studies and blogs for 301s (MASTER_SPEC §7 "Slug changes"); `product_media.alt` and `media.blur_hash` feed accessible, CLS-free image delivery (docs/08 §12). Exactly one `product_ownerships` row per product is `active` (partial unique index); lines must sum to 10000 bps (BR-06, BR-07); a new version becomes active only via an `approval_requests` row of type `ownership.change` (BR-05).

---

## 3. Commerce (T-orders, T-order_items, T-payments, T-coupons, T-custom_quotes, T-invoices, T-credit_notes, T-refunds)

```mermaid
erDiagram
    orders {
        uuid id PK
        text order_no UK "CK-ORD-000001"
        enum type "product | project"
        uuid user_id FK "nullable for project orders"
        text client_name
        text client_email
        text client_company
        enum status "pending_payment | paid | fulfilled | failed | cancelled | refunded | partially_refunded"
        char3 currency
        bigint subtotal_minor
        bigint discount_minor
        bigint tax_minor
        bigint total_minor
        uuid coupon_id FK "nullable"
        uuid custom_quote_id FK "nullable"
        jsonb billing_snapshot
        int tax_rate_bps
        jsonb tax_snapshot
        numeric fx_rate_to_inr
        timestamptz expires_at "pending plus 7 days"
        timestamptz paid_at
        timestamptz fulfilled_at
        timestamptz cancelled_at
        timestamptz refunded_at
        uuid created_by FK "admin for manual orders"
    }
    order_items {
        uuid id PK
        uuid order_id FK
        uuid offering_id FK "nullable"
        uuid product_id FK "nullable"
        text description "free-form for project lines"
        int quantity "default 1"
        bigint unit_minor
        bigint discount_minor
        bigint tax_minor
        bigint total_minor
        uuid ownership_id FK "written at confirm time, then frozen; product lines"
        jsonb split_snapshot "nullable; project lines: company_cut_bps + partner lines, approved via project_order.split"
    }
    payments {
        uuid id PK
        uuid order_id FK
        enum provider "manual_upi | manual_bank | razorpay | stripe | paypal"
        enum status "initiated | submitted | confirmed | failed | refunded"
        bigint amount_due_minor
        bigint amount_received_minor "nullable"
        bigint bank_shortfall_minor "nullable"
        bigint amount_refunded_minor "nullable, only later write allowed"
        bigint customer_credit_minor "nullable, overpayment shown to admins"
        char3 currency
        jsonb instructions "upi vpa, qr data url, bank details"
        text customer_reference "UTR or txn id"
        timestamptz customer_submitted_at
        uuid confirmed_by FK "nullable"
        timestamptz confirmed_at
        text failure_reason
        jsonb provider_payload
    }
    coupons {
        uuid id PK
        citext code UK
        enum kind "percent | fixed"
        int value "bps or minor"
        char3 currency "nullable"
        timestamptz starts_at
        timestamptz ends_at
        int max_redemptions "nullable"
        int redemptions_count
        bool first_purchase_only
        uuid_arr product_ids "nullable"
        bool active
    }
    coupon_redemptions {
        uuid id PK
        uuid coupon_id FK
        uuid order_id FK "unique with coupon_id"
        uuid user_id FK
    }
    custom_quotes {
        uuid id PK
        uuid customer_id FK
        uuid offering_id FK "nullable"
        text title
        char3 currency
        bigint amount_minor
        text token UK
        timestamptz expires_at
        enum status "draft | sent | accepted | paid | expired | cancelled"
        uuid order_id FK "nullable"
        uuid created_by FK
    }
    invoices {
        uuid id PK
        text invoice_no UK "CK/2026-27/0001"
        uuid order_id FK "unique"
        text fy
        int seq
        timestamptz issued_at
        jsonb seller_snapshot
        jsonb buyer_snapshot
        jsonb lines
        bigint subtotal_minor
        bigint discount_minor
        bigint tax_minor
        bigint total_minor
        char3 currency
        jsonb gst_breakdown "cgst sgst igst, nullable"
        uuid pdf_media_id FK
    }
    invoice_sequences {
        text fy PK
        int last_seq "row-locked on issue"
    }
    credit_notes {
        uuid id PK
        text credit_no UK
        uuid invoice_id FK
        uuid refund_id FK
        bigint amount_minor
        char3 currency
        timestamptz issued_at
        uuid pdf_media_id FK
    }
    refunds {
        uuid id PK
        uuid order_id FK
        uuid payment_id FK
        bigint amount_minor
        char3 currency
        text reason
        uuid approval_request_id FK
        uuid credit_note_id FK
        uuid executed_by FK
        timestamptz executed_at
    }
    user_offering_purchases {
        uuid user_id PK
        uuid offering_id PK "partial unique, one_time only"
    }
    users {
        uuid id PK
    }
    offerings {
        uuid id PK
    }

    users o|--o{ orders : "user_id"
    orders ||--|{ order_items : "lines"
    offerings o|--o{ order_items : "offering_id"
    orders ||--o{ payments : "attempts, retry from order page"
    coupons o|--o{ orders : "coupon_id"
    coupons ||--o{ coupon_redemptions : "redeemed"
    orders ||--o| coupon_redemptions : "one per order"
    custom_quotes o|--o| orders : "custom_quote_id"
    users ||--o{ custom_quotes : "customer_id"
    orders ||--o| invoices : "issued on paid"
    invoice_sequences ||--o{ invoices : "fy, seq"
    invoices ||--o{ credit_notes : "on refund"
    refunds ||--o| credit_notes : "refund_id"
    orders ||--o{ refunds : "order_id"
    payments ||--o{ refunds : "payment_id"
    users ||--o{ user_offering_purchases : "populated on paid"
    offerings ||--o{ user_offering_purchases : "BR-10 bought once"
```

**Legend:** immutable after the fact: `invoices`, `credit_notes`, and `payments` once `status = confirmed` except the single transition `confirmed → refunded` plus `amount_refunded_minor` (trigger; MASTER_SPEC §4.1, §7). Orders carry both `user_id` (customers) and `client_*` (project orders created by admins, D-1107). `order_items.ownership_id` freezes which split version applies for product lines (BR-05); project lines carry `split_snapshot`, dual-approved as `project_order.split` before invoice or payment (MASTER_SPEC §7). `payments.customer_credit_minor` records an overpayment for admins; it is never allocated. Unpaid orders expire at `expires_at` (BR-10).

---

## 4. Entitlements, delivery and subscriptions (T-entitlements, T-subscriptions, T-service_progress, T-downloads, T-delivery_tasks, T-release_files)

```mermaid
erDiagram
    entitlements {
        uuid id PK
        uuid user_id FK
        uuid offering_id FK
        uuid order_item_id FK "nullable, null = manual grant D-1108, partial unique"
        uuid product_id FK
        enum delivery_type "saas | hosted | download | license | service | custom"
        enum status "pending | active | suspended | expired | revoked"
        timestamptz access_starts_at
        timestamptz access_ends_at "null = lifetime"
        enum update_policy "all_free | during_access | major_paid"
        int download_cap "nullable"
        int downloads_used "default 0"
        text license_key_enc "nullable"
        enum provisioning_state "n/a | pending | done"
        jsonb provisioning_notes
        uuid granted_manually_by FK "nullable"
        timestamptz revoked_at
        text revoke_reason
    }
    subscriptions {
        uuid id PK
        uuid entitlement_id FK "unique"
        enum interval "monthly | quarterly | annual"
        timestamptz current_period_start
        timestamptz current_period_end
        timestamptz grace_until
        enum status "trialing | active | past_due | suspended | cancelled"
        bool cancel_at_period_end
        uuid renewal_order_id FK "nullable"
        timestamptz reminder_sent_at
    }
    service_progress {
        uuid id PK
        uuid entitlement_id FK
        text step_key
        timestamptz done_at "nullable"
        uuid done_by FK "nullable"
        text note
    }
    downloads {
        uuid id PK
        uuid entitlement_id FK
        uuid media_id FK
        uuid user_id FK
        text ip
        text user_agent
        timestamptz created_at
    }
    delivery_tasks {
        uuid id PK
        uuid entitlement_id FK
        enum kind "provision | revoke_external"
        enum status "open | done"
        uuid assigned_to FK "nullable"
        timestamptz done_at
        text note
    }
    release_files {
        uuid id PK
        uuid product_id FK
        text version
        uuid media_id FK
        timestamptz released_at
    }
    order_items {
        uuid id PK
        uuid offering_id FK
    }
    offerings {
        uuid id PK
        enum delivery_type
        jsonb delivery_config
        jsonb service_steps
    }
    products {
        uuid id PK
    }
    users {
        uuid id PK
    }
    orders {
        uuid id PK
    }
    media {
        uuid id PK
    }

    order_items ||--o| entitlements : "created on paid, A-602"
    users o|--o{ entitlements : "granted_manually_by, D-1108"
    offerings ||--o{ entitlements : "delivery_type copied"
    users ||--o{ entitlements : "customer"
    products ||--o{ entitlements : "product_id"
    entitlements ||--o| subscriptions : "recurring sub-record, D-521"
    orders o|--o{ subscriptions : "renewal_order_id"
    entitlements ||--o{ service_progress : "one row per checklist step"
    entitlements ||--o{ downloads : "logged, counts against cap, BR-15"
    media ||--o{ downloads : "signed link target"
    entitlements ||--o{ delivery_tasks : "manual provision or external revoke, D-607"
    products ||--o{ release_files : "downloadable builds"
    media ||--o{ release_files : "media_id"
```

**Legend:** the entitlement is the delivery pivot (MASTER_SPEC §4.3): one per paid `order_item`, or `order_item_id = null` for an admin manual grant (D-1108); its `delivery_type` selects the handler. Subscriptions are manual-renew in release 1 (BR-14). `service_progress` rows are seeded from `offerings.service_steps` (D-608).

---

## 5. Finance ledger, append-only (T-ledger_entries, T-allocations, T-payouts, T-expenses, T-fx_rates, VIEW partner_balances)

```mermaid
erDiagram
    ledger_entries {
        uuid id PK
        bigserial seq UK
        enum entry_type "sale | discount | tax_collected | gateway_fee | bank_charge | company_cut | partner_allocation | refund_sale | refund_discount | refund_tax | refund_company_cut | refund_partner_allocation | payout | expense | adjustment"
        uuid order_id FK "nullable"
        uuid order_item_id FK "nullable"
        uuid payment_id FK "nullable"
        uuid refund_id FK "nullable"
        uuid payout_id FK "nullable"
        uuid expense_id FK "nullable"
        enum party_type "customer | company | partner | tax_authority | gateway | bank"
        uuid partner_id FK "nullable"
        bigint amount_minor "signed"
        char3 currency
        numeric fx_rate_to_inr
        bigint amount_inr_minor
        text memo
        uuid approval_request_id FK "nullable, adjustments"
        uuid created_by FK
        timestamptz created_at
    }
    allocations {
        uuid id PK
        uuid order_item_id FK
        uuid ownership_id FK
        int company_cut_bps
        bigint distributable_minor
        bigint company_minor
        jsonb lines "partner_id, share_bps, amount_minor"
        char3 currency
        bigint amount_inr_minor
    }
    payouts {
        uuid id PK
        uuid partner_id FK
        bigint amount_minor
        char3 currency
        date paid_on
        text reference
        text note
        uuid approval_request_id FK
        uuid recorded_by FK
    }
    expenses {
        uuid id PK
        uuid product_id FK "nullable"
        text category
        text description
        bigint amount_minor
        char3 currency
        date incurred_on
        bool shared_by_split "default true"
        uuid receipt_media_id FK "nullable"
        uuid created_by FK
    }
    fx_rates {
        char3 base PK
        char3 quote PK
        date as_of PK
        numeric rate
        text source
    }
    partner_balances {
        uuid partner_id "view"
        char3 currency
        bigint balance_minor "sum allocation minus refunds minus payouts minus expense share"
        bigint balance_inr_minor
    }
    partners {
        uuid id PK
    }
    order_items {
        uuid id PK
        uuid ownership_id FK
    }
    product_ownerships {
        uuid id PK
    }
    payments {
        uuid id PK
    }
    refunds {
        uuid id PK
    }
    products {
        uuid id PK
    }
    approval_requests {
        uuid id PK
    }

    order_items ||--o{ ledger_entries : "sale, discount, tax, fee, cut, allocation"
    order_items ||--o| allocations : "snapshot per item"
    product_ownerships ||--o{ allocations : "ownership_id at payment time"
    payments ||--o{ ledger_entries : "payment_id"
    refunds ||--o{ ledger_entries : "refund_* reversals"
    partners ||--o{ ledger_entries : "partner_id"
    payouts ||--o{ ledger_entries : "payout entry"
    expenses ||--o{ ledger_entries : "expense entry"
    partners ||--o{ payouts : "paid to"
    products o|--o{ expenses : "optional product"
    approval_requests o|--o{ ledger_entries : "adjustment approval"
    approval_requests o|--o{ payouts : "payout.record approval"
    partners ||--o| partner_balances : "derived per currency"
    fx_rates ||--o{ ledger_entries : "rate at payment date, D-515"
```

**Legend:** `ledger_entries`, `allocations`, `payouts` reject UPDATE/DELETE by trigger (BR-17). Every entry stores the transaction currency amount plus the INR equivalent at the payment-date rate (D-515). `partner_balances` is a plain SQL view over entries, never a stored or materialised balance (ADR-05, `docs/04` §7.2).

---

## 6. Approvals and audit (T-approval_requests, T-approval_decisions, T-audit_logs)

```mermaid
erDiagram
    approval_requests {
        uuid id PK
        enum type "product.publish | ownership.change | ledger.adjustment | refund.issue | payout.record | product.archive | product.delete | admin.user_change | project_order.split"
        text subject_type
        uuid subject_id
        jsonb payload "typed by module"
        uuid requested_by FK
        enum status "pending | approved | rejected | applied | cancelled"
        timestamptz applied_at
        text error
        timestamptz created_at
    }
    approval_decisions {
        uuid id PK
        uuid request_id FK
        uuid decided_by FK "trigger: never equals requested_by"
        enum decision "approve | reject"
        text comment
        timestamptz created_at
    }
    audit_logs {
        uuid id PK
        uuid actor_id FK "nullable"
        text actor_role
        text action
        text subject_type
        uuid subject_id
        jsonb before
        jsonb after
        text ip
        text user_agent
        text request_id
        timestamptz created_at
    }
    users {
        uuid id PK
    }

    users ||--o{ approval_requests : "requested_by"
    approval_requests ||--o{ approval_decisions : "one per approver, UNIQUE request_id decided_by"
    users ||--o{ approval_decisions : "decided_by"
    users o|--o{ audit_logs : "actor_id"
    approval_requests ||--o{ audit_logs : "every decision audited"
```

**Legend:** one generic approval mechanism for all dual-approval actions (A-1101, MASTER_SPEC §4.5). `audit_logs` is append-only; every admin mutation writes one row in the same transaction (D-1104). Subject tables referenced by `subject_type`/`subject_id`: products, product_ownerships, orders (project_order.split), ledger_entries, refunds, payouts, users.

---

## 7. Leads, queries and chat (T-leads, T-queries, T-conversations, T-chat_messages)

```mermaid
erDiagram
    leads {
        uuid id PK
        enum source "inquiry_form | product_cta | chatbot | manual"
        uuid product_id FK "nullable"
        uuid user_id FK "nullable"
        text name
        text email
        text phone
        text company
        text message
        text_arr service_interest
        text budget_hint
        enum status "new | contacted | qualified | proposal | won | lost"
        uuid assigned_to FK "nullable"
        enum priority "low | normal | high"
        timestamptz next_follow_up_at
        text lost_reason
        uuid won_order_id FK "nullable"
        bool turnstile_verified
    }
    lead_activities {
        uuid id PK
        uuid lead_id FK
        uuid actor_id FK "nullable"
        enum kind "note | status_change | assignment | follow_up_set | email | call"
        text body
        jsonb meta
    }
    queries {
        uuid id PK
        uuid user_id FK "nullable"
        text guest_email "nullable"
        text subject
        enum source "form | chatbot | order | dashboard | email | manual"
        uuid order_id FK "nullable"
        uuid product_id FK "nullable"
        enum status "open | waiting_customer | resolved | closed"
        uuid assigned_to FK "nullable"
        uuid conversation_id FK "nullable"
    }
    query_messages {
        uuid id PK
        uuid query_id FK
        uuid author_id FK "nullable"
        enum author_kind "customer | admin | system"
        jsonb body_json
        uuid_arr attachments
    }
    conversations {
        uuid id PK
        uuid user_id FK
        timestamptz started_at
        timestamptz ended_at
        uuid escalated_query_id FK "nullable"
        text model
        uuid prompt_version_id FK
        date purge_after "12 months, D-1503"
    }
    chat_messages {
        uuid id PK
        uuid conversation_id FK
        enum role "user | assistant | system | menu"
        text content
        int tokens_in
        int tokens_out
        uuid_arr retrieved_chunk_ids
    }
    chat_usage_daily {
        text scope PK "platform or user_id"
        date day PK
        int count
    }
    knowledge_chunks {
        uuid id PK
        text source_type
        uuid source_id
        text title
        text body
        tsvector search_vector "GIN"
        timestamptz updated_at
    }
    prompt_versions {
        uuid id PK
        text name
        text system_prompt
        int version
        bool is_active
        uuid created_by FK
    }
    users {
        uuid id PK
    }
    orders {
        uuid id PK
    }
    products {
        uuid id PK
    }

    leads ||--o{ lead_activities : "timeline"
    users o|--o{ leads : "assigned_to"
    products o|--o{ leads : "product CTA"
    orders o|--o| leads : "won_order_id"
    queries ||--o{ query_messages : "thread"
    users o|--o{ queries : "customer or guest_email"
    users o|--o{ queries : "assigned_to"
    orders o|--o{ queries : "about an order"
    conversations o|--o| queries : "escalated_query_id"
    users ||--o{ conversations : "login required, D-205"
    conversations ||--o{ chat_messages : "messages"
    prompt_versions ||--o{ conversations : "prompt used"
    knowledge_chunks }o--o{ chat_messages : "retrieved_chunk_ids"
    users ||--o{ chat_usage_daily : "per-user cap, D-708"
```

**Legend:** lead pipeline statuses per D-703; queries are support threads (never "tickets"); conversations are chatbot sessions (never "queries"). `knowledge_chunks` is rebuilt by cron and on content publish from products, offerings, services, FAQs, legal pages and case studies (`docs/04` §9).

---

## 8. Content (CMS-lite, `docs/05` §10)

```mermaid
erDiagram
    landing_chapters {
        uuid id PK
        text key UK "who | build | sell | proof | talk"
        text title
        text subtitle
        jsonb body_json
        jsonb media
        jsonb cta
        int position
        bool published
    }
    services {
        uuid id PK
        text slug UK
        text title
        text summary
        jsonb deliverables
        jsonb body_json
        text icon
        int position
        bool published
    }
    case_studies {
        uuid id PK
        text slug UK
        text title
        text client_name
        text industry
        jsonb problem_json
        jsonb solution_json
        jsonb results_json
        text_arr tech_stack
        uuid cover_media_id FK
        jsonb gallery
        bool published
        timestamptz published_at
        text seo_title
        text seo_description
    }
    testimonials {
        uuid id PK
        text quote
        text author_name
        text author_title
        text company
        uuid avatar_media_id FK
        enum context "site | product"
        uuid product_id FK "nullable"
        int position
        bool published
    }
    client_logos {
        uuid id PK
        text name
        uuid media_id FK
        text url
        int position
        bool published
    }
    faqs {
        uuid id PK
        text question
        jsonb answer_json
        enum scope "site | chatbot | product"
        uuid product_id FK "nullable"
        int position
        bool published
    }
    legal_pages {
        uuid id PK
        text key UK "privacy | terms | refunds | license"
        text title
        jsonb body_json
        int version
        timestamptz published_at
    }
    site_settings {
        text key PK "base_currency, tax_rate_bps, gstin, upi_vpa, bank_details, default_theme, ai_model, caps, flags, retention"
        jsonb value
        uuid updated_by FK
        timestamptz updated_at
    }
    product_blogs {
        uuid id PK
        uuid product_id FK "unique"
        text slug UK
        enum status "draft | published"
    }
    featured_products {
        uuid product_id PK
        int position
    }
    media {
        uuid id PK
    }
    products {
        uuid id PK
    }
    users {
        uuid id PK
    }

    media o|--o{ case_studies : "cover_media_id"
    media o|--o{ testimonials : "avatar_media_id"
    media ||--o{ client_logos : "media_id"
    products o|--o{ testimonials : "product context"
    products o|--o{ faqs : "product scope"
    products ||--o| product_blogs : "one blog per product, D-121"
    products ||--o| featured_products : "featured on landing"
    users o|--o{ site_settings : "updated_by"
```

**Legend:** all rich text is Tiptap JSON rendered server-side (ADR-10). Publishing any content row triggers `revalidateTag('content')` and a `knowledge_chunks` rebuild. `legal_pages` are versioned; `site_settings` holds feature flags read by `lib/feature-flags.ts` (MASTER_SPEC §4.11).

---

## 9. Notifications, dashboard, analytics and ops (`docs/05` §11)

```mermaid
erDiagram
    notifications {
        uuid id PK
        uuid user_id FK
        text type
        text title
        text body
        text link
        jsonb payload
        jsonb channel_state "inapp sent, email queued"
        timestamptz read_at "nullable, index user_id read_at"
        timestamptz created_at
    }
    email_outbox {
        uuid id PK
        text to_email
        text template
        jsonb payload
        enum status "queued | sent | failed"
        int attempts
        text last_error
        timestamptz sent_at
    }
    dashboard_layouts {
        uuid user_id PK
        jsonb layout "react-grid-layout JSON"
        timestamptz updated_at
    }
    wishlists {
        uuid user_id PK
        uuid product_id PK
        timestamptz created_at
    }
    analytics_events {
        uuid id PK
        text name "index name created_at"
        uuid user_id FK "nullable"
        text anon_id "nullable"
        uuid product_id FK "nullable"
        uuid order_id FK "nullable"
        jsonb props
        timestamptz created_at
    }
    job_runs {
        uuid id PK
        text job
        timestamptz started_at
        timestamptz finished_at
        enum status "ok | error"
        jsonb detail
    }
    webhook_events {
        uuid id PK
        text provider "razorpay | stripe | paypal | resend"
        text event_id "UNIQUE with provider"
        timestamptz received_at
        timestamptz processed_at
        jsonb payload
    }
    files_upload_intents {
        uuid id PK
        uuid user_id FK
        text purpose
        text mime
        bigint size_bytes
        text object_key
        bool consumed
        timestamptz expires_at
    }
    users {
        uuid id PK
    }
    products {
        uuid id PK
    }
    orders {
        uuid id PK
    }

    users ||--o{ notifications : "persisted inbox, D-707"
    notifications o|--o{ email_outbox : "email channel queued, retried by cron"
    users ||--o| dashboard_layouts : "per-admin widget layout, D-1101"
    users ||--o{ wishlists : "customer wishlist"
    products ||--o{ wishlists : "product_id"
    users o|--o{ analytics_events : "internal events feed widgets"
    products o|--o{ analytics_events : "product_id"
    orders o|--o{ analytics_events : "order_id"
    users ||--o{ files_upload_intents : "presigned PUT issued"
    webhook_events }o--o| email_outbox : "Resend bounce events"
```

**Legend:** notifications are written inside domain transactions and polled by the admin shell every 10 s (ADR-06). `job_runs` feeds the admin system widget with missed cron runs (`docs/04` §10). `email_outbox` is the Resend retry queue. `webhook_events` gives V1.1 gateway and Resend webhooks idempotency via `UNIQUE(provider, event_id)`.

---

## 10. Integrity rules cheat-sheet (`docs/05` §12)

| Rule | Tables | Mechanism |
|------|--------|-----------|
| Append-only | ledger_entries, allocations, payouts, invoices, credit_notes, audit_logs | `BEFORE UPDATE OR DELETE` trigger |
| Confirmed payments frozen | payments | Trigger allows only `status: confirmed → refunded` and `amount_refunded_minor` |
| Ownership lines sum to 10000 bps | product_ownership_lines | Deferred constraint trigger |
| One active ownership per product | product_ownerships | Partial unique index `WHERE status='active'` |
| Category depth ≤ 2 | categories | Trigger on `parent_id` |
| Approver ≠ requester | approval_decisions | Trigger `decided_by <> requested_by` |
| Gapless invoice numbering per FY | invoice_sequences | `SELECT … FOR UPDATE` in issuing transaction |
| One-time offering bought once | user_offering_purchases | Partial unique index |
| Retention purge | chat_messages, conversations, users | Cron: purge after `purge_after`; users are anonymised immediately on self-delete (BR-18, MASTER_SPEC §7) |

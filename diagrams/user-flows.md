# User Flows (Visitor and Customer)

**Implements:** baseline §9 user journeys, §6 commerce model, §8 delivery model, §11 chatbot · `docs/04` §6, §7.1, §7.3, §9 · `docs/05` T-orders, T-payments, T-entitlements, T-subscriptions, T-queries, T-conversations
**Decision IDs:** D-801, D-802, D-315, D-808, D-1201, D-204, D-205, D-501, D-411, D-412, D-413, D-516, D-521, D-505, D-414, D-415, D-701, D-702, D-708, D-1003, BR-03, BR-09, BR-10, BR-14, BR-15, BR-18, A-501, A-602

Status values are the Postgres enum values from `docs/05`.

---

## 1. Discover → inquire (D-801, D-802, D-315, D-808)

```mermaid
flowchart TD
    Land["Story landing<br/>Who we are · What we build · What we sell · Proof · Talk to us"]
    Land --> CTA{"Dual CTA"}
    CTA -->|"Start a project"| Sheet["Inquiry sheet on the landing page<br/>posts to the same lead action as /contact"]
    Sheet --> Submit
    Contact["/contact inquiry form<br/>Turnstile verified"]
    CTA -->|"Explore products"| Catalog["/products catalog<br/>filters, sort, full-text search"]
    Land --> Services["/services<br/>inquiry only, no prices, BR-01"]
    Land --> Cases["/projects case studies"]
    Services --> Contact
    Cases --> Contact
    Catalog --> PDP["/products/slug<br/>offerings, media, FAQs, blog, changelog"]
    PDP -->|"Request customisation"| Contact
    PDP -->|"Buy now"| LoginGate{"Logged in?"}
    LoginGate -->|"no"| Register["/auth/register or /auth/login"]
    LoginGate -->|"yes"| Checkout["Checkout, see flow 3"]
    Register --> Checkout
    PDP -->|"Wishlist"| LoginGate
    Contact --> Submit["Server Action<br/>Zod validate, Turnstile siteverify, rate limit"]
    Submit --> Lead["leads row<br/>source = inquiry_form or product_cta<br/>status = new"]
    Lead --> Notify["notifications to admins, in-app only, D-707"]
    Lead --> Ack["Confirmation email to visitor via Resend"]
```

**Legend:** visitors never need an account to inquire (BR-03); the inquiry form is the only visitor write. Product page "Request customisation" carries `product_id` into the lead (D-315).

---

## 2. Register and verify (D-1201, D-1603, BR-03)

```mermaid
sequenceDiagram
    autonumber
    actor V as Visitor
    participant UI as (auth) pages
    participant BA as Better Auth api/auth
    participant DB as Postgres
    participant RS as Resend

    alt Email and password
        V->>UI: /auth/register name, email, password
        UI->>BA: signUp email
        BA->>DB: insert users (email_verified=false), accounts
        BA->>DB: insert verifications token
        BA->>RS: verification email with link
        RS-->>V: email
        V->>UI: click /auth/verify?token
        UI->>BA: verifyEmail token
        BA->>DB: users.email_verified = true
    else Google OAuth
        V->>UI: Continue with Google
        UI->>BA: OAuth redirect
        BA->>DB: insert users (email_verified=true), accounts
    else Phone OTP (feature flag phone_otp, V1.1)
        V->>UI: /auth/otp phone number
        UI->>BA: sendOtp
        Note over BA: only when flag is on
    end

    BA->>DB: insert user_roles (customer)
    BA->>DB: create session, delete other sessions (single session D-1203)
    BA->>DB: audit_logs auth event
    BA-->>V: signed in, redirected to /account or back to checkout
    Note over V,DB: Purchase and chatbot require email_verified = true (BR-03)
```

---

## 3. Buy now → checkout → manual payment → confirmation → delivery (D-501, D-411, D-516, A-602)

```mermaid
flowchart TD
    Start["Customer clicks Buy now on one offering<br/>single-offering checkout, ADR-12"]
    Start --> Verified{"email_verified?"}
    Verified -->|"no"| Verify["Resend verification link"]
    Verified -->|"yes"| Dup{"one_time offering already bought?<br/>user_offering_purchases"}
    Dup -->|"yes"| Block["Blocked, BR-10<br/>link to existing purchase"]
    Dup -->|"no"| Details["Checkout details<br/>name, email, country required<br/>company, address, GST optional"]
    Details --> Coupon["Optional coupon code<br/>validated: window, limit, product, first purchase"]
    Coupon --> Method{"Enabled method for offering"}
    Method -->|"manual_upi"| UPI["Show UPI QR<br/>upi intent with amount and order_no"]
    Method -->|"manual_bank"| Bank["Show bank details<br/>account, IFSC, order_no as narration"]
    UPI --> Order["orders status = pending_payment<br/>expires_at = now + 7 days<br/>payments status = initiated"]
    Bank --> Order
    Order --> Pay["Customer pays outside the platform"]
    Pay --> Ref["Customer submits UTR or txn reference<br/>payments status = submitted"]
    Ref --> Wait["Order page: Awaiting confirmation<br/>notification to admins"]
    Wait --> Decide{"Admin confirms?"}
    Decide -->|"not found"| Failed["payments status = failed<br/>retry from order page, D-416"]
    Failed --> Method
    Decide -->|"7 days elapsed"| Expired["cron: orders status = failed, reason expired<br/>BR-10, MASTER_SPEC section 7"]
    Decide -->|"yes, amount_received recorded"| Paid["orders status = paid<br/>payments status = confirmed<br/>bank_shortfall computed"]
    Paid --> Post["Same transaction:<br/>ledger_entries + allocations<br/>invoices issued<br/>entitlements status = pending or active<br/>user_offering_purchases"]
    Post --> Mail["Email: payment confirmed + invoice PDF<br/>in-app notification"]
    Mail --> Deliver{"entitlements.delivery_type"}
    Deliver -->|"saas"| Saas["Admin provisions account<br/>delivery_tasks kind = provision<br/>credentials emailed"]
    Deliver -->|"hosted"| Hosted["Admin sets up hosted instance<br/>URL + credentials emailed"]
    Deliver -->|"download"| Dl["Dashboard shows release files<br/>signed 5-min links, cap counted"]
    Deliver -->|"license"| Lic["Admin enters license key<br/>revealed only in the dashboard, email carries a link"]
    Deliver -->|"service"| Svc["service_progress rows seeded<br/>customer sees checklist progress"]
    Deliver -->|"custom"| Cust["Admin-authored instructions<br/>manual fulfilment"]
    Saas --> Active["entitlements status = active"]
    Hosted --> Active
    Dl --> Active
    Lic --> Active
    Cust --> Active
    Svc --> Steps{"All steps done?"}
    Steps -->|"no"| Svc
    Steps -->|"yes"| Active
    Active --> Fulfilled["orders status = fulfilled"]
```

**Legend:** everything from `Paid` to `Post` happens in one DB transaction (`docs/04` §7.1). Download, license and saas entitlements become `active` on paid (saas manual provisioning is tracked by `provisioning_state = pending` and does not block `active`); hosted, custom and service entitlements start `pending` until the admin completes delivery (D-601, D-608). The order is `fulfilled` when every entitlement is `active` and every service checklist is complete (MASTER_SPEC §7 "Order fulfilled"). Full payment detail is in `payment-flow.md`.

---

## 4. Subscription renewal, grace and suspension (BR-14, D-521, A-501)

```mermaid
stateDiagram-v2
    [*] --> trialing : offering.trial_days > 0
    [*] --> active : paid, no trial
    trialing --> active : trial ends and renewal paid
    trialing --> past_due : trial ends unpaid
    active --> past_due : current_period_end reached, grace_until = end + 7 days
    past_due --> active : renewal order paid and confirmed
    past_due --> suspended : cron, grace_until passed
    suspended --> active : late renewal paid and confirmed
    active --> cancelled : cancel_at_period_end and period ends
    active --> active : cancel from dashboard sets cancel_at_period_end = true
    suspended --> cancelled : customer cancels
    cancelled --> [*]

    note right of past_due
        entitlements.status stays active during grace,
        the renewal order expires_at = grace_until
    end note
    note right of suspended
        entitlements.status = suspended
        access blocked, data kept
    end note
```

```mermaid
sequenceDiagram
    autonumber
    participant Cron as cron daily job, subscriptions.remind_grace_suspend
    participant DB as Postgres
    participant N as notifications + email_outbox
    actor C as Customer
    actor A as Admin
    participant O as orders service
    participant F as finance service

    Cron->>DB: find subscriptions where current_period_end - reminder window <= now and reminder_sent_at is null
    Cron->>N: renewal reminder (email + in-app)
    Cron->>DB: reminder_sent_at = now
    N-->>C: Renew before period end

    alt Customer renews from dashboard
        C->>O: Pay renewal (same offering)
        O->>DB: orders pending_payment, subscriptions.renewal_order_id
        C->>O: submit UTR reference
        A->>O: confirm payment, amount_received
        O->>F: postOrderPaid (ledger + allocations + invoice)
        O->>DB: subscriptions: current_period_start/end advanced, status = active
        O->>N: renewal confirmed
    else No payment by period end
        Cron->>DB: status = past_due, grace_until = period_end + 7 days
        Cron->>N: grace notice
        alt Paid within grace
            C->>O: renewal order, admin confirms
            O->>DB: status = active, new period
        else Grace expires
            Cron->>DB: subscriptions.status = suspended, entitlements.status = suspended
            Cron->>N: suspended notice
            Cron->>DB: delivery_tasks kind = revoke_external if handler needs manual action
        end
    end

    opt Customer cancels
        C->>O: cancel subscription
        O->>DB: cancel_at_period_end = true, audit_logs
        Note over O,DB: access continues to current_period_end, no proration
    end
```

---

## 5. Refund request → admin → credit note → revoke (BR-09, D-505, D-414, D-415)

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant Q as queries module
    actor A1 as Admin 1 (requester)
    actor A2 as Admin 2 (approver)
    participant AP as approvals module
    participant P as payments ManualProvider
    participant F as finance service
    participant I as invoices service
    participant E as entitlements service
    participant N as notifications + email

    C->>Q: Request refund on order page opens a query (source = order, order_id), an emailed request via the invoice contact details is logged by an admin as source = email
    Note over C,Q: Never self-service (MASTER_SPEC section 7). Only manual_upi / manual_bank payments and is_refundable products
    Q-->>A1: notification, query status = open
    A1->>A1: check product.is_refundable and payments.provider is manual_*
    alt Not eligible
        A1->>Q: reply in thread, query status = resolved
        Q->>N: email + in-app to customer
    else Eligible
        A1->>AP: create approval_requests type = refund.issue, payload amount + reason
        AP-->>A2: notification pending approval
        A2->>AP: approval_decisions decision = approve (A2 ≠ A1)
        AP->>AP: status = approved, execute
        AP->>P: refund(payment, amount) records manual bank refund
        P->>F: refunds row, ledger refund_sale, refund_discount, refund_tax, refund_company_cut, refund_partner_allocation (fees and charges never reversed)
        F->>I: credit_notes row, PDF to R2
        AP->>E: onRevoked handler, entitlements.status = revoked
        E->>E: delivery_tasks kind = revoke_external if external account
        AP->>AP: orders.status = refunded or partially_refunded, status = applied, audit_logs
        AP->>N: refund confirmed + credit note PDF to customer
        A1->>Q: close thread, query status = closed
    end
```

---

## 6. Chatbot: menus, AI, caps, escalation (D-701, D-702, D-708, BR-03)

```mermaid
flowchart TD
    Open["Customer opens chatbot"] --> Auth{"Logged in and verified?"}
    Auth -->|"no"| LoginPrompt["Prompt to log in, BR-03"]
    Auth -->|"yes"| Conv["conversations row<br/>prompt_version_id, purge_after = +12 months"]
    Conv --> Menu["Quick-reply menu<br/>Order status · Downloads · Renewal · Invoices · Contact = talk to a human · Ask a question"]
    Menu -->|"Order status"| M1["modules/chat/menus.ts<br/>reads own orders, no LLM"]
    Menu -->|"Downloads"| M2["links to /account downloads"]
    Menu -->|"Contact"| Esc
    Menu -->|"Free text"| Cap{"chat_usage_daily under<br/>per-user and platform caps?"}
    Cap -->|"no"| Fallback["Menu-only answer<br/>admins notified once per day"]
    Cap -->|"yes"| Retrieve["Postgres full-text ts_rank<br/>top 8 knowledge_chunks"]
    Retrieve --> LLM["LLMProvider.stream<br/>AnthropicProvider, system prompt forbids off-context answers<br/>timeout 20 s, max 600 tokens"]
    LLM -->|"stop_reason refusal or error"| Fallback
    LLM -->|"answer"| Stream["SSE stream to client<br/>chat_messages persisted, tokens counted"]
    Stream --> Sat{"Resolved?"}
    Sat -->|"yes"| Done["Conversation ends"]
    Sat -->|"no, talk to a human"| Esc["Escalate: queries row source = chatbot<br/>conversations.escalated_query_id"]
    Esc --> AdminReply["Admin replies in thread"]
    AdminReply --> Notify["Email + in-app notification to customer"]
    M1 --> Sat
    Fallback --> Sat
```

**Legend:** menu intents never call the LLM. Caps are checked before every AI call and the count is written per user and per platform (D-708). Transcripts are purged by cron after `purge_after` (D-1503).

---

## 7. Account deletion with retention (BR-18, D-1003, D-1503)

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant UI as /account/settings
    participant U as users service
    participant DB as Postgres
    participant Cron as Cron retention job

    C->>UI: Delete my account
    UI->>C: confirm with password or re-auth
    C->>UI: confirm
    UI->>U: deleteAccount
    U->>DB: users.status = deleted, deleted_at = now
    U->>DB: delete sessions, revoke active entitlements where access is platform-held
    U->>DB: delivery_tasks kind = revoke_external for external accounts
    U->>DB: anonymise immediately, users email, phone, name, image null, anonymized_at = now, customer_profiles personal fields cleared (BR-18, MASTER_SPEC section 7)
    U->>DB: audit_logs actor = customer
    U-->>C: signed out, confirmation email sent before the address is cleared
    Note over U,DB: Orders (billing_snapshot kept for invoices), invoices, credit_notes, ledger_entries, audit_logs retained 7 years
    Cron->>DB: conversations/chat_messages purged when purge_after < today
```

**Legend:** anonymisation, not deletion, so finance and audit records stay valid (BR-18). Anonymisation is immediate on self-delete — there is no grace window (MASTER_SPEC §7 "Anonymisation timing", `docs/05` §12).

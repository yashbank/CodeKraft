# Payment Flow

**Implements:** `docs/04` §4 (QR/UPI), §7.1 PaymentProvider, §7.2 ledger posting · `docs/05` T-orders, T-payments, T-invoices, T-entitlements, T-ledger_entries · baseline §6, §7
**Decision IDs:** ADR-04, A-402, D-402, D-501, D-411, D-412, D-414, D-416, D-516, D-515, BR-06, BR-10, BR-16, BR-17, MASTER_SPEC §4.1, §4.4, §4.8

---

## 1. Status machines

```mermaid
stateDiagram-v2
    direction LR
    state "payments.status" as P {
        [*] --> initiated : createIntent
        initiated --> submitted : customer_reference submitted
        submitted --> confirmed : admin confirm, amount_received
        submitted --> failed : admin cannot find money
        initiated --> failed : order expired or cancelled
        confirmed --> refunded : refund approved and executed
        confirmed --> [*]
        failed --> [*]
        refunded --> [*]
    }
```

```mermaid
stateDiagram-v2
    direction LR
    state "orders.status" as O {
        [*] --> pending_payment : Buy now, quote accept, manual order
        pending_payment --> paid : payment confirmed
        pending_payment --> pending_payment : payment attempt failed, customer retries (D-416)
        pending_payment --> cancelled : customer or admin cancels
        pending_payment --> failed : expires_at passed with no confirmed payment (cron, reason expired)
        paid --> fulfilled : all entitlements active and checklists complete
        paid --> refunded : full refund
        paid --> partially_refunded : partial refund
        fulfilled --> refunded : full refund
        fulfilled --> partially_refunded : partial refund
        partially_refunded --> refunded : cumulative refunds reach total
        failed --> [*]
        cancelled --> [*]
        fulfilled --> [*]
        refunded --> [*]
        partially_refunded --> [*]
    }
```

**Legend:** `payments` rows are frozen once `confirmed`; the trigger allows exactly one later change, `confirmed → refunded` plus `amount_refunded_minor` (MASTER_SPEC §7, `docs/05` §12). An overpayment is stored as `payments.customer_credit_minor` and shown to admins, never allocated (MASTER_SPEC §7). A refund is a new `refunds` row plus reversal ledger entries. A new `payments` row is created for each retry while the order stays `pending_payment`; `failed` is terminal and is reached only when `expires_at` passes with no confirmed payment — including after an admin marked the reference invalid and no retry followed (MASTER_SPEC §7 "Order failed", `docs/03` FR-COM-06); `cancelled` is only a customer/admin cancel (BR-10).

---

## 2. ManualProvider path in detail (release 1)

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant UI as Checkout page
    participant OA as orders.actions
    participant OS as orders.service
    participant PP as PaymentProvider ManualProvider
    participant QR as qrcode lib
    participant DB as Postgres
    participant N as notifications
    participant EO as email_outbox / Resend
    actor A as Admin
    participant PA as payments admin action
    participant FS as finance.service
    participant IS as invoices.service
    participant R2 as Cloudflare R2
    participant ES as entitlements.service

    C->>UI: Buy now on offering, billing details, optional coupon, method manual_upi or manual_bank
    UI->>OA: createOrder(offering_id, billing, coupon, method)
    OA->>OA: Zod, session, email_verified, not already purchased (BR-10)
    OA->>OS: create in transaction
    OS->>DB: orders status = pending_payment, expires_at = now + 7 d, totals in base currency, fx_rate_to_inr
    OS->>DB: order_items (ownership_id still null until confirm)
    OS->>DB: coupon_redemptions if coupon
    OS->>PP: createIntent(order)
    alt manual_upi
        PP->>QR: upi://pay?pa=vpa&pn=CodeKraft&am=amount&cu=INR&tn=order_no
        QR-->>PP: QR data URL
    else manual_bank
        PP->>PP: bank details from site_settings, narration = order_no
    end
    PP-->>OS: instructions
    OS->>DB: payments status = initiated, amount_due_minor, instructions jsonb
    OS->>DB: analytics_events order_created
    OS-->>UI: order_no, instructions
    UI-->>C: QR or bank details, order page

    C->>C: pays in UPI app or bank
    C->>UI: submit reference (UTR / txn id)
    UI->>OA: submitReference(order_id, reference)
    OA->>DB: payments customer_reference, customer_submitted_at, status = submitted
    OA->>N: admins: payment awaiting confirmation
    OA->>EO: customer: we received your reference

    A->>PA: confirm(payment_id, amount_received_minor, note)
    PA->>PA: authz.assert payments.confirm
    PA->>PP: confirm(payment, input)
    PP-->>PA: PaymentResult ok, bank_shortfall = amount_due - amount_received
    PA->>DB: BEGIN
    PA->>DB: payments status = confirmed, amount_received_minor, bank_shortfall_minor or customer_credit_minor, confirmed_by, confirmed_at
    PA->>DB: orders status = paid, paid_at
    PA->>DB: order_items.ownership_id = active product_ownerships at confirm time, then frozen (BR-05)
    PA->>FS: postOrderPaid(order, payment)
    FS->>DB: ledger_entries per item: sale, discount, tax_collected, gateway_fee 0, bank_charge, company_cut, partner_allocation x n
    FS->>DB: allocations per item with ownership snapshot
    PA->>IS: issueInvoice(order)
    IS->>DB: SELECT invoice_sequences FOR UPDATE, seq + 1, invoice_no CK/FY/nnnn
    IS->>DB: invoices row (immutable)
    PA->>ES: grantForOrder(order)
    ES->>DB: entitlements per order_item (status per delivery_type), subscriptions if subscription
    ES->>DB: user_offering_purchases for one_time offerings
    ES->>DB: delivery_tasks kind = provision where manual provisioning
    PA->>DB: audit_logs, notifications (customer + admins), email_outbox queued
    PA->>DB: COMMIT
    PA->>IS: render invoice PDF (after commit)
    IS->>R2: put PDF, invoices.pdf_media_id
    EO-->>C: payment confirmed + invoice PDF + delivery instructions
    N-->>A: delivery task if manual provisioning
```

**Legend:** everything between BEGIN and COMMIT is atomic; if the ledger or invoice write fails the confirmation rolls back and the payment stays `submitted`. PDF rendering happens after commit and is retried by cron if R2 fails (`docs/04` §10). Order and ledger code only see `PaymentProvider` and `PaymentResult`, never UPI specifics (ADR-04).

---

## 3. Shortfall handling (D-516, BR-06)

```mermaid
flowchart LR
    Due["amount_due_minor<br/>e.g. 10000"] --> Recv["amount_received_minor<br/>e.g. 9950"]
    Recv --> SF["bank_shortfall_minor = 50"]
    SF --> L1["ledger bank_charge -50<br/>party_type = bank"]
    SF --> Dist["distributable = gross - discount - tax - gateway_fee - bank_charge"]
    Dist --> Cut["company_cut = distributable x company_cut_bps"]
    Cut --> Rem["remainder split by product_ownership_lines.share_bps"]
```

---

## 4. Expiry and retry (BR-10, D-416)

```mermaid
sequenceDiagram
    autonumber
    participant Cron as cron frequent job, orders.expire
    participant DB as Postgres
    participant N as notifications
    actor C as Customer

    Cron->>DB: orders where status = pending_payment and expires_at < now
    Cron->>DB: orders status = failed, reason expired, payments initiated/submitted -> failed reason expired
    Cron->>N: customer email: order expired, buy again
    Cron->>DB: job_runs row
    opt Payment failed but order still open
        C->>DB: retry from order page creates a new payments row status = initiated
    end
```

---

## 5. Future gateway path (V1.1, D-501): only the provider changes

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant UI as Checkout page
    participant OS as orders.service
    participant GP as PaymentProvider RazorpayProvider
    participant GW as Razorpay
    participant WH as api/webhooks/razorpay
    participant PS as payments.service confirm
    participant FS as finance.service
    participant IS as invoices.service
    participant ES as entitlements.service
    participant DB as Postgres

    C->>UI: Buy now, method razorpay (flag provider_razorpay on)
    UI->>OS: createOrder
    OS->>DB: orders pending_payment, order_items, same as manual
    OS->>GP: createIntent(order)
    GP->>GW: create gateway order
    GW-->>GP: gateway order id, checkout params
    GP-->>OS: instructions (checkout params)
    OS->>DB: payments status = initiated, provider = razorpay, provider_payload
    UI-->>C: gateway checkout widget
    C->>GW: pay by card / UPI / netbanking
    GW->>WH: webhook payment.captured (signed)
    WH->>DB: webhook_events insert (provider, event_id) UNIQUE, stop if duplicate
    WH->>GP: handleWebhook(req) verifies signature
    GP->>PS: confirm(payment, {amount_received, gateway_fee, provider_payload})
    Note over PS,ES: Identical to ManualProvider from here: same transaction, same code
    PS->>DB: payments confirmed, orders paid
    PS->>FS: postOrderPaid: gateway_fee > 0, bank_charge 0
    PS->>IS: issueInvoice
    PS->>ES: grantForOrder
    PS->>DB: audit_logs, notifications, email_outbox
    WH-->>GW: 200
    opt Refund via gateway
        Note over GP: refund() calls gateway API, ledger reversal unchanged
    end
```

```mermaid
flowchart LR
    subgraph Providers ["modules/payments/providers"]
        Manual["ManualProvider<br/>manual_upi, manual_bank<br/>release 1"]
        Razor["RazorpayProvider<br/>V1.1 flag provider_razorpay"]
        Stripe["StripeProvider<br/>V1.1 flag provider_stripe"]
        PayPal["PayPalProvider<br/>V1.1 flag provider_paypal"]
    end
    Iface["interface PaymentProvider<br/>createIntent · confirm · refund? · handleWebhook?"]
    Manual --> Iface
    Razor --> Iface
    Stripe --> Iface
    PayPal --> Iface
    Iface --> Core["Unchanged core<br/>orders.service · payments.service.confirm · finance.postOrderPaid · invoices · entitlements"]
    Core --> DB[("orders, payments, ledger_entries, allocations, invoices, entitlements")]
```

**Legend:** the only provider-specific columns are `payments.provider` and `payments.provider_payload`, plus the `webhook_events` idempotency table; `gateway_fee` becomes non-zero and `bank_charge` zero. Order status, ledger posting, invoice issuing and entitlement creation are the same functions (MASTER_SPEC §4.4). Gateway refund wording remains an open legal item (R-502).

# Admin Flows

**Implements:** baseline §10 admin journeys, §4 permission model · `docs/04` §6, §7.4, §7.6, §7.7 · `docs/05` T-products, T-product_ownerships, T-approval_requests, T-payments, T-orders, T-invoices, T-leads, T-queries, T-payouts, T-expenses, T-dashboard_layouts
**Decision IDs:** D-1102, D-1104, D-1105, D-1107, D-1101, D-120, D-508, D-509, D-516, D-511, D-514, D-703, D-704, D-705, D-706, D-702, D-1106, A-302, A-1101, BR-05, BR-06, BR-12, BR-13, BR-16, BR-17

Every admin mutation runs as a Server Action: Zod parse → `authz.assert` → `service` in one transaction → `audit_logs` row → `revalidateTag` (`docs/04` §6). That chain is implied in every diagram below and drawn only once (§1).

---

## 1. Product creation → offerings → ownership proposal → dual approval → schedule/publish (A-302, D-1102, BR-05, BR-12)

```mermaid
flowchart TD
    Create["Admin creates product<br/>products.status = draft"] --> Fill["Fill identity, content, media, SEO, flags"]
    Fill --> Off["Add offerings 1..n<br/>purchase_model, prices per currency, delivery_type, delivery_config, payment methods"]
    Off --> Own["Propose ownership<br/>product_ownerships version n status = pending<br/>lines sum = 10000 bps"]
    Own --> OwnAR["approval_requests type = ownership.change"]
    OwnAR --> OwnOK{"Other admin approves?"}
    OwnOK -->|"reject"| Own
    OwnOK -->|"approve"| OwnActive["ownership status = active, effective_from = now<br/>previous version = superseded"]
    OwnActive --> Submit["Submit for publish<br/>products.status = pending_approval<br/>approval_requests type = product.publish"]
    Submit --> PubOK{"Other admin approves?<br/>submitter never counts"}
    PubOK -->|"reject with comment"| Draft["products.status = draft"]
    Draft --> Fill
    PubOK -->|"approve"| When{"publish_at set?"}
    When -->|"future"| Sched["products.status = scheduled"]
    Sched --> Cron["cron frequent job, publish.scheduled<br/>publish_at <= now"]
    Cron --> Pub
    When -->|"now"| Pub["products.status = published<br/>published_at = now"]
    Pub --> Reval["revalidateTag content<br/>knowledge_chunks rebuild<br/>sitemap updated"]
    Pub --> Unpub["Unpublish<br/>status = unpublished"]
    Unpub --> Submit
    Pub --> ArchAR["approval_requests type = product.archive<br/>status = archived"]
    Unpub --> ArchAR
    Draft --> DelCheck{"zero orders?"}
    DelCheck -->|"yes"| DelAR["approval_requests type = product.delete"]
    DelCheck -->|"no"| ArchAR
```

```mermaid
stateDiagram-v2
    [*] --> draft : create
    draft --> pending_approval : submit for publish
    pending_approval --> draft : rejected
    pending_approval --> scheduled : approved with publish_at in future
    pending_approval --> published : approved, publish now
    scheduled --> published : cron at publish_at
    published --> unpublished : unpublish
    unpublished --> pending_approval : resubmit
    published --> archived : product.archive approved
    unpublished --> archived : product.archive approved
    draft --> archived : product.archive approved
    draft --> [*] : product.delete approved, zero orders only BR-11
    archived --> [*]
```

**Legend:** an ownership must be `active` before publish so that every paid order item can snapshot an `ownership_id` (BR-05). Deletion is possible only with zero orders; otherwise archive (BR-11).

---

## 2. Payment confirmation with shortfall (D-516, D-411, BR-06)

```mermaid
flowchart TD
    Queue["Widget: payments awaiting confirmation<br/>payments.status = submitted"] --> Open["Open order<br/>see customer_reference, amount_due_minor, instructions"]
    Open --> Check["Admin checks bank/UPI app for the reference"]
    Check --> Found{"Money received?"}
    Found -->|"no"| Fail["payments.status = failed<br/>failure_reason<br/>customer notified, may retry"]
    Found -->|"yes"| Amt["Enter amount_received_minor"]
    Amt --> Cmp{"amount_received vs amount_due"}
    Cmp -->|"equal"| Zero["bank_shortfall_minor = 0"]
    Cmp -->|"less"| Short["bank_shortfall_minor = due - received<br/>absorbed before split, BR-06"]
    Cmp -->|"more"| Over["Overpayment: customer_credit_minor = received - due<br/>shown to admins, never allocated to partners"]
    Zero --> Confirm
    Short --> Confirm
    Over --> Confirm
    Confirm["One transaction:<br/>payments.status = confirmed, confirmed_by, confirmed_at<br/>orders.status = paid, paid_at<br/>order_items.ownership_id = active ownership, then frozen"] --> Post["finance.postOrderPaid<br/>ledger_entries incl. bank_charge = shortfall<br/>allocations per item"]
    Post --> Inv["invoices row, invoice_sequences locked<br/>PDF rendered to R2"]
    Inv --> Ent["entitlements per order_item<br/>user_offering_purchases for one_time"]
    Ent --> Audit["audit_logs + notifications + email_outbox"]
    Audit --> Next{"delivery needs admin?"}
    Next -->|"saas / hosted / custom / service"| Task["delivery_tasks kind = provision<br/>shows in operations queue"]
    Next -->|"download / license"| Auto["Auto-active, license key entry if license"]
```

---

## 3. Manual project order and invoice (D-1107, D-510, A-502, BR-16)

```mermaid
sequenceDiagram
    autonumber
    actor A as Super Admin
    participant O as orders service
    participant AP as approvals module
    actor A2 as Other admin
    participant P as payments ManualProvider
    participant F as finance service
    participant I as invoices service
    participant R2 as Cloudflare R2
    participant RS as Resend

    A->>O: create manual order type = project, client_name/email/company, currency
    A->>O: add order_items with free-form description, unit_minor, tax per line, split_snapshot per line (company_cut_bps + partner lines)
    O->>O: orders.status = pending_payment, created_by = admin, order_no CK-ORD-nnnnnn
    O->>AP: approval_requests type = project_order.split, payload = per-line snapshots
    O->>O: audit_logs
    AP-->>A2: pending approval, notification
    A2->>AP: approve (A2 is not the requester, BR-13)
    AP->>O: split approved, split_snapshot frozen, invoice and payment now allowed
    opt Send pro-forma to client
        O->>RS: email with bank details and order_no
    end
    A->>P: confirm payment with reference and amount_received
    P->>O: payments.status = confirmed, orders.status = paid
    O->>F: postOrderPaid
    Note over F: project items have no ownership_id, posting uses order_items.split_snapshot exactly like a product ownership version (MASTER_SPEC section 7)
    F->>F: ledger_entries sale, tax_collected, bank_charge, company_cut, partner_allocation
    O->>I: issueInvoice
    I->>I: lock invoice_sequences for fy, next seq, invoice_no CK/2026-27/0001
    I->>R2: store PDF, invoices.pdf_media_id
    I->>RS: invoice email to client_email
    A->>O: mark fulfilled when the engagement is delivered
    O->>O: orders.status = fulfilled, fulfilled_at
```

**Legend:** project revenue flows through the same order and ledger model as product sales (A-502). Each project line carries a `split_snapshot`; the order cannot be invoiced or paid until the `project_order.split` request is approved by the other admin(s) (MASTER_SPEC §7 "Project order splits", BR-05). Offline product sales use the same path with `type = product`, real offerings and no split approval.

---

## 4. Lead pipeline state machine (D-703, D-704, D-705, D-706)

```mermaid
stateDiagram-v2
    [*] --> new : inquiry_form | product_cta | chatbot | manual
    new --> contacted : admin claims from pool and reaches out
    contacted --> qualified : fit confirmed
    contacted --> lost : no response or not a fit
    qualified --> proposal : proposal sent
    qualified --> lost
    proposal --> won : accepted, won_order_id set to manual project order
    proposal --> lost : lost_reason
    won --> [*]
    lost --> [*]

    note right of new
        assigned_to null = shared pool
        next_follow_up_at overdue highlighted
    end note
```

```mermaid
flowchart LR
    Pool["Shared pool<br/>assigned_to null"] -->|"claim"| Mine["assigned_to = me"]
    Pool -->|"assign"| Other["assigned_to = other admin<br/>lead_activities kind = assignment"]
    Mine --> Act["Notes, calls, emails<br/>lead_activities"]
    Act --> FU["Set next_follow_up_at<br/>kind = follow_up_set"]
    FU --> Over{"overdue?"}
    Over -->|"yes"| Digest["Daily email digest to admins, R-701<br/>in-app highlight"]
    Over -->|"no"| Act
    Act --> Status["status change<br/>lead_activities kind = status_change"]
    Status --> Won["won: create manual project order, see 3"]
```

---

## 5. Query handling (D-702, D-1002)

```mermaid
stateDiagram-v2
    [*] --> open : form, chatbot escalation, order page, dashboard, email or manual (logged by admin)
    open --> waiting_customer : admin replied
    waiting_customer --> open : customer replied
    open --> resolved : admin resolves
    waiting_customer --> resolved : admin resolves
    resolved --> open : customer reopens
    resolved --> closed : admin closes
    closed --> [*]
```

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant Q as queries module
    participant N as notifications
    actor A as Admin

    C->>Q: new query (subject, source, order_id?)
    Q->>N: in-app notification to admins (persisted inbox)
    A->>Q: claim, queries.assigned_to = A
    A->>Q: reply, query_messages author_kind = admin
    Q->>Q: status = waiting_customer, audit_logs
    Q->>N: email + in-app to customer
    C->>Q: reply, author_kind = customer
    Q->>Q: status = open
    Q->>N: in-app to assigned admin
    A->>Q: resolve
    Q->>Q: status = resolved
    Q->>N: email + in-app to customer
```

---

## 6. Generic approval request sequence (A-1101, BR-13, MASTER_SPEC §4.5)

```mermaid
sequenceDiagram
    autonumber
    actor R as Requester admin
    participant M as Domain module
    participant AP as approvals module
    participant DB as Postgres
    participant N as notifications
    actor V as Approver admin (≠ requester)

    R->>M: critical action (publish, ownership change, project order split, adjustment, refund, payout, archive, delete, admin user change)
    M->>AP: request(type, subject_type, subject_id, payload)
    AP->>DB: approval_requests status = pending, requested_by = R
    AP->>DB: audit_logs
    AP->>N: notify all admins except R
    N-->>V: Approvals inbox badge (poll every 10 s)
    V->>AP: decide(request_id, approve | reject, comment)
    AP->>DB: approval_decisions (trigger rejects decided_by = requested_by)
    alt Any reject
        AP->>DB: status = rejected
        AP->>N: notify requester
    else All required approvers approved
        AP->>DB: status = approved
        AP->>M: apply handler for type with payload, inside one transaction
        M->>DB: domain writes (e.g. products.status, ownership active, ledger entries, payouts row)
        AP->>DB: status = applied, applied_at
        AP->>DB: audit_logs before/after
        AP->>N: notify requester and approvers
    end
    opt Apply throws
        AP->>DB: status = approved, error = message (retryable by an admin)
    end
```

**Legend:** with two founders "all admins except the requester" means the other founder. Requests never expire; the system widget shows pending age (`docs/04` §13).

---

## 7. Payout recording (D-511, D-1105, BR-13)

```mermaid
sequenceDiagram
    autonumber
    actor CFO as Admin recording payout
    participant FIN as finance module
    participant AP as approvals module
    actor CEO as Other admin
    participant DB as Postgres
    participant PDF as pdf/ statement

    CFO->>FIN: view partner_balances, pick partner, amount, paid_on, bank reference
    FIN->>AP: approval_requests type = payout.record, payload
    AP-->>CEO: pending approval
    CEO->>AP: approve
    AP->>FIN: applyPayoutRecord
    FIN->>DB: payouts row (immutable)
    FIN->>DB: ledger_entries entry_type = payout, party_type = partner, amount negative, fx_rate_to_inr, amount_inr_minor
    FIN->>DB: audit_logs
    FIN-->>CFO: partner_balances reduced
    opt Statement
        CFO->>PDF: partner statement PDF + CSV for a period
    end
```

---

## 8. Expense entry (D-514)

```mermaid
flowchart TD
    Start["Admin records expense"] --> Form["category, description, amount_minor, currency, incurred_on, receipt upload to R2"]
    Form --> Prod{"Against a product?"}
    Prod -->|"no"| Company["product_id = null<br/>company expense"]
    Prod -->|"yes"| Shared{"shared_by_split?"}
    Shared -->|"true, default"| Split["expense shared by active ownership split<br/>reduces each partner balance by share"]
    Shared -->|"false"| CompanyOnly["company-only expense"]
    Company --> Post["expenses row<br/>ledger_entries entry_type = expense<br/>one line per party"]
    Split --> Post
    CompanyOnly --> Post
    Post --> Audit["audit_logs"]
    Audit --> Report["Reports: profit per product = revenue - expenses"]
```

**Legend:** expenses do not require dual approval (BR-13 list); corrections are adjusting entries via `ledger.adjustment` (BR-17).

---

## 9. Content publish and revalidation (D-1106, ADR-10, `docs/04` §7.7)

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant UI as Admin content editor (Tiptap)
    participant SA as Server Action
    participant DB as Postgres
    participant Next as Next.js cache
    participant K as knowledge re-index

    A->>UI: edit landing chapter, service, case study, testimonial, logo, FAQ, legal page or product blog
    UI->>SA: save (Tiptap JSON)
    SA->>SA: authz.assert content.write, Zod validate, sanitise on render
    SA->>DB: upsert row, published = true or status = published
    SA->>DB: audit_logs before/after
    SA->>Next: revalidateTag content (and product tag for product blogs)
    SA->>K: rebuild knowledge_chunks for source_type/source_id
    Next-->>A: public page updated on next request
    Note over SA,DB: legal_pages bump version. Product publish itself still needs approval, see flow 1
```

---

## 10. Widget dashboard layout save (D-120, D-1101, `docs/04` §7.6)

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant Grid as react-grid-layout
    participant Reg as dashboard-widgets registry
    participant SA as Server Action saveLayout
    participant DB as Postgres

    A->>Grid: open dashboard
    Grid->>SA: loadLayout
    SA->>DB: dashboard_layouts where user_id = A
    alt No layout yet
        SA->>Reg: default layout from registry
    end
    SA-->>Grid: layout JSON
    loop each widget
        Grid->>Reg: dataLoader (Server Action, requiredPermission checked)
        Reg-->>Grid: JSON for Recharts
    end
    A->>Grid: drag, resize, add or remove widget
    Grid->>SA: saveLayout(layout JSON) debounced
    SA->>SA: authz.assert, validate widget keys exist in registry
    SA->>DB: upsert dashboard_layouts (user_id, layout, updated_at)
    SA-->>Grid: saved
    Note over A,DB: personal preference, no audit_logs row required, no approval
```

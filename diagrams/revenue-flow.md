# Revenue Flow and Finance Ledger

**Implements:** baseline §7 revenue model, BR-05, BR-06, BR-07, BR-08, BR-17 · `docs/04` §7.2 · `docs/05` §4 ownership, §7 ledger · MASTER_SPEC §4.1, §4.8, §7 (tax before GST)
**Decision IDs:** D-506, D-507, D-508, D-509, D-511, D-513, D-514, D-515, D-516, D-517, D-1105, D-1501, A-502, ADR-05

All amounts are integer minor units in the transaction currency plus an INR equivalent at the payment-date `fx_rate_to_inr` (D-515). Entry types are the `ledger_entries.entry_type` enum values.

---

## 1. Money flow: customer → CodeKraft account → partners

```mermaid
flowchart LR
    Cust["Customer"] -->|"UPI or bank transfer<br/>release 1"| Bank[("Single CodeKraft bank account<br/>D-511")]
    Cust -.->|"card, UPI, wallet via gateway<br/>V1.1"| GW["Gateway settlement<br/>minus gateway_fee"]
    GW -.-> Bank
    Client["Project client"] -->|"invoice payment, manual order"| Bank
    Bank -->|"tax_collected, remitted when GSTIN set"| Tax["Tax authority"]
    Bank -->|"company_cut"| Company["CodeKraft company share"]
    Bank -->|"expenses, receipts"| Vendors["Suppliers"]
    Bank -->|"payout, manual transfer, dual approved"| P1["Partner 1 bank"]
    Bank -->|"payout"| P2["Partner 2 bank"]
    Bank -->|"refund, manual bank transfer"| Cust
    Ledger[("ledger_entries<br/>append-only journal of every arrow above")]
    Bank -.-> Ledger
```

**Legend:** money physically moves only through the single company account; the ledger is the record, never the mover (automated payouts are V2). Buyers never see partners (BR-02).

---

## 2. Ledger posting per order item on payment confirmation (BR-06, D-507, D-516)

```mermaid
flowchart TD
    Paid["finance.postOrderPaid<br/>same transaction as payments.status = confirmed"] --> Item["for each order_items row"]
    Item --> Gross["sale +unit_minor x quantity<br/>party_type = customer"]
    Gross --> Disc["discount -discount_minor<br/>coupon or compare_at"]
    Disc --> TaxQ{"product.tax_enabled<br/>and GSTIN configured?"}
    TaxQ -->|"yes"| Tax["tax_collected +tax_minor<br/>party_type = tax_authority"]
    TaxQ -->|"no"| NoTax["tax = 0, no tax line, BR-08"]
    Tax --> Fee
    NoTax --> Fee
    Fee["gateway_fee -fee<br/>0 for manual, party_type = gateway"] --> Short["bank_charge -bank_shortfall_minor share<br/>party_type = bank"]
    Short --> Dist["distributable =<br/>gross - discount - tax - gateway_fee - bank_charge"]
    Dist --> Own["ownership = order_items.ownership_id<br/>active version at confirm time"]
    Own --> Cut["company_cut = distributable x company_cut_bps / 10000<br/>party_type = company"]
    Cut --> Rem["remainder = distributable - company_cut"]
    Rem --> Lines["for each product_ownership_lines row"]
    Lines --> Alloc["partner_allocation = remainder x share_bps / 10000<br/>party_type = partner, partner_id"]
    Alloc --> Round["rounding remainder in minor units goes to the last line"]
    Round --> Snap["allocations row<br/>company_cut_bps, distributable_minor, company_minor, lines jsonb"]
    Snap --> Inv["invariant: sum of partner lines + company_minor = distributable"]
```

```mermaid
flowchart LR
    subgraph Example ["Worked example, INR paise, one item"]
        direction TB
        E1["sale +1000000"] --> E2["discount -100000"] --> E3["tax_collected +162000 at 18 percent on 900000"] --> E4["gateway_fee 0"] --> E5["bank_charge -500 shortfall"]
        E5 --> E6["distributable = 1000000 - 100000 - 162000 - 0 - 500 = 737500"]
        E6 --> E7["company_cut 10 percent = 73750"]
        E7 --> E8["remainder 663750"]
        E8 --> E9["partner A 60 percent = 398250"]
        E8 --> E10["partner B 40 percent = 265500"]
    end
```

**Legend:** BR-06 formula exactly: distributable = gross − discount − tax − gateway charges − bank shortfall; company cut first (may be 0), remainder by percentages totalling 100%. The `bank_charge` for a multi-item order is apportioned across items by total_minor. Amounts are signed from the company's point of view in `ledger_entries.amount_minor`.

---

## 3. Refund reversal (BR-09, D-414, `docs/04` §7.2)

```mermaid
flowchart TD
    Req["approval_requests type = refund.issue<br/>approved by other admin"] --> Ratio["ratio = refund amount / item total_minor<br/>full refund ratio = 1"]
    Ratio --> RS["refund_sale -gross x ratio<br/>party_type = customer"]
    RS --> RD["refund_discount +discount x ratio<br/>reverses the discount line"]
    RD --> RT["refund_tax -tax x ratio<br/>party_type = tax_authority"]
    RT --> RC["refund_company_cut -company_cut x ratio<br/>party_type = company"]
    RC --> RP["refund_partner_allocation -allocation x ratio<br/>one per partner line, partner_id"]
    RP --> Rows["refunds row, credit_notes row, PDF<br/>payments confirmed to refunded, amount_refunded_minor"]
    Rows --> Ord{"ratio = 1?"}
    Ord -->|"yes"| Full["orders.status = refunded"]
    Ord -->|"no"| Part["orders.status = partially_refunded"]
    Full --> Rev["entitlements.status = revoked"]
    Part --> Rev2["entitlement kept unless admin revokes"]
    Rows --> Bal["partner_balances drop by the reversed allocations"]
```

**Legend:** original entries are never touched (BR-17); every reversal is a new entry linked by `refund_id`: sale, discount, tax, company cut and partner allocations proportionally (`refund_sale`, `refund_discount`, `refund_tax`, `refund_company_cut`, `refund_partner_allocation`). `bank_charge` and `gateway_fee` are never reversed because the bank and gateway keep them (MASTER_SPEC §7 "Refund reversal scope").

---

## 4. Payout (D-511, D-1105)

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant F as finance module
    participant AP as approvals
    participant DB as Postgres

    A->>F: partner_balances for partner P, currency INR, shows balance_minor
    A->>F: record payout amount, paid_on, bank reference
    F->>AP: approval_requests type = payout.record
    AP-->>A: waits for other admin
    AP->>F: approved, applyPayoutRecord
    F->>DB: payouts row (immutable)
    F->>DB: ledger_entries entry_type = payout, party_type = partner, partner_id = P, amount_minor = -amount, payout_id
    F->>DB: audit_logs
    Note over F,DB: balance after = balance before - amount, always derived, never stored
```

---

## 5. Expense (D-514)

```mermaid
flowchart TD
    Exp["expenses row<br/>amount_minor, product_id?, shared_by_split"] --> Q{"product_id set and<br/>shared_by_split = true?"}
    Q -->|"no"| CompanyLine["expense -amount<br/>party_type = company"]
    Q -->|"yes"| Own["active product_ownerships of product"]
    Own --> CutLine["expense -amount x company_cut_bps / 10000<br/>party_type = company"]
    Own --> PartnerLines["expense -amount x share_bps of remainder<br/>party_type = partner, per partner"]
    CompanyLine --> Profit["Profit per product = sale - discount - refunds - expenses"]
    CutLine --> Profit
    PartnerLines --> Bal["partner_balances reduced by each partner share"]
```

---

## 6. Partner balance computation (VIEW partner_balances)

```mermaid
flowchart LR
    A["Σ partner_allocation<br/>partner_id = P"] --> Sum
    B["- Σ refund_partner_allocation"] --> Sum
    C["- Σ payout"] --> Sum
    D["- Σ expense lines where party_type = partner and partner_id = P"] --> Sum
    Sum["balance_minor per currency<br/>balance_inr_minor via amount_inr_minor"] --> View["partner_balances view<br/>grouped by partner_id, currency"]
    View --> W1["Widget: my share"]
    View --> W2["Widget: outstanding payouts"]
    View --> W3["Partner statement PDF + CSV, D-513"]
    Adj["adjustment entries<br/>ledger.adjustment approval, signed, partner_id optional"] --> Sum
```

**Legend:** balances are sums over `ledger_entries` only (ADR-05). An Admin-role user sees only rows where `partner_id` is their own partner (D-512); Super Admins see all.

---

## 7. Ownership versioning timeline: immutability of past allocations (BR-05, D-509)

```mermaid
gantt
    title One product, ownership versions and the orders that snapshot them
    dateFormat YYYY-MM-DD
    axisFormat %d %b
    section product_ownerships
    v1 active, company 10, A 60, B 40           :done, v1, 2026-10-01, 2027-01-14
    v2 pending, awaiting other admin            :active, v2p, 2027-01-05, 2027-01-14
    v2 active, company 10, A 50, B 50           :v2, 2027-01-15, 2027-03-31
    v1 superseded                               :crit, v1s, 2027-01-15, 2027-03-31
    section orders confirmed
    Order 1 paid, ownership_id = v1             :milestone, o1, 2026-11-10, 0d
    Order 2 paid, ownership_id = v1             :milestone, o2, 2027-01-10, 0d
    Order 3 paid, ownership_id = v2             :milestone, o3, 2027-02-03, 0d
    Refund of order 1 reverses v1 split         :milestone, r1, 2027-02-20, 0d
```

```mermaid
flowchart LR
    subgraph V1 ["product_ownerships v1 · superseded"]
        L1["lines: A 6000 bps, B 4000 bps<br/>company_cut_bps 1000"]
    end
    subgraph V2 ["product_ownerships v2 · active"]
        L2["lines: A 5000 bps, B 5000 bps<br/>company_cut_bps 1000<br/>approval_request_id ownership.change"]
    end
    O1["order_items 1<br/>ownership_id = v1"] --> A1["allocations 1<br/>frozen at v1 numbers"]
    O2["order_items 2<br/>ownership_id = v1"] --> A2["allocations 2<br/>frozen at v1 numbers"]
    O3["order_items 3<br/>ownership_id = v2"] --> A3["allocations 3<br/>v2 numbers"]
    V1 -.->|"snapshot"| O1
    V1 -.->|"snapshot"| O2
    V2 -.->|"snapshot"| O3
    V1 -->|"superseded by approval"| V2
    A1 -.->|"refund reverses these exact amounts"| R1["refund_partner_allocation<br/>A -60 percent share, B -40 percent share"]
```

**Legend:** a split change is a new `product_ownerships` version that becomes `active` only when the `ownership.change` request is approved by the other admin; it applies to payments confirmed after `effective_from`. Orders confirmed under v1 keep `order_items.ownership_id = v1` and their `allocations` rows forever, and a later refund reverses the v1 numbers, not v2 (BR-05, BR-17).

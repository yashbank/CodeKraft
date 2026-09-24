# PHASE-04 — Commerce & finance

**Wave:** W3 (parallel with P3, P5, P6; 2 agents: A = orders/payments/coupons/quotes/invoices, B = finance) · **Roadmap items:** R1-11, R1-12, R1-13, R1-14, R1-16 · **Master plan §6 gate:** integration + property tests: order totals; manual confirm with shortfall; ledger invariants; invoice numbering gapless under concurrency; refund reversal; payout/expense posting; reports match ledger.

## Phase objective

Make a manual order go end to end on the server: single-offering checkout with coupons and tax rules, custom quotes, manual/project orders with dual-approved `split_snapshot`, `ManualProvider` (UPI intent QR, bank instructions), customer reference submission, admin confirmation with received amount/shortfall/overpayment, order expiry, gapless FY invoice numbering with PDF, credit notes, refunds through approval, and the append-only ledger: posting on paid with largest-remainder allocation, refund reversals, payouts (approval + balance check), expenses, adjustments, reports and partner statements. Finance invariants FI-01..14 are proven by property tests. Master plan §1.4: after this phase the founders can take a manual order from the admin app (P8 wires the screens).

## Prerequisites

- P2 done (schema, contracts frozen, factories, seed, `tests/stubs`).
- From P3 (or stubs until they land): `audit.log` (P3.1), `approvals` (P3.2), `settings.effectiveTaxRateBps` (P3.3), `ownership.getActiveOwnership` (P3.8), `fx.rateToInrOn` (P3.12), `media/storage` client for PDFs (P3.5).
- P5 contract `entitlements.grantForOrder/revoke` is stubbed (`tests/stubs/entitlements.ts`); P4 never imports P5's implementation.
- Env: `APP_ENCRYPTION_KEY`, storage vars (MinIO), `SEED_*` for UPI VPA / bank details in `site_settings`.
- Rules applied (all settled in the docs, nothing open in `ISSUES.md`): overpayment → `customer_credit_minor`, never allocated (FR-PAY-07, API-PAY-03, `customer_credits` view); payout > balance refused (FR-FIN-07); remainder to largest share (FR-FIN-02); coupon counted at Paid under `FOR UPDATE` (TM-06, docs/10 Open #6); project orders blocked until `project_order.split` is applied (API-COM-07, `orders.split_approval_request_id`); expiry sets `failed`, never `cancelled` (docs/03 §3.1).

## Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P4.1 | Finance core: allocation math, `postOrderPaid`, ledger + allocations, FX on entries | domain-critical (B) | — |
| P4.2 | Orders core: numbering, `previewCheckout`, `createOrder`, totals/tax, cancel/retry, `orders.expire` job (`src/jobs/order-expiry.ts`), queries | domain-critical (A) | — |
| P4.3 | Coupons | domain-standard (A) | P4.2 |
| P4.4 | `ManualProvider` + payments service (intents, reference, confirm/fail orchestration, chargeback) | domain-critical (A) | P4.1, P4.2 |
| P4.5 | Invoices: gapless FY numbering, PDF, GST switch, credit notes, presigned access | domain-critical (A) | P4.2 |
| P4.6 | Custom quotes + `quotes.expire` job (`src/jobs/quote-expiry.ts`) | domain-standard (A) | P4.2, P4.4 |
| P4.7 | Manual & project orders with `split_snapshot` + `project_order.split` approval | domain-critical (A) | P4.4, P4.5, P4.1 |
| P4.8 | Refunds: propose/apply, `postRefund`, credit note, revocation call | domain-critical (B) | P4.1, P4.4, P4.5 |
| P4.9 | Payouts with approval and balance check; partner balances | domain-critical (B) | P4.1 |
| P4.10 | Expenses and ledger adjustments | domain-critical (B) | P4.1 |
| P4.11 | Reports and partner statements (PDF/CSV) | domain-standard (B) | P4.8, P4.9, P4.10 |
| P4.12 | Property suite FI-01..14 + `finance.reconcile` service (NFR-DATA-04 nightly reconciliation) | domain-critical (B) | P4.1, P4.4, P4.5, P4.8, P4.9, P4.10 |
| P4.13 | Phase gate: integration scenarios (server side) + reviewer | reviewer | all |

### P4.1 Finance core: allocation math, `postOrderPaid`, ledger + allocations, FX on entries
- Owner profile: domain-critical (agent B)
- Requirement IDs: FR-FIN-01, FR-FIN-02, FR-FIN-03, FR-FIN-04, FR-PAY-15, FR-COM-11, FR-COM-12, NFR-DATA-03, NFR-DATA-04, BR-05, BR-06, BR-07, BR-17, D-507, D-515, D-516, API-FIN-01, API-FIN-02, docs/06 §4.2 (posting formula), §6 "What must never change" (b), FI-01, FI-02, FI-04, FI-10, FI-11, FI-12, master plan §5 `finance.postOrderPaid`, MASTER_SPEC §4.1, §4.8, §7 "Split rounding"
- Description: Pure `computeAllocation({ gross, discount, tax, gatewayFee, bankShortfall }, { companyCutBps, lines })` using `lib/money.allocateLargestRemainder`: `distributable = gross − discount − tax − gatewayFee − bankShortfall`; `company = distributable × cut / 10000`; partner lines by `share_bps` with the remainder to the largest share (ties → earliest line); Σ = distributable exactly. `postOrderPaid(orderId, tx)`: loads order + items + confirmed payment; spreads shortfall/fee across items pro-rata by item total (largest-remainder); resolves the ownership version active at `paid_at` (`ownership.getActiveOwnership(productId, paidAt)`) or, for project lines, `order_items.split_snapshot` (the order's `split_approval_request_id` must reference an `applied` `project_order.split` request — `STATE_INVALID` otherwise, MASTER_SPEC §7 "Project order splits"); updates `order_items.ownership_id` only when superseded meanwhile (the single permitted update); writes per item `sale`, `discount`, `tax_collected`, `gateway_fee`, `bank_charge`, `company_cut`, `partner_allocation × n` entries with `party_type`, signed amounts so Σ per order per currency = 0 (FI-04), `fx_rate_to_inr` from `fx.rateToInrOn(paidAt)` and `amount_inr_minor`; writes one `allocations` row per item. `getOrderAllocation`, `listLedgerEntries` (filters per API-FIN-01, sort `seq`, `totals.byType`), scope: `admin` role sees own partner lines + own-product entries.
- Owned paths: `src/modules/finance/{service,actions,queries,allocation,posting,entries}.ts`. Forbidden: `orders/**`, `payments/**` (read via queries only).
- Dependencies: P2 contracts; P3.8/P3.12 via stubs until merged.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/finance/allocation.test.ts` (examples: 60/40 with 10 % cut; 100 % single partner; 3-way 3333/3333/3334 with remainder), `posting.test.ts` (entry set per item, sign convention, pro-rata shortfall spread); property `tests/property/finance.spec.ts` FI-01, FI-02, FI-04, FI-11, FI-12 (500 runs CI); integration `tests/integration/finance/{post-order-paid,ownership-at-paid-time,project-split-snapshot,scope-admin-role}.test.ts` (FI-10).
- Acceptance criteria:
  - [ ] FI-01, FI-02, FI-04, FI-11, FI-12 pass 500 runs
  - [ ] allocation uses the ownership active at `paid_at`, not order creation (FI-10)
  - [ ] a project line without approved `split_snapshot` cannot be posted
  - [ ] `admin`-role caller cannot read other partners' lines (`FORBIDDEN` without `read_all`)
- Definition of Done: code + unit + property + integration (coverage ≥ 95/90/95) + PROGRESS row + CI green.
- Potential risks and mitigations: formula "frozen" per docs/06 §6 → `tests/static/contract-freeze` includes `allocation.ts` hash; pro-rata spread of shortfall across items creates its own rounding → same largest-remainder helper, property-tested.

### P4.2 Orders core
- Owner profile: domain-critical (agent A)
- Requirement IDs: FR-COM-01, FR-COM-02, FR-COM-03, FR-COM-04, FR-COM-05, FR-COM-06, FR-COM-13, FR-COM-14, FR-AUTH-02, BR-03, BR-08, BR-10, D-410, D-411, D-412, D-413, D-416, D-1501, ADR-12, API-COM-01, API-COM-02, API-COM-03, API-COM-04, API-COM-05, API-COM-06, docs/06 §1.5 (idempotent `createOrder`), docs/03 §3.1, S-22 (service), FI-12
- Description: Order numbering `CK-ORD-nnnnnn` from `order_no_seq`. `previewCheckout(offeringId, couponCode?)`: offering active + product published/not coming soon + not `custom_quote`; BR-10 duplicate check against `user_offering_purchases`; lines with `unit`, `discount` (P4.3), `tax = round_half_up((unit − discount) × effectiveTaxRateBps / 10000)`, totals in base currency, `displayTotal` via fx; `enabledMethods` = offering methods ∩ settings ∩ flags; `warnings`. `createOrder(input)`: requires verified email (`EMAIL_UNVERIFIED`), rate class `checkout`, idempotent per `(userId, offeringId)` while `pending_payment`; transaction: `orders(pending_payment, expires_at = now + 7 d, tax_rate_bps, billing_snapshot, fx_rate_to_inr)`, `order_items(ownership_id = active)`, coupon lock (P4.3), `payments(initiated)` via P4.4 `createIntent` (until P4.4 lands, instructions stub), upsert `customer_profiles` billing, `N: order.created`, `E: order-created`, `A: checkout_start`. `cancelMyOrder`, `retryPayment` (new `initiated` payment; `ORDER_EXPIRED` past `expires_at`), `listMyOrders`/`getMyOrder` (scoped, `NOT_FOUND` for foreign ids — SA-10), `listOrdersAdmin`/`getOrderAdmin` (filters per API-COM-06; `admin` scope = orders containing own products). `expirePendingOrders(now, tx)` service: `pending_payment` with `expires_at < now` → `failed` with reason `expired` (never `cancelled` — docs/03 §3.1, MASTER_SPEC §7 "Order failed"/"Order cancelled"), payments `initiated/submitted` → `failed('expired')`, `N: order.expired` + `E: order-expired`; renewal orders expire at `grace_until` by construction. Job `src/jobs/order-expiry.ts` exporting `{ key: 'orders.expire', run(now) }` (thin wrapper, `frequent` endpoint per docs/06 §3.3 / docs/12 §2.3; P4-owned per master plan §3). Order status machine per docs/03 §3.1 in `state.ts`; `markFulfilledIfComplete(orderId, tx)` exported for P5 (MASTER_SPEC §7 "Order fulfilled").
- Owned paths: `src/modules/orders/**` (except frozen), `src/jobs/order-expiry.ts`. Forbidden: `payments/**`, `coupons/**`, other `src/jobs/**` files.
- Dependencies: P2; P3.3 tax helper (stub until merged).
- Expected files/modules: `src/modules/orders/{service,actions,queries,totals,state,numbering,expiry}.ts`, `src/jobs/order-expiry.ts`.
- Tests required: unit `tests/unit/orders/{totals,state,numbering,billing-snapshot}.test.ts` (FI-12 examples; tax 0 without GSTIN; half-up rounding); integration `tests/integration/orders/{create-order,duplicate-purchase,idempotent-pending,unverified-blocked,cancel,retry,expiry-service,admin-scope,foreign-id-404}.test.ts` (`@security` SA-10, SA-01 partial), `tests/integration/jobs/order-expiry.test.ts` (S-22 at service level: order `failed('expired')`, payment `failed`, reference submission refused with `ORDER_EXPIRED`; run twice with the same `now` → same state, one email).
- Acceptance criteria:
  - [ ] exactly one item, quantity 1, base currency, `expires_at` +7 d on Buy now
  - [ ] second `createOrder` for the same pending offering returns the existing order
  - [ ] one-time offering already paid → `DUPLICATE_PURCHASE`
  - [ ] `orders.expire` turns the order `failed` (not `cancelled`), is idempotent for a fixed `now` and emails once (S-22)
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: `expires_at` semantics vs renewal orders (MASTER_SPEC "Renewal order expiry") → `createOrder` accepts an `expiresAt` override used only by P5.6 through the contract.

### P4.3 Coupons
- Owner profile: domain-standard (agent A)
- Requirement IDs: FR-COM-07, FR-COM-08, A-401, D-409, API-COM-08, TM-06, S-08, docs/10 Open #6
- Description: `upsertCoupon`/`deactivateCoupon`/`listCoupons` (codes ≥ 8 chars enforced for admin-created codes; `CONFLICT` on code). `validateCoupon(code, userId, offering, subtotal)` at apply time: active, `starts_at..ends_at`, `max_redemptions` vs `redemptions_count`, `product_ids`, `first_purchase_only` (only paid orders count), rate class `coupon` (10/10 min). Math: percent `subtotal × value / 10000`; fixed `min(value, subtotal)` in order currency. `lockOnOrder(orderId, couponId, tx)` writes `coupon_redemptions(UNIQUE(coupon_id, order_id))` and stores `discount_minor` on the order; `countAtPaid(orderId, tx)` runs `SELECT … FOR UPDATE` on the coupon row and increments `redemptions_count` or throws `LIMIT_EXCEEDED` ("coupon exhausted") so the confirming admin is prompted to confirm without the coupon (S-08 step 3).
- Owned paths: `src/modules/coupons/**`. Forbidden: `orders/**` (hooks are called by P4.2/P4.4 through the contract).
- Dependencies: P4.2.
- Expected files/modules: `src/modules/coupons/{service,actions,queries,validate,math}.ts`.
- Tests required: unit `tests/unit/coupons/{validity,math,restrictions}.test.ts`; integration `tests/integration/coupons/{first-purchase-only,exhaustion-race-at-paid,expired,product-restricted}.test.ts` (two concurrent confirms on `FLAT500`: exactly one redemption).
- Acceptance criteria:
  - [ ] `WELCOME10` rejected on a second purchase by the same verified buyer
  - [ ] concurrent last-redemption race yields exactly one redemption
  - [ ] discount locked on the order survives coupon expiry
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: counting at Paid (not checkout) leaves an over-subscribed pending state → the confirm path handles `LIMIT_EXCEEDED` gracefully (P4.4).

### P4.4 `ManualProvider` + payments service
- Owner profile: domain-critical (agent A)
- Requirement IDs: FR-PAY-01, FR-PAY-02, FR-PAY-03, FR-PAY-04, FR-PAY-05, FR-PAY-06, FR-PAY-07, FR-PAY-08, FR-PAY-09, FR-PAY-14, FR-COM-12, FR-DEL-01 (via contract), A-402, D-402, D-501, D-516, D-411, D-416, API-PAY-01, API-PAY-02, API-PAY-03, API-PAY-04, API-PAY-07, API-PAY-08, docs/06 §1.5 (confirm idempotency), §4.1, §4.2, §5.1, docs/09 §6.1, TM-01, SA-24, S-02 steps 2–5 (server), MASTER_SPEC §4.4, §7 "Overpayment", "Payment immutability"
- Description: `providers/manual.ts` implementing `PaymentProvider` (`keys: ['manual_upi','manual_bank']`): `createIntent` UPI — reads `site_settings.upi_vpa`, builds `upi://pay?pa=<vpa>&pn=CodeKraft&am=<rupees 2dp>&cu=INR&tn=<orderNo>`, QR data URL via `qrcode`, `STATE_INVALID` when base currency ≠ INR; bank — `BankInstructions` from `site_settings.bank_details` with `reference = orderNo`; `confirm` pure: `bankShortfall = max(0, due − received)`, `customerCredit = max(0, received − due)`, `gatewayFee = 0`, keeps customer's and admin's references. `providers/registry.ts` maps keys → provider, gateway keys registered only when flags on (V1.1). `payments/service.ts`: `getPaymentInstructions`, `submitPaymentReference` (6..64 chars; `initiated → submitted`; resubmission re-notifies once per 10 min; `N: payment.submitted` to admins; `A: payment_submitted`; customer security audit; `ORDER_EXPIRED`), `confirmPayment(paymentId, input)` in one transaction with `SELECT … FOR UPDATE` on the payment: idempotency per docs/06 §1.5 (`IDEMPOTENT_REPLAY` on same values, `STATE_INVALID` on different), `ORDER_EXPIRED` unless `overrideExpiry` (audited); for a `project` order `STATE_INVALID` unless its `split_approval_request_id` points to an `applied` request; overpayment is not an error — `customer_credit_minor = max(0, received − due)` is recorded, shown to admins and never allocated (ledger posts on `amount_due`; FR-PAY-07, API-PAY-03, MASTER_SPEC §7 "Overpayment"; surfaced through the `customer_credits` view / API-FIN-09); then `payments.confirmed` (immutable), `orders.paid`, `user_offering_purchases`, `coupons.countAtPaid` (on `LIMIT_EXCEEDED` abort with a message telling the admin to confirm without coupon → admin re-runs with `dropCoupon: true`, which re-prices the order before confirmation, audited), `finance.postOrderPaid`, `invoices.issue` (P4.5), `entitlements.grantForOrder` (contract), `N: order.paid`, `E: payment-confirmed`, `N: delivery.task`, `A: payment_confirmed`; duplicate UTR across payments → `warnings[]` in the admin read model (TM-01). `failPayment` (reason; order stays `pending_payment` unless `alsoCancelOrder`; `E: payment-failed`). `listPaymentsAwaiting` (widget loader shape). `flagChargeback` (tag `chargeback`, revoke via contract; no ledger reversal until adjustment). The order/finance/invoice/entitlement calls receive only `{ amountReceivedMinor, gatewayFeeMinor, bankShortfallMinor }` — never the provider key (static test greps `orders|finance|invoices|entitlements` for `manual_upi|razorpay`).
- Owned paths: `src/modules/payments/**` (except frozen). Forbidden: `orders/**`, `finance/**`, `invoices/**`, `entitlements/**`.
- Dependencies: P4.1, P4.2; P4.5 (invoice issue inside confirm — until P4.5 merges, the invoice call is the P2 stub).
- Expected files/modules: `src/modules/payments/{service,actions,queries,confirm,refunds-hooks}.ts`, `src/modules/payments/providers/{manual,registry}.ts`, `tests/static/no-provider-keys-outside-payments.test.ts`.
- Tests required: unit `tests/unit/payments/{manual-provider,upi-uri,qr,confirm-validation,shortfall,overpayment,duplicate-utr}.test.ts`; integration `tests/integration/payments/{submit-reference,confirm-happy,confirm-shortfall,confirm-overpayment-credit,confirm-idempotent,confirm-concurrent-lock,fail-keeps-pending,confirm-without-reference,project-split-not-applied-refused,coupon-exhausted-prompt,chargeback}.test.ts` (`@security` SA-24, SA-09 via trigger on a second edit).
- Acceptance criteria:
  - [ ] UPI URI and QR encode `am` and `tn=<orderNo>` (S-02 step 2)
  - [ ] confirm with received = total − 2500 records `bank_shortfall_minor = 2500` and a `bank_charge` entry before split (SA-24); received = total + 1000 records `customer_credit_minor = 1000` with no partner allocation of it
  - [ ] two admins confirming simultaneously: second gets `IDEMPOTENT_REPLAY`/`STATE_INVALID`, never a double posting
  - [ ] no provider key string appears outside `modules/payments` (static test)
  - [ ] editing a confirmed payment is rejected (trigger surfaced as "immutable")
- Definition of Done: code + tests (≥ 95/90/95) + PROGRESS row + CI green; master plan §6 "manual confirm with shortfall".
- Potential risks and mitigations: long confirm transaction (PDF render inside) → PDF rendering happens after commit via `invoices.renderPdf` queued in the same request (row exists at commit, `pdf_media_id` filled after; retry by `invoices.regenerate_pending` in the `frequent` job — docs/12 §11.3); `qrcode` in serverless → pure JS, no canvas.

### P4.5 Invoices: gapless FY numbering, PDF, GST switch, credit notes, presigned access
- Owner profile: domain-critical (agent A)
- Requirement IDs: FR-PAY-10, FR-PAY-11, FR-DASH-03, NFR-LEGAL-01, NFR-PERF-05, BR-16, D-401, D-414, D-1501, API-COM-11, API-COM-12, API-COM-13, FI-08, FI-09, docs/10 §7 (`invoices` row), docs/12 §6 (`codekraft-documents` keys), MASTER_SPEC §7 "Print/PDF/email theming", "Tax before GST registration"
- Description: `issueInvoice(orderId, tx)`: `SELECT … FOR UPDATE` on `invoice_sequences(fy)` (row created on first use for the FY computed in Asia/Kolkata from `paid_at`), `invoice_no = CK/<fy>/<seq 4 digits>`, seller snapshot from settings (name "CodeKraft"), buyer snapshot from `billing_snapshot`, lines, totals, `gst_breakdown` (CGST/SGST when buyer state = seller state, IGST otherwise) only when `site_settings.gstin` set, else no tax lines. `src/pdf/Invoice.tsx`, `CreditNote.tsx`, `Statement.tsx` (react-pdf, ink-on-white, brand mark, contact details from seller snapshot — D-406). `renderPdf(invoiceId)` → `codekraft-documents/invoices/<fy>/<no with / → ->.pdf`, `media(private)`, `E: invoice` with attachment, `N: invoice.issued`; `regeneratePending()` for rows with `pdf_media_id IS NULL`. `issueCreditNote(refundId, tx)` numbered `CK/CN/<fy>/<seq>` from `credit_note_sequences` (docs/05 §5, row-locked exactly like `invoice_sequences`). `regeneratePending(now)` is exported for the `invoices.regenerate_pending` job (`frequent`; registered by P9.4, docs/06 §3.3). `issueInvoice` refuses (`STATE_INVALID`) a `project` order whose `split_approval_request_id` is not an `applied` request (MASTER_SPEC §7 "Project order splits"). `getInvoicePdfUrl` (own or `invoices.read`; 5-min presigned; admin audited), `listInvoicesAdmin`/`listMyInvoices`. Manual re-issue for project orders created without payment (`invoices.issue` permission).
- Owned paths: `src/modules/invoices/**`, `src/pdf/**`. Forbidden: `payments/**`, `finance/**`, `drizzle/**`.
- Dependencies: P4.2; P3.5 storage client (stub → MinIO).
- Expected files/modules: `src/modules/invoices/{service,actions,queries,numbering,gst,pdf}.ts`, `src/pdf/{Invoice,CreditNote,Statement,theme}.tsx`.
- Tests required: unit `tests/unit/invoices/{numbering-fy,gst-breakdown,no-gst-without-gstin}.test.ts`, `tests/unit/pdf/*.snapshot.test.tsx` (text contains number; GST block conditional); integration `tests/integration/invoices/{gapless-concurrent-50,rolled-back-consumes-no-number,fy-boundary,pdf-to-storage,presigned-scoped,regenerate-pending}.test.ts` (FI-08 with 50 concurrent confirmations on separate connections; FI-09 at 31 Mar 23:59 / 1 Apr 00:00 IST).
- Acceptance criteria:
  - [ ] 50 concurrent confirmations → `0001…0050`, no gaps/duplicates; a rolled-back confirm consumes no number
  - [ ] FY boundary in IST places the two orders in different sequences
  - [ ] invoice without GSTIN has no tax lines even for `tax_enabled` products
  - [ ] PDF stored privately; foreign customer gets `NOT_FOUND` (SA-10)
- Definition of Done: code + tests + PROGRESS row + CI green; master plan §6 "invoice numbering gapless under concurrency".
- Potential risks and mitigations: react-pdf fonts on serverless → bundle fonts under `src/pdf/fonts`, registered once; PDF > 5 s → measured in integration test, template kept simple.

### P4.6 Custom quotes + `quote-expiry` job
- Owner profile: domain-standard (agent A)
- Requirement IDs: FR-COM-09, NFR-SEC-05, D-520, API-COM-09, API-COM-10, TM-11, S-09 (server), docs/03 §3.9, docs/06 §1.7 (`quote_lookup`), §3.3 `quotes.expire`, docs/12 §2.3, MASTER_SPEC §7 "Custom quote pay link", "Auth and checkout URLs"
- Description: `createCustomQuote` (customer, optional offering, base currency, amount, `expires_at`; token ≥ 128 bits), `sendCustomQuote` (`draft → sent`, `N: quote.sent`, `E: custom-quote` with `/quote/<token>` from `lib/routes.ts`), `cancelCustomQuote`. `getQuote(token)` (API-COM-10): rate class `quote_lookup` (10/h per IP), requires login, returns `{ quote, canAccept }` — `canAccept=false` (read-only, "sign in as the invited customer") when `session.user.id ≠ custom_quotes.customer_id`; `NOT_FOUND` only for unknown tokens; `acceptCustomQuote` by a different account → `FORBIDDEN` (MASTER_SPEC §7 "Custom quote pay link", ui/sitemap.md §5). `acceptCustomQuote(token, paymentMethod, billing)` → `accepted` + order with `custom_quote_id`, single item at quoted amount, no coupons, then P4.4 intent; quote `paid` on confirm (hook from payments via contract event). Job `src/jobs/quote-expiry.ts` exporting `{ key: 'quotes.expire', run(now) }` (`frequent`): `sent` past `expires_at` → `expired` unless an order exists.
- Owned paths: `src/modules/quotes/**`, `src/jobs/quote-expiry.ts`. Forbidden: `orders/**` (calls service).
- Dependencies: P4.2, P4.4.
- Expected files/modules: `src/modules/quotes/{service,actions,queries,token}.ts`, `src/jobs/quote-expiry.ts`.
- Tests required: unit `tests/unit/quotes/{token,expiry}.test.ts`; integration `tests/integration/quotes/{create-send-accept,foreign-customer-read-only,foreign-accept-forbidden,expired-link,order-keeps-price-after-expiry,job-idempotent}.test.ts`.
- Acceptance criteria:
  - [ ] quote as another customer → read-only (`canAccept=false`), accept → `FORBIDDEN`; logged out → login prompt flag; unknown token → `NOT_FOUND`
  - [ ] accepted quote creates one order with `custom_quote_id`; ledger uses the negotiated amount (asserted with P4.1)
  - [ ] expired quote with an existing order stays `accepted`
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: the page URL is `/quote/[token]` (MASTER_SPEC §7, ui/sitemap.md §3, docs/07 §8.3) — the module never hardcodes it and reads `lib/routes.ts`; P7.9 owns the page. docs/10 S-09 step 3 still says "404" for another customer; MASTER_SPEC/docs/06 (read-only) win and the scenario assertion follows them.

### P4.7 Manual & project orders with `split_snapshot` + `project_order.split` approval
- Owner profile: domain-critical (agent A)
- Requirement IDs: FR-COM-10, FR-COM-11, FR-COM-12, BR-05, A-502, D-510, D-1107, API-COM-07, S-12 (server), MASTER_SPEC §7 "Project order splits"
- Description: `createManualOrder(input)`: type `product` (customer `userId`, offering lines) or `project` (client name/email/company, free-form lines with `unitMinor × quantity`, optional `productId` to attach the product's active ownership, else a `split_snapshot {companyCutBps, lines}` entered on the line); tax per settings; `orders(created_by = admin)`. For project lines with a manual snapshot, create `approval_requests(type='project_order.split', payload {orderId, itemIds})`; register `applyProjectOrderSplit` (API-COM-14: stores `orders.split_approval_request_id`, which P4.4 confirm and P4.5 issue check) and `onRejected` (order → `cancelled`). Invoice/payment blocked until approved (`STATE_INVALID` from P4.4 confirm and P4.5 issue). Optional `payment {method, amountReceivedMinor, reference, paidOn}` creates and confirms in one transaction through `payments.confirmPayment` (same code path; ledger, allocations, invoice, entitlements for offering lines). `DUPLICATE_PURCHASE` for product lines.
- Owned paths: `src/modules/orders/manual.ts`, `src/modules/orders/project-split.ts`. Forbidden: `payments/**`, `finance/**`.
- Dependencies: P4.4, P4.5, P4.1; P3.2 approvals.
- Expected files/modules: as listed.
- Tests required: integration `tests/integration/orders/manual/{product-order-with-payment,project-order-split-approval,project-order-blocked-until-approved,project-order-product-linked-uses-active-ownership,reject-cancels}.test.ts` (S-12: two free-form lines, 50/50, paid in full → allocations to both partners, invoice in the same sequence).
- Acceptance criteria:
  - [ ] project order with manual split cannot be invoiced or paid before the other admin approves
  - [ ] product-linked project line allocates by the product's active ownership
  - [ ] manual order with payment lands `paid` with ledger + invoice in one transaction
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: requester confirms their own project order payment after approval → allowed (payment confirmation is not BR-13); documented.

### P4.8 Refunds: propose/apply, `postRefund`, credit note, revocation call
- Owner profile: domain-critical (agent B)
- Requirement IDs: FR-PAY-12, FR-PAY-13, FR-FIN-05, FR-DEL-11 (via contract), BR-09, BR-13, D-415, D-505, D-607, API-PAY-05, API-PAY-06, FI-05, FI-07, S-07 (server, steps 2–5), docs/06 §5.2, MASTER_SPEC §7 "Refund reversal scope", "Payment immutability"
- Description: `proposeRefund(orderId, paymentId, amountMinor, reason, revokeEntitlements, queryId?)`: `is_refundable` (or `policyException` audited), provider `manual_*`, order in `paid|fulfilled|partially_refunded`, amount ≤ confirmed − already refunded; `refunds` row; `refund.issue` request. Register `applyRefund` and `onRejected` (delete refunds row) with P3.2. `finance.postRefund(refundId, tx)`: fraction `f = amount / gross` per item; `refund_sale`, `refund_discount`, `refund_tax`, `refund_company_cut`, `refund_partner_allocation` = −round(f × original) with largest-remainder balancing so FI-04 holds; gateway fees and bank charges never reversed; full refund nets to zero (FI-05). Apply: `refunds.executed_by/at`, credit note (P4.5), `orders.refunded | partially_refunded`, `payments.status = 'refunded'` + `amount_refunded_minor` when fully refunded (the single permitted transition), `entitlements.revoke` via contract when `revokeEntitlements`, `E: refund-issued`, `N: refund.issued`, `A: refund`; `ManualProvider.refund` records the manual transfer reference supplied on approval.
- Owned paths: `src/modules/finance/refunds.ts`, `src/modules/payments/refunds.ts` (propose action + apply registration; agent B edits this one file in `payments/` by agreement with agent A after P4.4 merges). Forbidden: other `payments/**` files.
- Dependencies: P4.1, P4.4, P4.5.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/finance/refund-reversal.test.ts` (proportional rounding balanced); property FI-05 in `tests/property/finance.spec.ts`; integration `tests/integration/refunds/{propose-requires-refundable,requester-cannot-approve,apply-full,apply-partial,payment-transition-once,credit-note-numbered,revoke-called}.test.ts` (`@security` SA-08, SA-09).
- Acceptance criteria:
  - [ ] full refund: ledger nets to zero for the order; payment `confirmed → refunded` once; second transition raises
  - [ ] partial refund: order `partially_refunded`, entries proportional, entitlement untouched
  - [ ] non-refundable product refused without `policyException`
- Definition of Done: code + tests + PROGRESS row + CI green; master plan §6 "refund reversal".
- Potential risks and mitigations: two agents in `payments/` → single file `payments/refunds.ts` owned by B, created after A's P4.4 merge; contract-freeze protects `PaymentProvider`.

### P4.9 Payouts with approval and balance check; partner balances
- Owner profile: domain-critical (agent B)
- Requirement IDs: FR-FIN-06, FR-FIN-07, FR-FIN-12, BR-13, D-511, D-1105, API-FIN-03, API-FIN-04, API-FIN-05, API-FIN-11 (payouts), FI-06, FI-14, S-13 (server), MASTER_SPEC §7 "Payout > balance"
- Description: `getPartnerBalances(partnerId?)` from `VIEW partner_balances` (`byCurrency[]`, `balanceInrMinor`; `admin` role restricted to own partner). `recordPayout(partnerId, amountMinor, currency, paidOn, reference, note)`: `VALIDATION` when amount > balance in that currency unless `allowOverdraw` (audited); `payout.record` request. Register `applyPayout` (`payouts` row immutable + `ledger_entries(payout, party partner, negative, fx at paidOn)`, `N: payout.recorded` to the partner) and `onRejected` (nothing). `listPayouts`.
- Owned paths: `src/modules/finance/{payouts,balances}.ts`. Forbidden: everything outside `finance/`.
- Dependencies: P4.1; P3.2.
- Expected files/modules: as listed.
- Tests required: property FI-06, FI-14; integration `tests/integration/finance/{balances-view-vs-recompute,payout-approval-apply,payout-over-balance-refused,payout-scope-admin-role}.test.ts`.
- Acceptance criteria:
  - [ ] payout > balance refused at request (FI-14)
  - [ ] after apply, balance reduced exactly (FI-06)
  - [ ] `admin` role cannot read another partner's balance
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: balance check at request vs apply time → re-checked at apply; overdraw only with audited flag.

### P4.10 Expenses and ledger adjustments
- Owner profile: domain-critical (agent B)
- Requirement IDs: FR-FIN-08, FR-FIN-09, FR-FIN-14, BR-17, D-514, D-517, API-FIN-06, API-FIN-07, API-FIN-08, API-FIN-11 (expenses), FI-13
- Description: `recordExpense` (optional product, receipt media, `sharedBySplit`): `expenses` row + `expense` entries — shared: one negative line per partner by the ownership active on `incurredOn` plus the company line for its cut; else one company line; `VALIDATION` when shared without active ownership (edge: company-only with warning when no ownership, docs/03 §5). `proposeAdjustment(lines[], reason)` (signed lines with party/partner/memo; Σ explained) → `ledger.adjustment` request; register `applyAdjustment` (`adjustment` entries with `approval_request_id`). `listExpenses`. Product profit helper for reports (`Σ sale − discount − refunds − expenses`).
- Owned paths: `src/modules/finance/{expenses,adjustments}.ts`. Forbidden: outside `finance/`.
- Dependencies: P4.1; P3.2.
- Expected files/modules: as listed.
- Tests required: property FI-13; integration `tests/integration/finance/{expense-shared,expense-company-only,expense-no-ownership-warning,adjustment-approval-apply,adjustment-requester-blocked}.test.ts`.
- Acceptance criteria:
  - [ ] shared expense reduces partner balances by their bps; company-only reduces company only (FI-13)
  - [ ] adjustment entries reference the approval request and are append-only
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: expense on a product whose ownership changes later → uses the version active on `incurredOn`, tested.

### P4.11 Reports and partner statements (PDF/CSV)
- Owner profile: domain-standard (agent B)
- Requirement IDs: FR-FIN-10, FR-FIN-11, FR-FIN-12, FR-FIN-14, D-513, API-FIN-09, API-FIN-10, docs/10 §13 (statements snapshots), master plan §6 "reports match ledger"
- Description: `getReport(report, dateFrom, dateTo, granularity, currency)` for `revenue_by_product`, `revenue_by_partner`, `revenue_by_period`, `tax_collected`, `refunds`, `outstanding_payouts`, `profit_by_product` — computed only from `ledger_entries`/`allocations` (`amount_inr_minor` for INR), `{ columns, rows, totals }`. `exportStatement(partnerId, dateFrom, dateTo, format)`: every entry affecting the partner, opening/closing balances, PDF (`src/pdf/Statement.tsx` from P4.5) or CSV → `codekraft-documents`, 5-min URL, audited; `admin` role own statement only.
- Owned paths: `src/modules/finance/{reports,statements}.ts`. Forbidden: `src/pdf/**` (use P4.5's template; request changes from A).
- Dependencies: P4.8, P4.9, P4.10.
- Expected files/modules: as listed.
- Tests required: integration `tests/integration/finance/{reports-match-ledger,statement-pdf-csv-snapshot,statement-scope}.test.ts` (every report total recomputed from raw entries in the test).
- Acceptance criteria:
  - [ ] each report's totals equal an independent recomputation over `ledger_entries`
  - [ ] statement opening + Σ entries = closing
  - [ ] `admin` role cannot export another partner's statement
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: report SQL drifting from ledger semantics → recomputation tests are the guard; CSV injection (`=`, `+`) → cells prefixed per OWASP.

### P4.12 Property suite FI-01..14 + `finance.reconcile` service
- Owner profile: domain-critical (agent B)
- Requirement IDs: NFR-DATA-04, FI-01..FI-14, docs/10 §5 (arbitraries, 500/5 000 runs), FR-OPS-01 (reconciliation job)
- Description: Complete `tests/property/finance.spec.ts` with the arbitraries of docs/10 §5 (1–5 items, prices 1–10 000 000, discounts 0–100 %, tax 0/18 %, shortfalls 0–5 %, 1–4 partners summing 10 000, cut 0–5 000, five currencies) covering FI-01, FI-02, FI-04, FI-05, FI-06, FI-11, FI-12, FI-13, FI-14; DB-backed FI-03, FI-07, FI-08, FI-09, FI-10 live in integration (P2.11, P4.5, P4.1) and are referenced. `NIGHTLY=1` raises runs to 5 000. `finance.reconcile(now)` in `src/modules/finance/reconcile.ts`: for every paid order re-derives FI-01/FI-02/FI-04 from stored rows and `N: system.job_failed` on mismatch (NFR-DATA-04 "nightly reconciliation job"). docs/06 §3.3 / docs/12 §2.3 do not yet list this job; P9.4 registers it in `daily` as `finance.reconcile` and P9.12 files the doc correction (see `ISSUES.md` "Resolved during documentation" note).
- Owned paths: `tests/property/**`, `src/modules/finance/reconcile.ts`. Forbidden: other `src/modules/**`, `src/jobs/**`.
- Dependencies: P4.1, P4.4, P4.5, P4.8, P4.9, P4.10.
- Expected files/modules: as listed.
- Tests required: the property file itself; `tests/integration/finance/reconcile.test.ts` (clean ledger passes; a hand-inserted inconsistent fixture, inserted as superuser bypassing triggers in a scratch schema, is reported).
- Acceptance criteria:
  - [ ] FI-01..14 all green at 500 runs in CI
  - [ ] reconciliation job reports a seeded inconsistency
- Definition of Done: suite + reconcile service + PROGRESS row + CI green; `unit` job runs `property` project.
- Potential risks and mitigations: property runs slow → shrink arbitraries sizes in CI, full in nightly.

### P4.13 Phase gate: integration scenarios + reviewer
- Owner profile: reviewer
- Requirement IDs: master plan §6 (P4 gate), docs/10 §13 (P2 + P4 rows), S-02 (steps 1–5), S-07, S-08, S-09, S-10 (allocation steps 2/4), S-12, S-13, S-22, SA-08, SA-09, SA-10, SA-24
- Description: Author `tests/integration/scenarios/p4-*.test.ts` running the listed scenarios end to end at service level (no UI) using seeded data and `tests/stubs/entitlements` (assert grant calls). Audit acceptance boxes, coverage (finance/payments/invoices ≥ 95/90/95), contract freeze unchanged, ownership map compliance (`src/jobs/{order-expiry,quote-expiry}.ts` are P4's per master plan §3), doc corrections logged (none expected: `credit_note_sequences`, `customer_credit_minor`, `orders.split_approval_request_id` and `/quote/[token]` are already in the docs; the only known gap is the `finance.reconcile` job key missing from docs/06 §3.3). Write `implementation/reviews/P4-review.md`.
- Owned paths: `tests/integration/scenarios/p4-*.test.ts`, `implementation/reviews/P4-review.md`. Forbidden: `src/**`.
- Dependencies: P4.1–P4.12.
- Expected files/modules: as listed.
- Tests required: scenario files above tagged `@security` where applicable.
- Acceptance criteria:
  - [ ] all listed scenarios green at service level
  - [ ] coverage thresholds met; contract freeze unchanged
  - [ ] review file with evidence per criterion
- Definition of Done: scenarios + review + PROGRESS statuses + CI green.
- Potential risks and mitigations: scenarios duplicating unit coverage → scenarios assert only cross-module outcomes (ledger sums, statuses, notifications).

## Parallelisation map

```
Agent A: P4.2 ──┬── P4.3 ──┐
                ├── P4.5 ──┼── P4.4 ── P4.6
                │          └────────── P4.7
Agent B: P4.1 ──┬── P4.9 ──┐
                ├── P4.10 ─┼── P4.11 ── P4.12 ──┐
                └── (after A's P4.4 + P4.5) P4.8 ┘   → P4.13
```

- Agents A and B start simultaneously: P4.2 and P4.1 have no dependency on each other (P4.2 posts nothing; P4.1 reads orders through queries on fixtures).
- P4.3 and P4.5 run concurrently after P4.2 (different directories). P4.4 needs both P4.1 and P4.2 (and P4.5's `issue` for the full path — it can merge against the P2 stub and re-test once P4.5 lands).
- P4.6 and P4.7 after P4.4/P4.5; they touch `quotes/` and `orders/manual.ts` respectively — disjoint.
- Agent B: P4.9 and P4.10 concurrently after P4.1 (separate files in `finance/`); P4.8 waits for A's P4.4 and P4.5 because it writes `payments/refunds.ts` and issues credit notes; P4.11 after P4.8–P4.10; P4.12 last before the gate.
- Master plan §1.3: one agent owns the ledger — every `finance/` file is agent B's; agent A never writes there.
- No migrations in P4 (the schema, including `credit_note_sequences`, is complete after P2).

## Phase Definition of Done

- All 13 tasks `done`; `implementation/reviews/P4-review.md` committed.
- CI green: unit, property (FI-01..14 at 500 runs), integration (S-02 1–5, S-07, S-08, S-09, S-10 allocation steps, S-12, S-13, S-22 at service level; SA-08, SA-09, SA-10, SA-24).
- Coverage: `modules/finance`, `modules/payments`, `modules/invoices` ≥ 95/90/95.
- Static test: no provider key outside `modules/payments`; contract freeze unchanged.
- Founders can (via a script in `scripts/dev/manual-order.ts`) create a manual order, confirm the payment and print the invoice number — the "earliest usable increment" of master plan §1.4 at the service level.
- `src/jobs/{order-expiry,quote-expiry}.ts` export `{ key: 'orders.expire' | 'quotes.expire', run(now) }` and pass the run-twice test; no doc corrections expected beyond the `finance.reconcile` job-key note.

## Phase risks

| Risk | Mitigation |
|------|------------|
| Posting formula bug ships into immutable rows | property tests + reconciliation job + no production data before P9 |
| Long confirm transaction with PDF rendering | PDF after commit, retried by `regenerate_pending` |
| Two agents editing `payments/` | `refunds.ts` single-owner rule; contract freeze on provider types |
| Invoice sequence lock contention on PgBouncer transaction mode | row lock inside one transaction only (docs/12 §5.1), tested with 50 connections |
| Coupon race semantics unclear (docs/10 Open #6) | counted at Paid with `FOR UPDATE`; documented in `CHANGELOG` doc corrections |

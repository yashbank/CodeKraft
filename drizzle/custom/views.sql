-- CodeKraft reporting views (docs/05 §7). Canonical copy; applied by migration 0001.
--
-- partner_balances (FR-FIN-06, API-FIN-03): Σ partner_allocation − Σ refund_partner_allocation
-- − Σ payout − Σ expense share, per partner and currency, plus INR via amount_inr_minor. Relies on
-- the ledger sign convention (drizzle/schema/finance.ts): partner_allocation entries are positive;
-- refund_partner_allocation, payout and expense entries against a partner are negative, so
-- balance_minor = Σ amount_minor over the partner's rows; component columns are positive
-- magnitudes. `adjustment` entries with party_type = 'partner' are included (API-FIN-08).
-- One row per (partner, currency); the service groups rows into byCurrency[] and sums
-- balance_inr_minor.
CREATE OR REPLACE VIEW partner_balances AS
SELECT
  le.partner_id,
  le.currency,
  COALESCE(SUM(le.amount_minor)  FILTER (WHERE le.entry_type = 'partner_allocation'),        0)::bigint AS allocated_minor,
  COALESCE(SUM(-le.amount_minor) FILTER (WHERE le.entry_type = 'refund_partner_allocation'), 0)::bigint AS refunded_minor,
  COALESCE(SUM(-le.amount_minor) FILTER (WHERE le.entry_type = 'expense'),                   0)::bigint AS expenses_minor,
  COALESCE(SUM(-le.amount_minor) FILTER (WHERE le.entry_type = 'payout'),                    0)::bigint AS paid_out_minor,
  COALESCE(SUM(le.amount_minor)  FILTER (WHERE le.entry_type = 'adjustment'),                0)::bigint AS adjusted_minor,
  COALESCE(SUM(le.amount_minor), 0)::bigint     AS balance_minor,
  COALESCE(SUM(le.amount_inr_minor), 0)::bigint AS balance_inr_minor,
  MAX(le.created_at)                            AS last_entry_at
FROM ledger_entries le
WHERE le.party_type = 'partner'
  AND le.partner_id IS NOT NULL
  AND le.entry_type IN ('partner_allocation', 'refund_partner_allocation', 'payout', 'expense', 'adjustment')
GROUP BY le.partner_id, le.currency;
--> statement-breakpoint
-- customer_credits (FR-PAY-07, API-FIN-09): confirmed payments carrying an overpayment
-- (customer_credit_minor > 0) that has not been settled. Release 1 has no "applied" state
-- (credits are returned by hand); a credit counts as settled once the payment is `refunded`.
CREATE OR REPLACE VIEW customer_credits AS
SELECT
  p.id                                 AS payment_id,
  p.order_id,
  o.order_no,
  o.user_id,
  o.client_email,
  p.currency,
  p.amount_due_minor,
  p.amount_received_minor,
  p.customer_credit_minor              AS credit_minor,
  COALESCE(p.amount_refunded_minor, 0) AS amount_refunded_minor,
  round(p.customer_credit_minor * o.fx_rate_to_inr)::bigint AS credit_inr_minor,
  p.confirmed_at,
  p.confirmed_by
FROM payments p
JOIN orders o ON o.id = p.order_id
WHERE p.status = 'confirmed'
  AND p.customer_credit_minor IS NOT NULL
  AND p.customer_credit_minor > 0;

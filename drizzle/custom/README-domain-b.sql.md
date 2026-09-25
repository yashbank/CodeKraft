> **Superseded (P2.4).** The reviewed, canonical SQL lives in `drizzle/custom/triggers.sql` and
> `drizzle/custom/views.sql` and is applied by `drizzle/migrations/0001_daffy_turbo.sql`. Corrections
> made during integration: `refunded` payments are fully frozen (the draft still let
> `amount_refunded_minor` grow after the terminal transition); the `ownership_lines_sum` deferred
> constraint trigger and the `category_depth` trigger were added; `-SUM(x) FILTER` became
> `SUM(-x) FILTER`; `credit_inr_minor` rounds explicitly. This file is kept as the domain B handover
> record only.

# Domain B custom SQL (P2.2 → P2.4)

Trigger functions, triggers and views for the commerce / finance / approvals / audit tables
(docs/05 §7, §12). The integrator pastes these into `drizzle/custom/0001_triggers.sql` and
`drizzle/custom/0002_views.sql`. Everything is idempotent (`CREATE OR REPLACE` + `DROP TRIGGER
IF EXISTS`) so the runner can re-apply safely.

Error identifiers raised (tests in P2.11 match on `MESSAGE`):
`append_only`, `payment_frozen`, `ownership_frozen`, `approver_is_requester`.

## 1. Append-only: ledger_entries, allocations, payouts, invoices, credit_notes, audit_logs

```sql
CREATE OR REPLACE FUNCTION ck_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append_only'
    USING ERRCODE = 'integrity_constraint_violation',
          DETAIL  = format('%s is append-only; %s is not allowed (BR-17)', TG_TABLE_NAME, TG_OP),
          HINT    = 'Post a correcting row instead of changing history.';
END;
$$;

DROP TRIGGER IF EXISTS trg_append_only ON ledger_entries;
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ck_append_only();

DROP TRIGGER IF EXISTS trg_append_only ON allocations;
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON allocations
  FOR EACH ROW EXECUTE FUNCTION ck_append_only();

DROP TRIGGER IF EXISTS trg_append_only ON payouts;
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON payouts
  FOR EACH ROW EXECUTE FUNCTION ck_append_only();

DROP TRIGGER IF EXISTS trg_append_only ON invoices;
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION ck_append_only();

DROP TRIGGER IF EXISTS trg_append_only ON credit_notes;
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON credit_notes
  FOR EACH ROW EXECUTE FUNCTION ck_append_only();

DROP TRIGGER IF EXISTS trg_append_only ON audit_logs;
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION ck_append_only();
```

Note for `0003_grants.sql`: the app role must also lack `DELETE` and `TRUNCATE` on these six
tables (TRUNCATE bypasses row triggers). Statement-level TRUNCATE trigger as belt-and-braces:

```sql
CREATE OR REPLACE FUNCTION ck_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append_only'
    USING ERRCODE = 'integrity_constraint_violation',
          DETAIL  = format('TRUNCATE on %s is not allowed (BR-17)', TG_TABLE_NAME);
END;
$$;

DROP TRIGGER IF EXISTS trg_no_truncate ON ledger_entries;
CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON ledger_entries EXECUTE FUNCTION ck_no_truncate();
DROP TRIGGER IF EXISTS trg_no_truncate ON allocations;
CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON allocations EXECUTE FUNCTION ck_no_truncate();
DROP TRIGGER IF EXISTS trg_no_truncate ON payouts;
CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON payouts EXECUTE FUNCTION ck_no_truncate();
DROP TRIGGER IF EXISTS trg_no_truncate ON invoices;
CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON invoices EXECUTE FUNCTION ck_no_truncate();
DROP TRIGGER IF EXISTS trg_no_truncate ON credit_notes;
CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON credit_notes EXECUTE FUNCTION ck_no_truncate();
DROP TRIGGER IF EXISTS trg_no_truncate ON audit_logs;
CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON audit_logs EXECUTE FUNCTION ck_no_truncate();
```

## 2. Payments frozen after `confirmed` (MASTER_SPEC §7 "Payment immutability", docs/05 §12)

Exactly one later transition is permitted: `confirmed → refunded`, and the only column that may
change after confirmation is `amount_refunded_minor` (monotonically non-decreasing; API-PAY-06
does `+= amount`). A payment in `refunded` is fully frozen. Rows that are not yet confirmed
(`initiated`, `submitted`, `failed`) are unrestricted here — application state machine applies.
Deletion of a confirmed or refunded payment is always rejected.

```sql
CREATE OR REPLACE FUNCTION ck_payment_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  old_rest jsonb;
  new_rest jsonb;
BEGIN
  IF OLD.status NOT IN ('confirmed', 'refunded') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payment_frozen'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('payment %s is %s and cannot be deleted', OLD.id, OLD.status);
  END IF;

  -- Every column except the two mutable ones must be byte-identical.
  old_rest := to_jsonb(OLD) - 'status' - 'amount_refunded_minor';
  new_rest := to_jsonb(NEW) - 'status' - 'amount_refunded_minor';
  IF old_rest <> new_rest THEN
    RAISE EXCEPTION 'payment_frozen'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('payment %s is %s; only status confirmed→refunded and amount_refunded_minor may change', OLD.id, OLD.status);
  END IF;

  -- Status: confirmed may stay confirmed or become refunded; refunded is terminal.
  IF OLD.status = 'refunded' AND NEW.status <> 'refunded' THEN
    RAISE EXCEPTION 'payment_frozen'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('payment %s is refunded; status is terminal', OLD.id);
  END IF;
  IF OLD.status = 'confirmed' AND NEW.status NOT IN ('confirmed', 'refunded') THEN
    RAISE EXCEPTION 'payment_frozen'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('payment %s: illegal transition confirmed → %s', OLD.id, NEW.status);
  END IF;

  -- amount_refunded_minor may only grow (never cleared, never reduced).
  IF NEW.amount_refunded_minor IS DISTINCT FROM OLD.amount_refunded_minor THEN
    IF NEW.amount_refunded_minor IS NULL
       OR NEW.amount_refunded_minor < COALESCE(OLD.amount_refunded_minor, 0) THEN
      RAISE EXCEPTION 'payment_frozen'
        USING ERRCODE = 'integrity_constraint_violation',
              DETAIL  = format('payment %s: amount_refunded_minor may only increase', OLD.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_frozen ON payments;
CREATE TRIGGER trg_payment_frozen BEFORE UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION ck_payment_frozen();
```

## 3. `order_items.ownership_id` — write-once-then-frozen, except the confirm-time re-validation

docs/06 §4.2: the ownership version is captured at order creation, re-validated at confirm time
("the version active at payment time wins", BR-05) and updated *before* posting — the only
permitted update. The unambiguous, ordering-independent gate is the allocation row: posting
writes `allocations(order_item_id)` in the same transaction, so once an allocation exists the
column is frozen. Before that, a null may be set and a non-null may be replaced (re-validation).

```sql
CREATE OR REPLACE FUNCTION ck_order_item_ownership_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ownership_id IS NOT DISTINCT FROM OLD.ownership_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM allocations a WHERE a.order_item_id = OLD.id) THEN
    RAISE EXCEPTION 'ownership_frozen'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('order_items.ownership_id on %s is frozen after ledger posting', OLD.id);
  END IF;

  -- Belt-and-braces: never allow changes on an order that has left the payable states.
  IF EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = OLD.order_id
      AND o.status IN ('fulfilled', 'refunded', 'partially_refunded')
  ) THEN
    RAISE EXCEPTION 'ownership_frozen'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('order_items.ownership_id on %s is frozen (order settled)', OLD.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_item_ownership_frozen ON order_items;
CREATE TRIGGER trg_order_item_ownership_frozen BEFORE UPDATE OF ownership_id ON order_items
  FOR EACH ROW EXECUTE FUNCTION ck_order_item_ownership_frozen();
```

## 4. Approver ≠ requester on `approval_decisions` (BR-13, MASTER_SPEC §4.5)

```sql
CREATE OR REPLACE FUNCTION ck_approver_is_requester() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  requester uuid;
BEGIN
  SELECT requested_by INTO requester FROM approval_requests WHERE id = NEW.request_id;
  IF requester IS NULL THEN
    RAISE EXCEPTION 'approval request % not found', NEW.request_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF requester = NEW.decided_by THEN
    RAISE EXCEPTION 'approver_is_requester'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('user %s requested %s and cannot decide it (BR-13)', NEW.decided_by, NEW.request_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approver_is_requester ON approval_decisions;
CREATE TRIGGER trg_approver_is_requester BEFORE INSERT OR UPDATE OF request_id, decided_by ON approval_decisions
  FOR EACH ROW EXECUTE FUNCTION ck_approver_is_requester();
```

## 5. VIEW `partner_balances` (docs/05 §7, FR-FIN-06, API-FIN-03)

Σ partner_allocation − Σ refund_partner_allocation − Σ payout − Σ expense share, per partner and
currency, plus INR via `amount_inr_minor`. Relies on the ledger sign convention (drizzle/schema/
finance.ts): `partner_allocation` entries are positive, `refund_partner_allocation`, `payout` and
`expense` entries against a partner are negative, so `balance_minor = Σ amount_minor` over the
partner's rows and the component columns are exposed as positive magnitudes. `adjustment`
entries with `party_type = 'partner'` are included (API-FIN-08 posts corrections here; the nightly
`finance.reconcile` job checks `partner_balances = Σ entries`). One row per (partner, currency);
the service groups rows into `byCurrency[]` and sums `balance_inr_minor` for `balanceInrMinor`.

```sql
CREATE OR REPLACE VIEW partner_balances AS
SELECT
  le.partner_id,
  le.currency,
  COALESCE(SUM(le.amount_minor)     FILTER (WHERE le.entry_type = 'partner_allocation'),        0)::bigint AS allocated_minor,
  COALESCE(-SUM(le.amount_minor)    FILTER (WHERE le.entry_type = 'refund_partner_allocation'), 0)::bigint AS refunded_minor,
  COALESCE(-SUM(le.amount_minor)    FILTER (WHERE le.entry_type = 'expense'),                   0)::bigint AS expenses_minor,
  COALESCE(-SUM(le.amount_minor)    FILTER (WHERE le.entry_type = 'payout'),                    0)::bigint AS paid_out_minor,
  COALESCE(SUM(le.amount_minor)     FILTER (WHERE le.entry_type = 'adjustment'),                0)::bigint AS adjusted_minor,
  COALESCE(SUM(le.amount_minor), 0)::bigint                                                                AS balance_minor,
  COALESCE(SUM(le.amount_inr_minor), 0)::bigint                                                            AS balance_inr_minor,
  MAX(le.created_at)                                                                                       AS last_entry_at
FROM ledger_entries le
WHERE le.party_type = 'partner'
  AND le.partner_id IS NOT NULL
  AND le.entry_type IN ('partner_allocation', 'refund_partner_allocation', 'payout', 'expense', 'adjustment')
GROUP BY le.partner_id, le.currency;
```

## 6. VIEW `customer_credits` (docs/05 §7, FR-PAY-07, API-FIN-09 `customer_credits` report)

Payments carrying an overpayment (`customer_credit_minor > 0`) that have not yet been settled.
There is no "applied" state in release 1 (credits are never allocated and are returned by hand);
a credit counts as settled when the payment has moved to `refunded`, so the view lists confirmed
payments only. `amount_refunded_minor` is exposed so admins can see partial refunds against the
same payment.

```sql
CREATE OR REPLACE VIEW customer_credits AS
SELECT
  p.id            AS payment_id,
  p.order_id,
  o.order_no,
  o.user_id,
  o.client_email,
  p.currency,
  p.amount_due_minor,
  p.amount_received_minor,
  p.customer_credit_minor              AS credit_minor,
  COALESCE(p.amount_refunded_minor, 0) AS amount_refunded_minor,
  (p.customer_credit_minor * o.fx_rate_to_inr)::bigint AS credit_inr_minor,
  p.confirmed_at,
  p.confirmed_by
FROM payments p
JOIN orders o ON o.id = p.order_id
WHERE p.status = 'confirmed'
  AND p.customer_credit_minor IS NOT NULL
  AND p.customer_credit_minor > 0;
```

## 7. Checklist for `apply-clean.test.ts` (`pg_trigger` names)

| Table | Trigger |
|-------|---------|
| ledger_entries, allocations, payouts, invoices, credit_notes, audit_logs | `trg_append_only`, `trg_no_truncate` |
| payments | `trg_payment_frozen` |
| order_items | `trg_order_item_ownership_frozen` |
| approval_decisions | `trg_approver_is_requester` |

Views: `partner_balances`, `customer_credits`.

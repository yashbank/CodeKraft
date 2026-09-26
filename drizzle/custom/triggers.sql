-- CodeKraft integrity triggers (docs/05 §12, §15). Canonical copy; applied by migration 0001.
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS). The statement-breakpoint marker lines
-- are drizzle migrator separators and plain comments for psql.
--
-- Error identifiers (RAISE EXCEPTION message; SQLSTATE 23000 integrity_constraint_violation):
--   append_only, payment_frozen, ownership_frozen, approver_is_requester,
--   ownership_lines_sum, category_depth

-- ---------------------------------------------------------------------------------------------
-- 1. Append-only: ledger_entries, allocations, payouts, invoices, credit_notes, audit_logs (BR-17)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ck_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME IN ('invoices', 'credit_notes') THEN
    IF OLD.pdf_media_id IS NULL AND NEW.pdf_media_id IS NOT NULL THEN
      IF (to_jsonb(NEW) - 'pdf_media_id') = (to_jsonb(OLD) - 'pdf_media_id') THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  RAISE EXCEPTION 'append_only'
    USING ERRCODE = 'integrity_constraint_violation',
          DETAIL  = format('%s is append-only; %s is not allowed (BR-17)', TG_TABLE_NAME, TG_OP),
          HINT    = 'Post a correcting row instead of changing history.';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ck_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append_only'
    USING ERRCODE = 'integrity_constraint_violation',
          DETAIL  = format('TRUNCATE on %s is not allowed (BR-17)', TG_TABLE_NAME);
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_append_only ON ledger_entries;
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ck_append_only();
DROP TRIGGER IF EXISTS trg_no_truncate ON ledger_entries;
CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION ck_no_truncate();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_append_only ON allocations;
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON allocations
  FOR EACH ROW EXECUTE FUNCTION ck_append_only();
DROP TRIGGER IF EXISTS trg_no_truncate ON allocations;
CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON allocations
  FOR EACH STATEMENT EXECUTE FUNCTION ck_no_truncate();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_append_only ON payouts;
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON payouts
  FOR EACH ROW EXECUTE FUNCTION ck_append_only();
DROP TRIGGER IF EXISTS trg_no_truncate ON payouts;
CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON payouts
  FOR EACH STATEMENT EXECUTE FUNCTION ck_no_truncate();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_append_only ON invoices;
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION ck_append_only();
DROP TRIGGER IF EXISTS trg_no_truncate ON invoices;
CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON invoices
  FOR EACH STATEMENT EXECUTE FUNCTION ck_no_truncate();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_append_only ON credit_notes;
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON credit_notes
  FOR EACH ROW EXECUTE FUNCTION ck_append_only();
DROP TRIGGER IF EXISTS trg_no_truncate ON credit_notes;
CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON credit_notes
  FOR EACH STATEMENT EXECUTE FUNCTION ck_no_truncate();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_append_only ON audit_logs;
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION ck_append_only();
DROP TRIGGER IF EXISTS trg_no_truncate ON audit_logs;
CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION ck_no_truncate();
--> statement-breakpoint
-- ---------------------------------------------------------------------------------------------
-- 2. Payments frozen after `confirmed` (docs/05 §12, MASTER_SPEC §7 "Payment immutability")
--    confirmed → refunded is the only later status transition; amount_refunded_minor is the only
--    other mutable column and may only grow (API-PAY-06 partial refunds keep status = confirmed).
--    `refunded` is terminal and fully frozen. Confirmed/refunded rows can never be deleted.
--    Rows in initiated/submitted/failed are left to the application state machine.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ck_payment_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  old_rest jsonb;
  new_rest jsonb;
BEGIN
  IF OLD.status NOT IN ('confirmed', 'refunded') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payment_frozen'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('payment %s is %s and cannot be deleted', OLD.id, OLD.status);
  END IF;

  IF OLD.status = 'refunded' THEN
    IF to_jsonb(NEW) <> to_jsonb(OLD) THEN
      RAISE EXCEPTION 'payment_frozen'
        USING ERRCODE = 'integrity_constraint_violation',
              DETAIL  = format('payment %s is refunded; the row is terminal and frozen', OLD.id);
    END IF;
    RETURN NEW;
  END IF;

  -- OLD.status = 'confirmed': every column except the two mutable ones must be identical.
  old_rest := to_jsonb(OLD) - 'status' - 'amount_refunded_minor';
  new_rest := to_jsonb(NEW) - 'status' - 'amount_refunded_minor';
  IF old_rest <> new_rest THEN
    RAISE EXCEPTION 'payment_frozen'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('payment %s is confirmed; only status confirmed→refunded and amount_refunded_minor may change', OLD.id);
  END IF;

  IF NEW.status NOT IN ('confirmed', 'refunded') THEN
    RAISE EXCEPTION 'payment_frozen'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('payment %s: illegal transition confirmed → %s', OLD.id, NEW.status);
  END IF;

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
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_payment_frozen ON payments;
CREATE TRIGGER trg_payment_frozen BEFORE UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION ck_payment_frozen();
--> statement-breakpoint
-- ---------------------------------------------------------------------------------------------
-- 3. order_items.ownership_id: replaceable until ledger posting (confirm-time re-validation,
--    docs/06 §4.2 / BR-05), frozen once an allocation row exists or the order is settled.
-- ---------------------------------------------------------------------------------------------
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
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_order_item_ownership_frozen ON order_items;
CREATE TRIGGER trg_order_item_ownership_frozen BEFORE UPDATE OF ownership_id ON order_items
  FOR EACH ROW EXECUTE FUNCTION ck_order_item_ownership_frozen();
--> statement-breakpoint
-- ---------------------------------------------------------------------------------------------
-- 4. Approver ≠ requester on approval_decisions (BR-13, MASTER_SPEC §4.5)
-- ---------------------------------------------------------------------------------------------
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
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_approver_is_requester ON approval_decisions;
CREATE TRIGGER trg_approver_is_requester
  BEFORE INSERT OR UPDATE OF request_id, decided_by ON approval_decisions
  FOR EACH ROW EXECUTE FUNCTION ck_approver_is_requester();
--> statement-breakpoint
-- ---------------------------------------------------------------------------------------------
-- 5. Ownership lines sum to 10000 bps per ownership (BR-06, BR-07, FI-03). Deferred constraint
--    trigger so lines can be inserted one by one; checked at COMMIT (or SET CONSTRAINTS ALL
--    IMMEDIATE). An ownership deleted in the same transaction (cascade) is skipped.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ck_ownership_lines_sum_for(target uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  total bigint;
BEGIN
  IF target IS NULL OR NOT EXISTS (SELECT 1 FROM product_ownerships po WHERE po.id = target) THEN
    RETURN;
  END IF;
  SELECT COALESCE(SUM(l.share_bps), 0) INTO total
    FROM product_ownership_lines l WHERE l.ownership_id = target;
  IF total <> 10000 THEN
    RAISE EXCEPTION 'ownership_lines_sum'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('ownership %s: share_bps sum is %s, expected 10000 (BR-06)', target, total);
  END IF;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ck_ownership_lines_sum() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM ck_ownership_lines_sum_for(NEW.ownership_id);
  END IF;
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.ownership_id IS DISTINCT FROM NEW.ownership_id) THEN
    PERFORM ck_ownership_lines_sum_for(OLD.ownership_id);
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_ownership_lines_sum ON product_ownership_lines;
CREATE CONSTRAINT TRIGGER trg_ownership_lines_sum
  AFTER INSERT OR UPDATE OR DELETE ON product_ownership_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ck_ownership_lines_sum();
--> statement-breakpoint
-- ---------------------------------------------------------------------------------------------
-- 6. Category depth ≤ 2 (D-303): a subcategory cannot have a parent that is itself a subcategory,
--    and a category with children cannot become a subcategory.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ck_category_depth() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'category_depth'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('category %s cannot be its own parent', NEW.id);
  END IF;
  IF EXISTS (SELECT 1 FROM categories p WHERE p.id = NEW.parent_id AND p.parent_id IS NOT NULL) THEN
    RAISE EXCEPTION 'category_depth'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('parent %s is already a subcategory; categories are at most two levels deep (D-303)', NEW.parent_id);
  END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM categories c WHERE c.parent_id = NEW.id) THEN
    RAISE EXCEPTION 'category_depth'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format('category %s has children and cannot become a subcategory (D-303)', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_category_depth ON categories;
CREATE TRIGGER trg_category_depth BEFORE INSERT OR UPDATE OF parent_id ON categories
  FOR EACH ROW EXECUTE FUNCTION ck_category_depth();

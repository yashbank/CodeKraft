-- Re-create ck_append_only with the pdf_media_id exemption. Migration 0001 was edited in place on
-- 2026-09-26 after it had already been applied, so databases migrated before that still run the
-- unconditional version and reject invoice/credit-note PDF attachment (BR-17 exemption).
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

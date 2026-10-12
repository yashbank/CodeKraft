-- Flat ownership model: company_cut_bps + SUM(share_bps) must equal 10000.
-- Previously the trigger enforced SUM(share_bps) = 10000 independently (two-tier model).
-- Now it joins product_ownerships to get company_cut_bps and checks the flat total.

CREATE OR REPLACE FUNCTION ck_ownership_lines_sum_for(target uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  company_bps bigint;
  lines_sum   bigint;
BEGIN
  IF target IS NULL OR NOT EXISTS (SELECT 1 FROM product_ownerships po WHERE po.id = target) THEN
    RETURN;
  END IF;

  SELECT po.company_cut_bps INTO company_bps
    FROM product_ownerships po WHERE po.id = target;

  SELECT COALESCE(SUM(l.share_bps), 0) INTO lines_sum
    FROM product_ownership_lines l WHERE l.ownership_id = target;

  -- Allow 0 lines when company owns 100 % (company_bps = 10000, lines_sum = 0).
  IF company_bps + lines_sum <> 10000 THEN
    RAISE EXCEPTION 'ownership_lines_sum'
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = format(
              'ownership %s: company_cut_bps (%s) + share_bps sum (%s) = %s, expected 10000 (BR-06)',
              target, company_bps, lines_sum, company_bps + lines_sum
            );
  END IF;
END;
$$;

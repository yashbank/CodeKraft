-- P9-02: lock the FX rate used for a non-base-currency expense (rate, source, timestamp).
-- Additive + nullable (pre-existing rows keep resolving via fx_rates). Hand-written, no snapshot.
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "fx_rate_to_inr" numeric(18,8);
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "fx_rate_source" text;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "fx_rate_at" timestamp with time zone;

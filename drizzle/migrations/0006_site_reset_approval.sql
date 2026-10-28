-- Approval type for super-admin "Reset site data" (P6-05).
-- Hand-written (no snapshot): snapshots 0003/0004 already collide for drizzle-kit generate.
ALTER TYPE "approval_type" ADD VALUE IF NOT EXISTS 'site.reset';

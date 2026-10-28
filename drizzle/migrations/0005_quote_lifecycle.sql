-- Custom quote lifecycle: viewed/rejected statuses, tax, line items, internal note, timestamps.
-- Hand-written (no snapshot): snapshots 0003/0004 already collide for drizzle-kit generate.
ALTER TYPE "quote_status" ADD VALUE IF NOT EXISTS 'viewed';--> statement-breakpoint
ALTER TYPE "quote_status" ADD VALUE IF NOT EXISTS 'rejected';--> statement-breakpoint
ALTER TABLE "custom_quotes" ADD COLUMN IF NOT EXISTS "tax_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_quotes" ADD COLUMN IF NOT EXISTS "line_items" jsonb;--> statement-breakpoint
ALTER TABLE "custom_quotes" ADD COLUMN IF NOT EXISTS "internal_note" text;--> statement-breakpoint
ALTER TABLE "custom_quotes" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "custom_quotes" ADD COLUMN IF NOT EXISTS "viewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "custom_quotes" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "custom_quotes" ADD COLUMN IF NOT EXISTS "rejected_at" timestamp with time zone;

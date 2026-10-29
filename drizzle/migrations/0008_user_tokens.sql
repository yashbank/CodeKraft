-- P10-01: admin-issued invite/reset links (hash only) + forced password change flag.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false NOT NULL;
CREATE TABLE IF NOT EXISTS "user_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" text NOT NULL,
  "purpose" text NOT NULL,
  "email" citext NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text,
  "partner_name" text,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_tokens_token_hash_unique" UNIQUE ("token_hash")
);
CREATE INDEX IF NOT EXISTS "user_tokens_email_idx" ON "user_tokens" ("email", "purpose");

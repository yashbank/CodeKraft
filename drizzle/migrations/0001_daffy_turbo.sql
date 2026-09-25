-- P2.4 core schema (docs/05): domains A/B/C on top of 0000 (auth). Hand-edited after
-- `drizzle-kit generate`: the IMMUTABLE wrapper below is required by products.search_vector and
-- must exist before CREATE TABLE "products"; the integrity triggers and reporting views from
-- drizzle/custom/{triggers,views}.sql are appended at the end (docs/05 §12, §15).
CREATE FUNCTION immutable_array_to_string(text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT array_to_string($1, ' ') $$;
--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'screenshot', 'gallery', 'video_embed', 'video_file', 'presentation', 'attachment', 'og');--> statement-breakpoint
CREATE TYPE "public"."media_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."blog_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'pending_approval', 'scheduled', 'published', 'unpublished', 'archived');--> statement-breakpoint
CREATE TYPE "public"."slug_redirect_entity" AS ENUM('product', 'case_study', 'blog');--> statement-breakpoint
CREATE TYPE "public"."billing_interval" AS ENUM('monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."delivery_type" AS ENUM('saas', 'hosted', 'download', 'license', 'service', 'custom');--> statement-breakpoint
CREATE TYPE "public"."offering_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('manual_upi', 'manual_bank', 'razorpay', 'stripe', 'paypal');--> statement-breakpoint
CREATE TYPE "public"."purchase_model" AS ENUM('one_time', 'subscription', 'custom_quote');--> statement-breakpoint
CREATE TYPE "public"."update_policy" AS ENUM('all_free', 'during_access', 'major_paid');--> statement-breakpoint
CREATE TYPE "public"."ownership_status" AS ENUM('pending', 'active', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."faq_scope" AS ENUM('site', 'chatbot', 'product');--> statement-breakpoint
CREATE TYPE "public"."landing_chapter_key" AS ENUM('who', 'build', 'sell', 'proof', 'talk');--> statement-breakpoint
CREATE TYPE "public"."legal_page_key" AS ENUM('privacy', 'terms', 'refunds', 'license');--> statement-breakpoint
CREATE TYPE "public"."testimonial_context" AS ENUM('site', 'product');--> statement-breakpoint
CREATE TYPE "public"."approval_decision" AS ENUM('approve', 'reject');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'applied', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."approval_type" AS ENUM('product.publish', 'ownership.change', 'ledger.adjustment', 'refund.issue', 'payout.record', 'product.archive', 'product.delete', 'admin.user_change', 'project_order.split');--> statement-breakpoint
CREATE TYPE "public"."coupon_kind" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'paid', 'fulfilled', 'failed', 'cancelled', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('product', 'project');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('manual_upi', 'manual_bank', 'razorpay', 'stripe', 'paypal');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('initiated', 'submitted', 'confirmed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted', 'paid', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."entry_type" AS ENUM('sale', 'discount', 'tax_collected', 'gateway_fee', 'bank_charge', 'company_cut', 'partner_allocation', 'refund_sale', 'refund_discount', 'refund_tax', 'refund_company_cut', 'refund_partner_allocation', 'payout', 'expense', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."party_type" AS ENUM('customer', 'company', 'partner', 'tax_authority', 'gateway', 'bank');--> statement-breakpoint
CREATE TYPE "public"."delivery_task_kind" AS ENUM('provision', 'revoke_external');--> statement-breakpoint
CREATE TYPE "public"."delivery_task_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TYPE "public"."entitlement_status" AS ENUM('pending', 'active', 'suspended', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."provisioning_state" AS ENUM('n/a', 'pending', 'done');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lead_activity_kind" AS ENUM('note', 'status_change', 'assignment', 'follow_up_set', 'email', 'call');--> statement-breakpoint
CREATE TYPE "public"."lead_priority" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('inquiry_form', 'product_cta', 'chatbot', 'manual');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'proposal', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."message_author_kind" AS ENUM('customer', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."query_source" AS ENUM('form', 'chatbot', 'order', 'dashboard', 'email', 'manual');--> statement-breakpoint
CREATE TYPE "public"."query_status" AS ENUM('open', 'waiting_customer', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant', 'system', 'menu');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source_type" AS ENUM('product', 'offering', 'service', 'faq', 'legal', 'case_study');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('ok', 'error');--> statement-breakpoint
CREATE SEQUENCE "public"."order_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"company" text,
	"billing_name" text,
	"billing_address" jsonb,
	"country" char(2),
	"gst_number" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"internal_notes" text,
	"notification_prefs" jsonb DEFAULT '{"email":true,"inapp":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"payout_bank_details_enc" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_key" text NOT NULL,
	"permission_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_key_permission_key_pk" PRIMARY KEY("role_key","permission_key")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"duration_s" integer,
	"checksum" text NOT NULL,
	"blur_hash" text,
	"visibility" "media_visibility" DEFAULT 'private' NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "featured_products" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_blogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"body_json" jsonb,
	"cover_media_id" uuid,
	"status" "blog_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"seo_title" text,
	"seo_description" text,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_blogs_product_id_unique" UNIQUE("product_id"),
	CONSTRAINT "product_blogs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer_json" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"media_id" uuid,
	"embed_url" text,
	"title" text,
	"alt" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_tags" (
	"product_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_tags_product_id_tag_id_pk" PRIMARY KEY("product_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "product_testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"author_title" text,
	"company" text,
	"quote" text NOT NULL,
	"avatar_media_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"version" text NOT NULL,
	"changelog_json" jsonb,
	"released_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_versions_product_version_unique" UNIQUE("product_id","version")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"description_json" jsonb,
	"category_id" uuid,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"publish_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_unlisted" boolean DEFAULT false NOT NULL,
	"is_coming_soon" boolean DEFAULT false NOT NULL,
	"is_refundable" boolean DEFAULT false NOT NULL,
	"tax_enabled" boolean DEFAULT false NOT NULL,
	"current_version" text,
	"features" jsonb,
	"benefits" jsonb,
	"target_audience" jsonb,
	"use_cases" jsonb,
	"industry" text[] DEFAULT '{}'::text[] NOT NULL,
	"tech_stack" text[] DEFAULT '{}'::text[] NOT NULL,
	"requirements_json" jsonb,
	"live_demo_url" text,
	"seo_title" text,
	"seo_description" text,
	"og_image_media_id" uuid,
	"canonical_url" text,
	"tag_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(name, '')), 'A') || setweight(to_tsvector('english', coalesce(short_description, '')), 'B') || setweight(to_tsvector('english', coalesce(immutable_array_to_string(tag_names), '')), 'B') || setweight(to_tsvector('english', coalesce(immutable_array_to_string(tech_stack), '')), 'B') || setweight(to_tsvector('english', coalesce(immutable_array_to_string(industry), '')), 'B') || setweight(to_tsvector('english', coalesce(description_json, '{}'::jsonb)), 'C')) STORED,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "slug_redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" "slug_redirect_entity" NOT NULL,
	"old_slug" text NOT NULL,
	"new_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slug_redirects_entity_old_slug_unique" UNIQUE("entity","old_slug")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlists_user_id_product_id_pk" PRIMARY KEY("user_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "offering_payment_methods" (
	"offering_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offering_payment_methods_offering_id_method_pk" PRIMARY KEY("offering_id","method")
);
--> statement-breakpoint
CREATE TABLE "offering_prices" (
	"offering_id" uuid NOT NULL,
	"currency" char(3) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"compare_at_minor" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offering_prices_offering_id_currency_pk" PRIMARY KEY("offering_id","currency")
);
--> statement-breakpoint
CREATE TABLE "offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"purchase_model" "purchase_model" NOT NULL,
	"billing_interval" "billing_interval",
	"trial_days" integer,
	"license_type" text,
	"delivery_type" "delivery_type" NOT NULL,
	"delivery_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"service_steps" jsonb,
	"instructions_json" jsonb,
	"status" "offering_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offerings_product_slug_unique" UNIQUE("product_id","slug")
);
--> statement-breakpoint
CREATE TABLE "product_ownership_lines" (
	"ownership_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"share_bps" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_ownership_lines_ownership_id_partner_id_pk" PRIMARY KEY("ownership_id","partner_id"),
	CONSTRAINT "product_ownership_lines_share_bps_range" CHECK ("product_ownership_lines"."share_bps" > 0 AND "product_ownership_lines"."share_bps" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "product_ownerships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"company_cut_bps" integer DEFAULT 0 NOT NULL,
	"status" "ownership_status" DEFAULT 'pending' NOT NULL,
	"effective_from" timestamp with time zone,
	"approval_request_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_ownerships_product_version_unique" UNIQUE("product_id","version"),
	CONSTRAINT "product_ownerships_company_cut_bps_range" CHECK ("product_ownerships"."company_cut_bps" >= 0 AND "product_ownerships"."company_cut_bps" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "case_studies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"client_name" text,
	"industry" text,
	"problem_json" jsonb,
	"solution_json" jsonb,
	"results_json" jsonb,
	"tech_stack" text[] DEFAULT '{}'::text[] NOT NULL,
	"cover_media_id" uuid,
	"gallery" jsonb,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_studies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "client_logos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"media_id" uuid NOT NULL,
	"url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer_json" jsonb NOT NULL,
	"scope" "faq_scope" NOT NULL,
	"product_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" "landing_chapter_key" NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"body_json" jsonb,
	"media" jsonb,
	"cta" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "landing_chapters_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "legal_page_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_page_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"body_json" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_page_versions_page_version_unique" UNIQUE("legal_page_id","version")
);
--> statement-breakpoint
CREATE TABLE "legal_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" "legal_page_key" NOT NULL,
	"title" text NOT NULL,
	"body_json" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_pages_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"deliverables" jsonb,
	"body_json" jsonb,
	"icon" text,
	"position" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote" text NOT NULL,
	"author_name" text NOT NULL,
	"author_title" text,
	"company" text,
	"avatar_media_id" uuid,
	"context" "testimonial_context" DEFAULT 'site' NOT NULL,
	"product_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"base" char(3) NOT NULL,
	"quote" char(3) NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"as_of" date NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_base_quote_as_of_pk" PRIMARY KEY("base","quote","as_of")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"decided_by" uuid NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_decisions_request_decider_uq" UNIQUE("request_id","decided_by")
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "approval_type" NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"requested_by" uuid NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"user_agent" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_redemptions_coupon_order_uq" UNIQUE("coupon_id","order_id")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" "citext" NOT NULL,
	"kind" "coupon_kind" NOT NULL,
	"value" integer NOT NULL,
	"currency" char(3),
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"max_redemptions" integer,
	"redemptions_count" integer DEFAULT 0 NOT NULL,
	"first_purchase_only" boolean DEFAULT false NOT NULL,
	"product_ids" uuid[],
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "custom_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"offering_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"currency" char(3) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"order_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_quotes_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"offering_id" uuid,
	"product_id" uuid,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_minor" bigint NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint NOT NULL,
	"ownership_id" uuid,
	"split_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" text NOT NULL,
	"type" "order_type" DEFAULT 'product' NOT NULL,
	"user_id" uuid,
	"client_name" text,
	"client_email" text,
	"client_company" text,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"currency" char(3) NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint NOT NULL,
	"coupon_id" uuid,
	"custom_quote_id" uuid,
	"split_approval_request_id" uuid,
	"billing_snapshot" jsonb NOT NULL,
	"tax_rate_bps" integer DEFAULT 0 NOT NULL,
	"tax_snapshot" jsonb,
	"fx_rate_to_inr" numeric(18, 8) NOT NULL,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"status" "payment_status" DEFAULT 'initiated' NOT NULL,
	"amount_due_minor" bigint NOT NULL,
	"amount_received_minor" bigint,
	"bank_shortfall_minor" bigint,
	"amount_refunded_minor" bigint,
	"customer_credit_minor" bigint,
	"currency" char(3) NOT NULL,
	"instructions" jsonb,
	"customer_reference" text,
	"customer_submitted_at" timestamp with time zone,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"failure_reason" text,
	"provider_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"reason" text NOT NULL,
	"approval_request_id" uuid,
	"credit_note_id" uuid,
	"executed_by" uuid,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_offering_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"offering_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_offering_purchases_user_offering_uq" UNIQUE("user_id","offering_id")
);
--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"ownership_id" uuid,
	"company_cut_bps" integer NOT NULL,
	"distributable_minor" bigint NOT NULL,
	"company_minor" bigint NOT NULL,
	"lines" jsonb NOT NULL,
	"currency" char(3) NOT NULL,
	"amount_inr_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"category" text NOT NULL,
	"description" text,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"incurred_on" date NOT NULL,
	"shared_by_split" boolean DEFAULT true NOT NULL,
	"receipt_media_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"entry_type" "entry_type" NOT NULL,
	"order_id" uuid,
	"order_item_id" uuid,
	"payment_id" uuid,
	"refund_id" uuid,
	"payout_id" uuid,
	"expense_id" uuid,
	"party_type" "party_type" NOT NULL,
	"partner_id" uuid,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"fx_rate_to_inr" numeric(18, 8) NOT NULL,
	"amount_inr_minor" bigint NOT NULL,
	"memo" text,
	"approval_request_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"paid_on" date NOT NULL,
	"reference" text NOT NULL,
	"note" text,
	"approval_request_id" uuid,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_note_sequences" (
	"fy" text PRIMARY KEY NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_no" text NOT NULL,
	"invoice_id" uuid NOT NULL,
	"refund_id" uuid NOT NULL,
	"fy" text NOT NULL,
	"seq" integer NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pdf_media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_notes_credit_no_unique" UNIQUE("credit_no")
);
--> statement-breakpoint
CREATE TABLE "invoice_sequences" (
	"fy" text PRIMARY KEY NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_no" text NOT NULL,
	"order_id" uuid NOT NULL,
	"fy" text NOT NULL,
	"seq" integer NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seller_snapshot" jsonb NOT NULL,
	"buyer_snapshot" jsonb NOT NULL,
	"lines" jsonb NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"gst_breakdown" jsonb,
	"pdf_media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_no_unique" UNIQUE("invoice_no"),
	CONSTRAINT "invoices_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "delivery_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entitlement_id" uuid NOT NULL,
	"kind" "delivery_task_kind" NOT NULL,
	"status" "delivery_task_status" DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"done_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entitlement_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"offering_id" uuid NOT NULL,
	"order_item_id" uuid,
	"product_id" uuid NOT NULL,
	"delivery_type" "delivery_type" NOT NULL,
	"status" "entitlement_status" DEFAULT 'pending' NOT NULL,
	"access_starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"access_ends_at" timestamp with time zone,
	"update_policy" "update_policy" NOT NULL,
	"download_cap" integer,
	"downloads_used" integer DEFAULT 0 NOT NULL,
	"license_key_enc" text,
	"provisioning_state" "provisioning_state" DEFAULT 'n/a' NOT NULL,
	"provisioning_notes" jsonb,
	"granted_manually_by" uuid,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"version" text NOT NULL,
	"media_id" uuid NOT NULL,
	"notes" text,
	"released_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entitlement_id" uuid NOT NULL,
	"step_key" text NOT NULL,
	"done_at" timestamp with time zone,
	"done_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entitlement_id" uuid NOT NULL,
	"interval" "billing_interval" NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"grace_until" timestamp with time zone,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"renewal_order_id" uuid,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_entitlement_id_unique" UNIQUE("entitlement_id")
);
--> statement-breakpoint
CREATE TABLE "lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"actor_id" uuid,
	"kind" "lead_activity_kind" NOT NULL,
	"body" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "lead_source" NOT NULL,
	"product_id" uuid,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"company" text,
	"message" text,
	"service_interest" text[] DEFAULT '{}'::text[] NOT NULL,
	"budget_hint" text,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"assigned_to" uuid,
	"priority" "lead_priority" DEFAULT 'normal' NOT NULL,
	"next_follow_up_at" timestamp with time zone,
	"lost_reason" text,
	"won_order_id" uuid,
	"turnstile_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"guest_email" text,
	"subject" text NOT NULL,
	"source" "query_source" NOT NULL,
	"order_id" uuid,
	"product_id" uuid,
	"status" "query_status" DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"conversation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "query_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_id" uuid NOT NULL,
	"author_id" uuid,
	"author_kind" "message_author_kind" NOT NULL,
	"body_json" jsonb NOT NULL,
	"attachments" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"retrieved_chunk_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_usage_daily" (
	"scope" text NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chat_usage_daily_scope_day_pk" PRIMARY KEY("scope","day")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"escalated_query_id" uuid,
	"model" text NOT NULL,
	"prompt_version_id" uuid NOT NULL,
	"purge_after" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "knowledge_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("knowledge_chunks"."title", '')), 'A') || setweight(to_tsvector('english', coalesce("knowledge_chunks"."body", '')), 'B')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"system_prompt" text NOT NULL,
	"version" integer NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_email" text NOT NULL,
	"template" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" smallint DEFAULT 5 NOT NULL,
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"payload" jsonb,
	"channel_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"user_id" uuid,
	"anon_id" text,
	"product_id" uuid,
	"order_id" uuid,
	"props" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_layouts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"layout" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files_upload_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"object_key" text NOT NULL,
	"consumed" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_upload_intents_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "job_status",
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_key_roles_key_fk" FOREIGN KEY ("role_key") REFERENCES "public"."roles"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "featured_products" ADD CONSTRAINT "featured_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_blogs" ADD CONSTRAINT "product_blogs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_blogs" ADD CONSTRAINT "product_blogs_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_blogs" ADD CONSTRAINT "product_blogs_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_faqs" ADD CONSTRAINT "product_faqs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_testimonials" ADD CONSTRAINT "product_testimonials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_testimonials" ADD CONSTRAINT "product_testimonials_avatar_media_id_media_id_fk" FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_og_image_media_id_media_id_fk" FOREIGN KEY ("og_image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_payment_methods" ADD CONSTRAINT "offering_payment_methods_offering_id_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_prices" ADD CONSTRAINT "offering_prices_offering_id_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ownership_lines" ADD CONSTRAINT "product_ownership_lines_ownership_id_product_ownerships_id_fk" FOREIGN KEY ("ownership_id") REFERENCES "public"."product_ownerships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ownership_lines" ADD CONSTRAINT "product_ownership_lines_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ownerships" ADD CONSTRAINT "product_ownerships_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ownerships" ADD CONSTRAINT "product_ownerships_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ownerships" ADD CONSTRAINT "product_ownerships_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_logos" ADD CONSTRAINT "client_logos_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_page_versions" ADD CONSTRAINT "legal_page_versions_legal_page_id_legal_pages_id_fk" FOREIGN KEY ("legal_page_id") REFERENCES "public"."legal_pages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_page_versions" ADD CONSTRAINT "legal_page_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_avatar_media_id_media_id_fk" FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_request_id_approval_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."approval_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_quotes" ADD CONSTRAINT "custom_quotes_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_quotes" ADD CONSTRAINT "custom_quotes_offering_id_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_quotes" ADD CONSTRAINT "custom_quotes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_quotes" ADD CONSTRAINT "custom_quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_offering_id_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_ownership_id_product_ownerships_id_fk" FOREIGN KEY ("ownership_id") REFERENCES "public"."product_ownerships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_custom_quote_id_custom_quotes_id_fk" FOREIGN KEY ("custom_quote_id") REFERENCES "public"."custom_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_split_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("split_approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_offering_purchases" ADD CONSTRAINT "user_offering_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_offering_purchases" ADD CONSTRAINT "user_offering_purchases_offering_id_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_offering_purchases" ADD CONSTRAINT "user_offering_purchases_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_ownership_id_product_ownerships_id_fk" FOREIGN KEY ("ownership_id") REFERENCES "public"."product_ownerships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_media_id_media_id_fk" FOREIGN KEY ("receipt_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_pdf_media_id_media_id_fk" FOREIGN KEY ("pdf_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_pdf_media_id_media_id_fk" FOREIGN KEY ("pdf_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_offering_id_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_granted_manually_by_users_id_fk" FOREIGN KEY ("granted_manually_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_files" ADD CONSTRAINT "release_files_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_files" ADD CONSTRAINT "release_files_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_progress" ADD CONSTRAINT "service_progress_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_progress" ADD CONSTRAINT "service_progress_done_by_users_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_renewal_order_id_orders_id_fk" FOREIGN KEY ("renewal_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_won_order_id_orders_id_fk" FOREIGN KEY ("won_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_messages" ADD CONSTRAINT "query_messages_query_id_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_messages" ADD CONSTRAINT "query_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_escalated_query_id_queries_id_fk" FOREIGN KEY ("escalated_query_id") REFERENCES "public"."queries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files_upload_intents" ADD CONSTRAINT "files_upload_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_profiles_country_idx" ON "customer_profiles" USING btree ("country");--> statement-breakpoint
CREATE INDEX "partners_active_idx" ON "partners" USING btree ("active");--> statement-breakpoint
CREATE INDEX "media_uploaded_by_idx" ON "media" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "media_visibility_idx" ON "media" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "featured_products_position_idx" ON "featured_products" USING btree ("position");--> statement-breakpoint
CREATE INDEX "product_blogs_status_published_at_idx" ON "product_blogs" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "product_blogs_author_idx" ON "product_blogs" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "product_faqs_product_idx" ON "product_faqs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_media_product_idx" ON "product_media" USING btree ("product_id","kind","position");--> statement-breakpoint
CREATE INDEX "product_media_media_idx" ON "product_media" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "product_tags_tag_idx" ON "product_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "product_testimonials_product_idx" ON "product_testimonials" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_versions_product_idx" ON "product_versions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_search_vector_idx" ON "products" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "products_status_publish_at_idx" ON "products" USING btree ("status","publish_at");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_og_image_media_idx" ON "products" USING btree ("og_image_media_id");--> statement-breakpoint
CREATE INDEX "products_created_by_idx" ON "products" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "products_updated_by_idx" ON "products" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "wishlists_product_idx" ON "wishlists" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "offerings_product_idx" ON "offerings" USING btree ("product_id","status","position");--> statement-breakpoint
CREATE INDEX "product_ownership_lines_partner_idx" ON "product_ownership_lines" USING btree ("partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_ownerships_one_active_idx" ON "product_ownerships" USING btree ("product_id") WHERE "product_ownerships"."status" = 'active';--> statement-breakpoint
CREATE INDEX "product_ownerships_approval_request_idx" ON "product_ownerships" USING btree ("approval_request_id");--> statement-breakpoint
CREATE INDEX "case_studies_published_idx" ON "case_studies" USING btree ("published","published_at");--> statement-breakpoint
CREATE INDEX "client_logos_media_idx" ON "client_logos" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "faqs_scope_idx" ON "faqs" USING btree ("scope","published","position");--> statement-breakpoint
CREATE INDEX "faqs_product_idx" ON "faqs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "landing_chapters_position_idx" ON "landing_chapters" USING btree ("published","position");--> statement-breakpoint
CREATE INDEX "legal_page_versions_published_by_idx" ON "legal_page_versions" USING btree ("published_by");--> statement-breakpoint
CREATE INDEX "services_position_idx" ON "services" USING btree ("published","position");--> statement-breakpoint
CREATE INDEX "testimonials_context_idx" ON "testimonials" USING btree ("context","published","position");--> statement-breakpoint
CREATE INDEX "testimonials_product_idx" ON "testimonials" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "site_settings_updated_by_idx" ON "site_settings" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "approval_decisions_decided_by_idx" ON "approval_decisions" USING btree ("decided_by");--> statement-breakpoint
CREATE INDEX "approval_requests_status_idx" ON "approval_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "approval_requests_subject_idx" ON "approval_requests" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "approval_requests_requested_by_idx" ON "approval_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "approval_requests_type_idx" ON "approval_requests" USING btree ("type");--> statement-breakpoint
CREATE INDEX "audit_logs_subject_idx" ON "audit_logs" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_user_idx" ON "coupon_redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_order_idx" ON "coupon_redemptions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "coupons_active_idx" ON "coupons" USING btree ("active","ends_at");--> statement-breakpoint
CREATE INDEX "custom_quotes_customer_idx" ON "custom_quotes" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "custom_quotes_status_idx" ON "custom_quotes" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "custom_quotes_offering_idx" ON "custom_quotes" USING btree ("offering_id");--> statement-breakpoint
CREATE INDEX "custom_quotes_order_idx" ON "custom_quotes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_offering_idx" ON "order_items" USING btree ("offering_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_items_ownership_idx" ON "order_items" USING btree ("ownership_id");--> statement-breakpoint
CREATE INDEX "orders_user_created_idx" ON "orders" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_status_expires_idx" ON "orders" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "orders_coupon_idx" ON "orders" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "orders_custom_quote_idx" ON "orders" USING btree ("custom_quote_id");--> statement-breakpoint
CREATE INDEX "orders_split_approval_idx" ON "orders" USING btree ("split_approval_request_id");--> statement-breakpoint
CREATE INDEX "orders_created_by_idx" ON "orders" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_created_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "payments_confirmed_by_idx" ON "payments" USING btree ("confirmed_by");--> statement-breakpoint
CREATE INDEX "refunds_order_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refunds_approval_idx" ON "refunds" USING btree ("approval_request_id");--> statement-breakpoint
CREATE INDEX "refunds_credit_note_idx" ON "refunds" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "user_offering_purchases_offering_idx" ON "user_offering_purchases" USING btree ("offering_id");--> statement-breakpoint
CREATE INDEX "user_offering_purchases_order_idx" ON "user_offering_purchases" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "allocations_order_item_idx" ON "allocations" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "allocations_ownership_idx" ON "allocations" USING btree ("ownership_id");--> statement-breakpoint
CREATE INDEX "expenses_product_idx" ON "expenses" USING btree ("product_id","incurred_on");--> statement-breakpoint
CREATE INDEX "expenses_incurred_on_idx" ON "expenses" USING btree ("incurred_on");--> statement-breakpoint
CREATE INDEX "expenses_receipt_media_idx" ON "expenses" USING btree ("receipt_media_id");--> statement-breakpoint
CREATE INDEX "expenses_created_by_idx" ON "expenses" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "ledger_entries_partner_created_idx" ON "ledger_entries" USING btree ("partner_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_order_idx" ON "ledger_entries" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_order_item_idx" ON "ledger_entries" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_payment_idx" ON "ledger_entries" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_refund_idx" ON "ledger_entries" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_payout_idx" ON "ledger_entries" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_expense_idx" ON "ledger_entries" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_approval_idx" ON "ledger_entries" USING btree ("approval_request_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_type_created_idx" ON "ledger_entries" USING btree ("entry_type","created_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_created_by_idx" ON "ledger_entries" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "payouts_partner_idx" ON "payouts" USING btree ("partner_id","paid_on");--> statement-breakpoint
CREATE INDEX "payouts_approval_idx" ON "payouts" USING btree ("approval_request_id");--> statement-breakpoint
CREATE INDEX "payouts_recorded_by_idx" ON "payouts" USING btree ("recorded_by");--> statement-breakpoint
CREATE INDEX "credit_notes_invoice_idx" ON "credit_notes" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "credit_notes_refund_idx" ON "credit_notes" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "credit_notes_fy_seq_idx" ON "credit_notes" USING btree ("fy","seq");--> statement-breakpoint
CREATE INDEX "credit_notes_pdf_media_idx" ON "credit_notes" USING btree ("pdf_media_id");--> statement-breakpoint
CREATE INDEX "invoices_fy_seq_idx" ON "invoices" USING btree ("fy","seq");--> statement-breakpoint
CREATE INDEX "invoices_issued_at_idx" ON "invoices" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "invoices_pdf_media_idx" ON "invoices" USING btree ("pdf_media_id");--> statement-breakpoint
CREATE INDEX "delivery_tasks_entitlement_idx" ON "delivery_tasks" USING btree ("entitlement_id");--> statement-breakpoint
CREATE INDEX "delivery_tasks_status_kind_idx" ON "delivery_tasks" USING btree ("status","kind");--> statement-breakpoint
CREATE INDEX "delivery_tasks_assigned_to_idx" ON "delivery_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "downloads_entitlement_idx" ON "downloads" USING btree ("entitlement_id");--> statement-breakpoint
CREATE INDEX "downloads_user_idx" ON "downloads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "downloads_media_idx" ON "downloads" USING btree ("media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_order_item_uq" ON "entitlements" USING btree ("order_item_id") WHERE order_item_id is not null;--> statement-breakpoint
CREATE INDEX "entitlements_user_status_idx" ON "entitlements" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "entitlements_offering_idx" ON "entitlements" USING btree ("offering_id");--> statement-breakpoint
CREATE INDEX "entitlements_product_idx" ON "entitlements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "entitlements_status_access_ends_idx" ON "entitlements" USING btree ("status","access_ends_at");--> statement-breakpoint
CREATE INDEX "release_files_product_version_idx" ON "release_files" USING btree ("product_id","version");--> statement-breakpoint
CREATE INDEX "release_files_media_idx" ON "release_files" USING btree ("media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_progress_entitlement_step_uq" ON "service_progress" USING btree ("entitlement_id","step_key");--> statement-breakpoint
CREATE INDEX "subscriptions_status_period_end_idx" ON "subscriptions" USING btree ("status","current_period_end");--> statement-breakpoint
CREATE INDEX "subscriptions_renewal_order_idx" ON "subscriptions" USING btree ("renewal_order_id");--> statement-breakpoint
CREATE INDEX "lead_activities_lead_created_idx" ON "lead_activities" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_assigned_to_idx" ON "leads" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "leads_next_follow_up_idx" ON "leads" USING btree ("next_follow_up_at");--> statement-breakpoint
CREATE INDEX "leads_product_idx" ON "leads" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "leads_user_idx" ON "leads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "leads_created_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "queries_user_idx" ON "queries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "queries_status_updated_idx" ON "queries" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "queries_assigned_to_idx" ON "queries" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "queries_order_idx" ON "queries" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "queries_product_idx" ON "queries" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "queries_conversation_idx" ON "queries" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "query_messages_query_created_idx" ON "query_messages" USING btree ("query_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_created_idx" ON "chat_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_usage_daily_day_idx" ON "chat_usage_daily" USING btree ("day");--> statement-breakpoint
CREATE INDEX "conversations_user_started_idx" ON "conversations" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "conversations_purge_after_idx" ON "conversations" USING btree ("purge_after");--> statement-breakpoint
CREATE INDEX "conversations_prompt_version_idx" ON "conversations" USING btree ("prompt_version_id");--> statement-breakpoint
CREATE INDEX "conversations_escalated_query_idx" ON "conversations" USING btree ("escalated_query_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_search_idx" ON "knowledge_chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_source_idx" ON "knowledge_chunks" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_versions_name_version_uq" ON "prompt_versions" USING btree ("name","version");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_versions_single_active_uq" ON "prompt_versions" USING btree ("is_active") WHERE is_active;--> statement-breakpoint
CREATE INDEX "email_outbox_status_priority_created_idx" ON "email_outbox" USING btree ("status","priority","created_at");--> statement-breakpoint
CREATE INDEX "email_outbox_sent_at_idx" ON "email_outbox" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_created_idx" ON "notifications" USING btree ("user_id","read_at","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "analytics_events_name_created_idx" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_user_idx" ON "analytics_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "analytics_events_product_idx" ON "analytics_events" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "analytics_events_order_idx" ON "analytics_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "files_upload_intents_user_idx" ON "files_upload_intents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "files_upload_intents_expires_idx" ON "files_upload_intents" USING btree ("consumed","expires_at");--> statement-breakpoint
CREATE INDEX "job_runs_job_started_idx" ON "job_runs" USING btree ("job","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expires_idx" ON "rate_limit_buckets" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_uq" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_received_idx" ON "webhook_events" USING btree ("received_at");
--> statement-breakpoint
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
--> statement-breakpoint
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

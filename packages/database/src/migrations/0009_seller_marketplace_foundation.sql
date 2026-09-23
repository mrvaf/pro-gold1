-- V-GOLD Migration: 0009_seller_marketplace_foundation.sql
-- Stage 7: Seller Marketplace Foundation (Seller Profiles, Public Presence, and Decoupled Listings)
-- Authoritative, idempotent, reviewable PostgreSQL DDL

-- 1. Create seller_profiles table
CREATE TABLE IF NOT EXISTS "seller_profiles" (
  "id" varchar(128) PRIMARY KEY,
  "tenant_id" varchar(64) NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "store_id" varchar(64),
  "display_name" varchar(255) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "bio" text,
  "logo_url" text,
  "banner_url" text,
  "is_publicly_visible" boolean NOT NULL DEFAULT TRUE,
  "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
  "business_registration_number" varchar(100),
  "tax_id" varchar(100),
  "contact_email" varchar(255),
  "contact_phone" varchar(50),
  "metadata_json" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "created_by_actor_type" varchar(32) NOT NULL DEFAULT 'SYSTEM',
  "created_by_actor_id" varchar(128) NOT NULL DEFAULT 'system',
  "updated_by_actor_type" varchar(32) NOT NULL DEFAULT 'SYSTEM',
  "updated_by_actor_id" varchar(128) NOT NULL DEFAULT 'system',
  CONSTRAINT "seller_profiles_id_tenant_id_uniq" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "seller_profiles_slug_uniq" UNIQUE ("slug")
);

-- Store/Tenant composite foreign key on seller_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_seller_profiles_store_tenant'
  ) THEN
    ALTER TABLE "seller_profiles"
      ADD CONSTRAINT "fk_seller_profiles_store_tenant"
      FOREIGN KEY ("store_id", "tenant_id")
      REFERENCES "stores"("id", "tenant_id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "seller_profiles_tenant_status_idx"
  ON "seller_profiles" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "seller_profiles_store_idx"
  ON "seller_profiles" ("store_id");

-- 2. Create seller_listings table
CREATE TABLE IF NOT EXISTS "seller_listings" (
  "id" varchar(128) PRIMARY KEY,
  "tenant_id" varchar(64) NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "seller_profile_id" varchar(128) NOT NULL,
  "product_id" varchar(64) NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "product_variant_id" varchar(64) NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "slug" varchar(150) NOT NULL,
  "description" text,
  "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
  "visibility" varchar(32) NOT NULL DEFAULT 'PUBLIC',
  "tags_json" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "created_by_actor_type" varchar(32) NOT NULL DEFAULT 'SYSTEM',
  "created_by_actor_id" varchar(128) NOT NULL DEFAULT 'system',
  "updated_by_actor_type" varchar(32) NOT NULL DEFAULT 'SYSTEM',
  "updated_by_actor_id" varchar(128) NOT NULL DEFAULT 'system',
  CONSTRAINT "seller_listings_id_tenant_id_uniq" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "seller_listings_seller_variant_uniq" UNIQUE ("seller_profile_id", "product_variant_id")
);

-- Seller/Tenant composite foreign key on seller_listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_seller_listings_seller_tenant'
  ) THEN
    ALTER TABLE "seller_listings"
      ADD CONSTRAINT "fk_seller_listings_seller_tenant"
      FOREIGN KEY ("seller_profile_id", "tenant_id")
      REFERENCES "seller_profiles"("id", "tenant_id")
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "seller_listings_tenant_status_idx"
  ON "seller_listings" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "seller_listings_seller_status_idx"
  ON "seller_listings" ("seller_profile_id", "status");

CREATE INDEX IF NOT EXISTS "seller_listings_variant_idx"
  ON "seller_listings" ("product_variant_id");

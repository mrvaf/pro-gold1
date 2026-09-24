-- V-GOLD Migration: 0010_seller_marketplace_integrity.sql
-- Stage 7 Final Integrity Hardening: Composite ownership foreign keys & partial non-archived listing index
-- Authoritative, idempotent, reviewable PostgreSQL DDL

-- 1. Ensure composite unique constraint on products (id, tenant_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_id_tenant_id_uniq'
  ) THEN
    ALTER TABLE "products" ADD CONSTRAINT "products_id_tenant_id_uniq" UNIQUE ("id", "tenant_id");
  END IF;
END $$;

-- 2. Ensure composite unique constraint on product_variants (id, product_id, tenant_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_id_product_tenant_uniq'
  ) THEN
    ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_id_product_tenant_uniq" UNIQUE ("id", "product_id", "tenant_id");
  END IF;
END $$;

-- 3. Upgrade seller_listings product reference to composite foreign key (product_id, tenant_id)
DO $$
BEGIN
  ALTER TABLE "seller_listings"
    DROP CONSTRAINT IF EXISTS "seller_listings_product_id_products_id_fk",
    DROP CONSTRAINT IF EXISTS "fk_seller_listings_product_tenant";
  
  ALTER TABLE "seller_listings"
    ADD CONSTRAINT "fk_seller_listings_product_tenant"
    FOREIGN KEY ("product_id", "tenant_id")
    REFERENCES "products"("id", "tenant_id")
    ON DELETE CASCADE;
END $$;

-- 4. Upgrade seller_listings variant reference to composite foreign key (product_variant_id, product_id, tenant_id)
DO $$
BEGIN
  ALTER TABLE "seller_listings"
    DROP CONSTRAINT IF EXISTS "seller_listings_product_variant_id_product_variants_id_fk",
    DROP CONSTRAINT IF EXISTS "fk_seller_listings_variant_product_tenant";
  
  ALTER TABLE "seller_listings"
    ADD CONSTRAINT "fk_seller_listings_variant_product_tenant"
    FOREIGN KEY ("product_variant_id", "product_id", "tenant_id")
    REFERENCES "product_variants"("id", "product_id", "tenant_id")
    ON DELETE CASCADE;
END $$;

-- 5. Replace full unique constraint with partial unique index on non-archived listings
DO $$
BEGIN
  ALTER TABLE "seller_listings"
    DROP CONSTRAINT IF EXISTS "seller_listings_seller_variant_uniq";
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "seller_listings_seller_variant_non_archived_uniq"
  ON "seller_listings" ("seller_profile_id", "product_variant_id")
  WHERE "status" != 'ARCHIVED';

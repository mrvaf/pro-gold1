-- V-GOLD Migration: 0007_catalog_inventory_foundation.sql
-- Stage 6: Catalog & Inventory Foundations
-- Authoritative, idempotent, reviewable PostgreSQL DDL

-- 1. Catalog Products Table
CREATE TABLE IF NOT EXISTS "products" (
  "id" VARCHAR(64) PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "store_id" VARCHAR(64),
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "product_type" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "created_by_actor_id" VARCHAR(64),
  "updated_by_actor_id" VARCHAR(64),
  CONSTRAINT "fk_products_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_products_store" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "products_tenant_status_idx" ON "products" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "products_store_idx" ON "products" ("store_id");

-- 2. Catalog Product Variants Table
CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" VARCHAR(64) PRIMARY KEY,
  "product_id" VARCHAR(64) NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "sku" VARCHAR(64) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  "pricing_rule_id" VARCHAR(64),
  "jewelry_type" VARCHAR(64) NOT NULL,
  "metal_type" VARCHAR(32) NOT NULL DEFAULT 'GOLD',
  "gold_purity_fineness" NUMERIC(6, 4) NOT NULL,
  "gold_purity_karat" NUMERIC(6, 4) NOT NULL,
  "gold_weight_grams" NUMERIC(16, 6) NOT NULL,
  "gross_weight_grams" NUMERIC(16, 6) NOT NULL,
  "gemstones_json" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "created_by_actor_id" VARCHAR(64),
  "updated_by_actor_id" VARCHAR(64),
  CONSTRAINT "fk_product_variants_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_product_variants_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_product_variants_pricing_rule" FOREIGN KEY ("pricing_rule_id") REFERENCES "pricing_rules"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_tenant_sku_uniq" ON "product_variants" ("tenant_id", "sku");
CREATE INDEX IF NOT EXISTS "product_variants_product_id_idx" ON "product_variants" ("product_id");

-- 3. Inventory Locations Table
CREATE TABLE IF NOT EXISTS "inventory_locations" (
  "id" VARCHAR(64) PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "store_id" VARCHAR(64),
  "name" VARCHAR(255) NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_inventory_locations_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_inventory_locations_store" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_locations_tenant_code_uniq" ON "inventory_locations" ("tenant_id", "code");

-- 4. Inventory Items Table (Discrete Physical Pieces)
CREATE TABLE IF NOT EXISTS "inventory_items" (
  "id" VARCHAR(64) PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "store_id" VARCHAR(64),
  "product_variant_id" VARCHAR(64) NOT NULL,
  "sku" VARCHAR(64) NOT NULL,
  "serial_number" VARCHAR(128),
  "barcode" VARCHAR(128),
  "location_id" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
  "quantity" NUMERIC(16, 4) NOT NULL DEFAULT 1.0000,
  "gross_weight_grams" NUMERIC(16, 6) NOT NULL,
  "gold_weight_grams" NUMERIC(16, 6) NOT NULL,
  "purity_fineness" NUMERIC(6, 4) NOT NULL,
  "purity_karat" NUMERIC(6, 4) NOT NULL,
  "passport_ref" VARCHAR(128),
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "created_by_actor_id" VARCHAR(64),
  "updated_by_actor_id" VARCHAR(64),
  CONSTRAINT "fk_inventory_items_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_inventory_items_store" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL,
  CONSTRAINT "fk_inventory_items_variant" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_inventory_items_location" FOREIGN KEY ("location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "inventory_items_tenant_status_idx" ON "inventory_items" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "inventory_items_variant_idx" ON "inventory_items" ("product_variant_id");
CREATE INDEX IF NOT EXISTS "inventory_items_location_idx" ON "inventory_items" ("location_id");
CREATE INDEX IF NOT EXISTS "inventory_items_serial_idx" ON "inventory_items" ("tenant_id", "serial_number");

-- 5. Inventory Movements Table (Append-Only Audit Log)
CREATE TABLE IF NOT EXISTS "inventory_movements" (
  "id" VARCHAR(64) PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "inventory_item_id" VARCHAR(64) NOT NULL,
  "movement_type" VARCHAR(32) NOT NULL,
  "from_location_id" VARCHAR(64),
  "to_location_id" VARCHAR(64),
  "from_status" VARCHAR(32) NOT NULL,
  "to_status" VARCHAR(32) NOT NULL,
  "quantity" NUMERIC(16, 4) NOT NULL,
  "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "actor_id" VARCHAR(64) NOT NULL,
  "actor_type" VARCHAR(32) NOT NULL,
  "reference" VARCHAR(255),
  "notes" TEXT,
  CONSTRAINT "fk_inventory_movements_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_inventory_movements_item" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_inventory_movements_from_loc" FOREIGN KEY ("from_location_id") REFERENCES "inventory_locations"("id") ON DELETE SET NULL,
  CONSTRAINT "fk_inventory_movements_to_loc" FOREIGN KEY ("to_location_id") REFERENCES "inventory_locations"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "inventory_movements_item_idx" ON "inventory_movements" ("inventory_item_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "inventory_movements_tenant_idx" ON "inventory_movements" ("tenant_id", "occurred_at");

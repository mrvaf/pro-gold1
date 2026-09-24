-- V-GOLD Migration: 0008_catalog_inventory_integrity.sql
-- Stage 6 Critical Corrections: Database-level Store/Tenant composite foreign keys & partial unique serial index
-- Authoritative, idempotent, reviewable PostgreSQL DDL

-- 1. Ensure composite unique constraint on stores (id, tenant_id) to enable composite FK referencing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_id_tenant_id_uniq'
  ) THEN
    ALTER TABLE "stores" ADD CONSTRAINT "stores_id_tenant_id_uniq" UNIQUE ("id", "tenant_id");
  END IF;
END $$;

-- 2. Upgrade products store reference to composite foreign key (store_id, tenant_id)
ALTER TABLE "products"
  DROP CONSTRAINT IF EXISTS "fk_products_store",
  DROP CONSTRAINT IF EXISTS "fk_products_store_tenant",
  ADD CONSTRAINT "fk_products_store_tenant"
    FOREIGN KEY ("store_id", "tenant_id")
    REFERENCES "stores"("id", "tenant_id")
    ON DELETE SET NULL;

-- 3. Upgrade inventory_locations store reference to composite foreign key (store_id, tenant_id)
ALTER TABLE "inventory_locations"
  DROP CONSTRAINT IF EXISTS "fk_inventory_locations_store",
  DROP CONSTRAINT IF EXISTS "fk_inventory_locations_store_tenant",
  ADD CONSTRAINT "fk_inventory_locations_store_tenant"
    FOREIGN KEY ("store_id", "tenant_id")
    REFERENCES "stores"("id", "tenant_id")
    ON DELETE SET NULL;

-- 4. Upgrade inventory_items store reference to composite foreign key (store_id, tenant_id)
ALTER TABLE "inventory_items"
  DROP CONSTRAINT IF EXISTS "fk_inventory_items_store",
  DROP CONSTRAINT IF EXISTS "fk_inventory_items_store_tenant",
  ADD CONSTRAINT "fk_inventory_items_store_tenant"
    FOREIGN KEY ("store_id", "tenant_id")
    REFERENCES "stores"("id", "tenant_id")
    ON DELETE SET NULL;

-- 5. Upgrade serial_number index to partial UNIQUE index (unique per tenant when serial is not null)
DROP INDEX IF EXISTS "inventory_items_serial_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_tenant_serial_uniq"
  ON "inventory_items" ("tenant_id", "serial_number")
  WHERE "serial_number" IS NOT NULL;

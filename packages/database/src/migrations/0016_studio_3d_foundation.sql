-- V-GOLD Migration: 0016_studio_3d_foundation.sql
-- Stage 13: 3D Jewelry Studio (3D Asset Metadata, PBR Materials, and Row-Level Security)
-- Authoritative, idempotent PostgreSQL DDL

-- 1. Create studio_3d_assets table
CREATE TABLE IF NOT EXISTS "studio_3d_assets" (
  "id" varchar(128) PRIMARY KEY,
  "tenant_id" varchar(64) NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "product_id" varchar(128) NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "variant_id" varchar(128) REFERENCES "product_variants"("id") ON DELETE CASCADE,
  "format" varchar(16) NOT NULL,
  "mime_type" varchar(64) NOT NULL,
  "file_size_bytes" integer NOT NULL,
  "storage_key" text NOT NULL,
  "bounding_box_json" text NOT NULL,
  "material_json" text NOT NULL,
  "lod_levels" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT "studio_3d_assets_id_tenant_id_uniq" UNIQUE ("id", "tenant_id")
);

CREATE INDEX IF NOT EXISTS "studio_3d_assets_tenant_idx"
  ON "studio_3d_assets" ("tenant_id");

CREATE INDEX IF NOT EXISTS "studio_3d_assets_product_idx"
  ON "studio_3d_assets" ("product_id");

-- 2. Enable + force Row Level Security with conditional tenant policy
ALTER TABLE studio_3d_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_3d_assets FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'studio_3d_assets' AND policyname = 'studio_3d_assets_tenant_isolation'
  ) THEN
    CREATE POLICY studio_3d_assets_tenant_isolation ON studio_3d_assets
      USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
      WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());
  END IF;
END $$;

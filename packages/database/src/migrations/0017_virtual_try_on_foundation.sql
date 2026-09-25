-- V-GOLD Migration: 0017_virtual_try_on_foundation.sql
-- Stage 14: Virtual Try-On Infrastructure (Biometric Anchoring, Privacy-Compliant Sessions, and Row-Level Security)
-- Authoritative, idempotent PostgreSQL DDL

-- 1. Create try_on_sessions table
CREATE TABLE IF NOT EXISTS "try_on_sessions" (
  "id" varchar(128) PRIMARY KEY,
  "tenant_id" varchar(64) NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "product_id" varchar(128) NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "variant_id" varchar(128) REFERENCES "product_variants"("id") ON DELETE CASCADE,
  "asset_3d_id" varchar(128) NOT NULL REFERENCES "studio_3d_assets"("id") ON DELETE CASCADE,
  "anchoring_json" text NOT NULL,
  "status" varchar(32) NOT NULL,
  "signed_asset_url" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT "try_on_sessions_id_tenant_id_uniq" UNIQUE ("id", "tenant_id")
);

CREATE INDEX IF NOT EXISTS "try_on_sessions_tenant_idx"
  ON "try_on_sessions" ("tenant_id");

CREATE INDEX IF NOT EXISTS "try_on_sessions_product_idx"
  ON "try_on_sessions" ("product_id");

CREATE INDEX IF NOT EXISTS "try_on_sessions_expires_idx"
  ON "try_on_sessions" ("expires_at");

-- 2. Enable + force Row Level Security with conditional tenant policy
ALTER TABLE try_on_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE try_on_sessions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'try_on_sessions' AND policyname = 'try_on_sessions_tenant_isolation'
  ) THEN
    CREATE POLICY try_on_sessions_tenant_isolation ON try_on_sessions
      USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
      WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());
  END IF;
END $$;

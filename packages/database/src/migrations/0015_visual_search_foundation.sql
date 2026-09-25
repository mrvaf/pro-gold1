-- V-GOLD Migration: 0015_visual_search_foundation.sql
-- Stage 11: Visual Search Engine (Product Feature Embeddings & Vector Indexing)
-- Authoritative, idempotent, reviewable PostgreSQL DDL

-- 1. Create product_feature_embeddings table
CREATE TABLE IF NOT EXISTS "product_feature_embeddings" (
  "id" varchar(128) PRIMARY KEY,
  "tenant_id" varchar(64) NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "product_id" varchar(128) NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "variant_id" varchar(128) REFERENCES "product_variants"("id") ON DELETE CASCADE,
  "feature_dimensions" integer NOT NULL,
  "embedding_json" text NOT NULL,
  "metadata_json" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT "product_feature_embeddings_id_tenant_id_uniq" UNIQUE ("id", "tenant_id")
);

CREATE INDEX IF NOT EXISTS "product_feature_embeddings_tenant_idx"
  ON "product_feature_embeddings" ("tenant_id");

CREATE INDEX IF NOT EXISTS "product_feature_embeddings_product_idx"
  ON "product_feature_embeddings" ("product_id");

-- 2. Enable + force Row Level Security with conditional tenant policy
ALTER TABLE product_feature_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_feature_embeddings FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_feature_embeddings' AND policyname = 'product_feature_embeddings_tenant_isolation'
  ) THEN
    CREATE POLICY product_feature_embeddings_tenant_isolation ON product_feature_embeddings
      USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
      WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());
  END IF;
END $$;

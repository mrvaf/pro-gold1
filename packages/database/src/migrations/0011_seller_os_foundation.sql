-- V-GOLD Migration: 0011_seller_os_foundation.sql
-- Stage 8: Seller OS Foundation (Operational Workspaces, Staff Roles & Store/Seller Integrity)
-- Authoritative, idempotent, reviewable PostgreSQL DDL

-- 1. Create seller_workspaces table
CREATE TABLE IF NOT EXISTS "seller_workspaces" (
  "id" varchar(128) PRIMARY KEY,
  "tenant_id" varchar(64) NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "seller_profile_id" varchar(128) NOT NULL,
  "store_id" varchar(64),
  "name" varchar(255) NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'ACTIVE',
  "settings_json" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "created_by_actor_type" varchar(32) NOT NULL DEFAULT 'SYSTEM',
  "created_by_actor_id" varchar(128) NOT NULL DEFAULT 'system',
  "updated_by_actor_type" varchar(32) NOT NULL DEFAULT 'SYSTEM',
  "updated_by_actor_id" varchar(128) NOT NULL DEFAULT 'system',
  CONSTRAINT "seller_workspaces_id_tenant_id_uniq" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "seller_workspaces_seller_uniq" UNIQUE ("seller_profile_id")
);

-- 2. Enforce composite foreign keys ensuring multi-tenant consistency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_seller_workspaces_seller_tenant'
  ) THEN
    ALTER TABLE "seller_workspaces"
      ADD CONSTRAINT "fk_seller_workspaces_seller_tenant"
      FOREIGN KEY ("seller_profile_id", "tenant_id")
      REFERENCES "seller_profiles"("id", "tenant_id")
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_seller_workspaces_store_tenant'
  ) THEN
    -- Invariant: Deleting a store sets ONLY store_id to NULL.
    -- tenant_id remains NOT NULL and unchanged; workspace remains tenant-owned.
    ALTER TABLE "seller_workspaces"
      ADD CONSTRAINT "fk_seller_workspaces_store_tenant"
      FOREIGN KEY ("store_id", "tenant_id")
      REFERENCES "stores"("id", "tenant_id")
      ON DELETE SET NULL ("store_id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "seller_workspaces_tenant_status_idx"
  ON "seller_workspaces" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "seller_workspaces_store_idx"
  ON "seller_workspaces" ("store_id");

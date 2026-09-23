-- V-GOLD Migration: 0001_core_foundation.sql
-- Stage 2: Foundational Tenancy & Store Infrastructure
-- Authoritative, idempotent, reviewable PostgreSQL DDL

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" VARCHAR(64) PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "slug" VARCHAR(128) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "tenants_slug_unique" UNIQUE ("slug")
);

CREATE TABLE IF NOT EXISTS "stores" (
  "id" VARCHAR(64) PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_stores_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "stores_tenant_id_code_idx" ON "stores" ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "stores_tenant_id_idx" ON "stores" ("tenant_id");

-- V-GOLD Migration: 0002_iam_foundation.sql
-- Stage 3: IAM, Users, Tenant Memberships, and Server Sessions
-- Authoritative, idempotent, reviewable PostgreSQL DDL

CREATE TABLE IF NOT EXISTS "users" (
  "id" VARCHAR(64) PRIMARY KEY,
  "email" VARCHAR(255) NOT NULL,
  "display_name" VARCHAR(255) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "users_email_unique" UNIQUE ("email")
);

CREATE TABLE IF NOT EXISTS "tenant_memberships" (
  "id" VARCHAR(64) PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "user_id" VARCHAR(64) NOT NULL,
  "role" VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
  "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_memberships_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_memberships_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_memberships_user_tenant_idx" ON "tenant_memberships" ("user_id", "tenant_id");
CREATE INDEX IF NOT EXISTS "tenant_memberships_tenant_id_idx" ON "tenant_memberships" ("tenant_id");
CREATE INDEX IF NOT EXISTS "tenant_memberships_user_id_idx" ON "tenant_memberships" ("user_id");

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" VARCHAR(128) PRIMARY KEY,
  "user_id" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "revoked_at" TIMESTAMP WITH TIME ZONE,
  "last_activity_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "user_agent" VARCHAR(255),
  "ip_address" VARCHAR(64),
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" ("expires_at");

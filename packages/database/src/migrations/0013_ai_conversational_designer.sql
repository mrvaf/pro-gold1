-- V-GOLD Migration: 0013_ai_conversational_designer.sql
-- Stage 9: AI Conversational Designer (DesignSession aggregate, multi-tenant persistence & RLS)
-- Authoritative, idempotent, reviewable PostgreSQL DDL

-- 1. Create design_sessions table
CREATE TABLE IF NOT EXISTS "design_sessions" (
  "id" varchar(128) PRIMARY KEY,
  "tenant_id" varchar(64) NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" varchar(128) REFERENCES "users"("id") ON DELETE SET NULL,
  "title" varchar(255) NOT NULL DEFAULT 'New Jewelry Design',
  "status" varchar(32) NOT NULL DEFAULT 'ACTIVE',
  "messages_json" text NOT NULL DEFAULT '[]',
  "extracted_attributes_json" text NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "created_by_actor_type" varchar(32) NOT NULL DEFAULT 'SYSTEM',
  "created_by_actor_id" varchar(128) NOT NULL DEFAULT 'system',
  "updated_by_actor_type" varchar(32) NOT NULL DEFAULT 'SYSTEM',
  "updated_by_actor_id" varchar(128) NOT NULL DEFAULT 'system',
  CONSTRAINT "design_sessions_id_tenant_id_uniq" UNIQUE ("id", "tenant_id")
);

CREATE INDEX IF NOT EXISTS "design_sessions_tenant_status_idx"
  ON "design_sessions" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "design_sessions_user_idx"
  ON "design_sessions" ("user_id");

CREATE INDEX IF NOT EXISTS "design_sessions_tenant_updated_idx"
  ON "design_sessions" ("tenant_id", "updated_at");

-- 2. Enable + force Row Level Security with conditional tenant policy
ALTER TABLE design_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_sessions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'design_sessions' AND policyname = 'design_sessions_tenant_isolation'
  ) THEN
    CREATE POLICY design_sessions_tenant_isolation ON design_sessions
      USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
      WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());
  END IF;
END $$;

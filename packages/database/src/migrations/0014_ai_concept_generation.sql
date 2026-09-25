-- V-GOLD Migration: 0014_ai_concept_generation.sql
-- Stage 10: AI Concept Generation (DesignConcept aggregate, idempotency & grounded specs)
-- Authoritative, idempotent, reviewable PostgreSQL DDL

-- 1. Create design_concepts table
CREATE TABLE IF NOT EXISTS "design_concepts" (
  "id" varchar(128) PRIMARY KEY,
  "session_id" varchar(128) NOT NULL REFERENCES "design_sessions"("id") ON DELETE CASCADE,
  "tenant_id" varchar(64) NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "idempotency_key" varchar(128) NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "prompt_refinement" text NOT NULL DEFAULT '',
  "visual_prompt" text NOT NULL DEFAULT '',
  "grounded_attributes_json" text NOT NULL DEFAULT '{}',
  "token_accounting_json" text NOT NULL DEFAULT '{}',
  "status" varchar(32) NOT NULL DEFAULT 'GENERATED',
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "created_by_actor_type" varchar(32) NOT NULL DEFAULT 'SYSTEM',
  "created_by_actor_id" varchar(128) NOT NULL DEFAULT 'system',
  "updated_by_actor_type" varchar(32) NOT NULL DEFAULT 'SYSTEM',
  "updated_by_actor_id" varchar(128) NOT NULL DEFAULT 'system',
  CONSTRAINT "design_concepts_id_tenant_id_uniq" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "design_concepts_idempotency_uniq" UNIQUE ("tenant_id", "session_id", "idempotency_key")
);

CREATE INDEX IF NOT EXISTS "design_concepts_session_idx"
  ON "design_concepts" ("session_id");

CREATE INDEX IF NOT EXISTS "design_concepts_tenant_status_idx"
  ON "design_concepts" ("tenant_id", "status");

-- 2. Enable + force Row Level Security with conditional tenant policy
ALTER TABLE design_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_concepts FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'design_concepts' AND policyname = 'design_concepts_tenant_isolation'
  ) THEN
    CREATE POLICY design_concepts_tenant_isolation ON design_concepts
      USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
      WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());
  END IF;
END $$;

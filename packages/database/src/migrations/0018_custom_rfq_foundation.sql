-- V-GOLD Migration: 0018_custom_rfq_foundation.sql
-- Stage 15: Custom Manufacturing & RFQ Workflows (Multi-Party Milestone Proposals, In-Band Messaging, and Row-Level Security)
-- Authoritative, idempotent PostgreSQL DDL

-- 1. Create custom_manufacturing_rfqs table
CREATE TABLE IF NOT EXISTS "custom_manufacturing_rfqs" (
  "id" varchar(128) PRIMARY KEY,
  "tenant_id" varchar(64) NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "customer_id" varchar(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "seller_id" varchar(64) REFERENCES "users"("id") ON DELETE SET NULL,
  "assigned_goldsmith_id" varchar(64) REFERENCES "users"("id") ON DELETE SET NULL,
  "accepted_proposal_id" varchar(128),
  "status" varchar(32) NOT NULL,
  "specification_json" text NOT NULL,
  "proposals_json" text NOT NULL DEFAULT '[]',
  "messages_json" text NOT NULL DEFAULT '[]',
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT "custom_manufacturing_rfqs_id_tenant_id_uniq" UNIQUE ("id", "tenant_id")
);

CREATE INDEX IF NOT EXISTS "custom_rfqs_tenant_idx"
  ON "custom_manufacturing_rfqs" ("tenant_id");

CREATE INDEX IF NOT EXISTS "custom_rfqs_customer_idx"
  ON "custom_manufacturing_rfqs" ("customer_id");

CREATE INDEX IF NOT EXISTS "custom_rfqs_status_idx"
  ON "custom_manufacturing_rfqs" ("status");

-- 2. Enable + force Row Level Security with conditional tenant policy
ALTER TABLE custom_manufacturing_rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_manufacturing_rfqs FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'custom_manufacturing_rfqs' AND policyname = 'custom_manufacturing_rfqs_tenant_isolation'
  ) THEN
    CREATE POLICY custom_manufacturing_rfqs_tenant_isolation ON custom_manufacturing_rfqs
      USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
      WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());
  END IF;
END $$;

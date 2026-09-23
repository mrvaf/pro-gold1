-- V-GOLD Migration: 0006_pricing_rule_audit_metadata.sql
-- Stage 5 Final Audit: Explicit audit metadata, reference sample segregation, and source tracking
-- Authoritative, idempotent, reviewable PostgreSQL DDL

ALTER TABLE "pricing_rules" 
  ADD COLUMN IF NOT EXISTS "is_reference_sample" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "specification_source" VARCHAR(255);

ALTER TABLE "pricing_results"
  ADD COLUMN IF NOT EXISTS "rule_reference_json" TEXT;

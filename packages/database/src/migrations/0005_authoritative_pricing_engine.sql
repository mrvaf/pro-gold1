-- V-GOLD Migration: 0005_authoritative_pricing_engine.sql
-- Stage 5: Authoritative Pricing Engine Foundation
-- Authoritative, idempotent, reviewable PostgreSQL DDL

CREATE TABLE IF NOT EXISTS "pricing_rules" (
  "id" VARCHAR(64) PRIMARY KEY,
  "name" VARCHAR(128) NOT NULL,
  "version" VARCHAR(32) NOT NULL DEFAULT '1',
  "tenant_id" VARCHAR(64),
  "store_id" VARCHAR(64),
  "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL,
  "effective_to" TIMESTAMP WITH TIME ZONE,
  "making_charge_type" VARCHAR(32) NOT NULL,
  "making_charge_rate" NUMERIC(24, 8) NOT NULL,
  "margin_type" VARCHAR(32) NOT NULL,
  "margin_rate" NUMERIC(24, 8) NOT NULL,
  "taxable_base" VARCHAR(32) NOT NULL,
  "tax_rate" NUMERIC(24, 8) NOT NULL,
  "rounding_mode" VARCHAR(32) NOT NULL,
  "rounding_scale" INTEGER,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS "pricing_rules_tenant_effective_idx"
  ON "pricing_rules" ("tenant_id", "effective_from");

CREATE INDEX IF NOT EXISTS "pricing_rules_id_ver_idx"
  ON "pricing_rules" ("id", "version");

CREATE TABLE IF NOT EXISTS "pricing_results" (
  "id" VARCHAR(64) PRIMARY KEY,
  "tenant_id" VARCHAR(64),
  "store_id" VARCHAR(64),
  "final_amount" NUMERIC(24, 4) NOT NULL,
  "currency" VARCHAR(8) NOT NULL,
  "rule_id" VARCHAR(64) NOT NULL,
  "rule_name" VARCHAR(128) NOT NULL,
  "rule_version" VARCHAR(32) NOT NULL,
  "market_observation_id" VARCHAR(64) NOT NULL,
  "instrument_symbol" VARCHAR(64) NOT NULL,
  "market_price" NUMERIC(24, 8) NOT NULL,
  "market_unit" VARCHAR(32) NOT NULL,
  "market_currency" VARCHAR(8) NOT NULL,
  "market_observed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "freshness_status" VARCHAR(16) NOT NULL,
  "is_stale_market_data" VARCHAR(8) NOT NULL DEFAULT 'false',
  "weight_grams" NUMERIC(16, 6) NOT NULL,
  "purity_fineness" NUMERIC(6, 4) NOT NULL,
  "breakdown_json" TEXT NOT NULL,
  "inputs_json" TEXT NOT NULL,
  "rounding_mode" VARCHAR(32) NOT NULL,
  "rounding_scale" INTEGER NOT NULL,
  "calculated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "pricing_results_tenant_calc_idx"
  ON "pricing_results" ("tenant_id", "calculated_at" DESC);

CREATE INDEX IF NOT EXISTS "pricing_results_obs_idx"
  ON "pricing_results" ("market_observation_id");

-- V-GOLD Migration: 0004_financial_precision_currency_semantics.sql
-- Stage 4.1: Financial Precision, Foreign Exchange (FX) Rates, and Currency Semantics
-- Authoritative, idempotent, reviewable PostgreSQL DDL

CREATE TABLE IF NOT EXISTS "fx_rates" (
  "id" VARCHAR(64) PRIMARY KEY,
  "base_currency" VARCHAR(8) NOT NULL,
  "quote_currency" VARCHAR(8) NOT NULL,
  "rate" NUMERIC(24, 8) NOT NULL,
  "observed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "source" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Unique idempotency constraint on currency pair, observation timestamp, and source
CREATE UNIQUE INDEX IF NOT EXISTS "fx_rates_idempotency_idx" 
  ON "fx_rates" ("base_currency", "quote_currency", "observed_at", "source");

-- Query index for latest rates and historical time ranges
CREATE INDEX IF NOT EXISTS "fx_rates_pair_observed_idx" 
  ON "fx_rates" ("base_currency", "quote_currency", "observed_at" DESC);

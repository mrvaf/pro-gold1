-- V-GOLD Migration: 0003_market_data_foundation.sql
-- Stage 4: Market Data Infrastructure, Sources, Instruments, and Immutable Historical Observations
-- Authoritative, idempotent, reviewable PostgreSQL DDL

CREATE TABLE IF NOT EXISTS "market_data_sources" (
  "id" VARCHAR(64) PRIMARY KEY,
  "name" VARCHAR(128) NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "description" VARCHAR(255),
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "market_data_sources_code_unique" UNIQUE ("code")
);

CREATE TABLE IF NOT EXISTS "market_instruments" (
  "id" VARCHAR(64) PRIMARY KEY,
  "symbol" VARCHAR(32) NOT NULL,
  "base_asset" VARCHAR(16) NOT NULL,
  "quote_currency" VARCHAR(8) NOT NULL,
  "unit" VARCHAR(32) NOT NULL,
  "display_name" VARCHAR(128) NOT NULL,
  "asset_type" VARCHAR(32) NOT NULL DEFAULT 'PRECIOUS_METAL',
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "market_instruments_symbol_unique" UNIQUE ("symbol")
);

CREATE TABLE IF NOT EXISTS "market_observations" (
  "id" VARCHAR(64) PRIMARY KEY,
  "instrument_id" VARCHAR(64) NOT NULL,
  "source_id" VARCHAR(64) NOT NULL,
  "amount" NUMERIC(24, 8) NOT NULL,
  "bid" NUMERIC(24, 8),
  "ask" NUMERIC(24, 8),
  "currency" VARCHAR(8) NOT NULL,
  "unit" VARCHAR(32) NOT NULL,
  "quality" VARCHAR(32) NOT NULL,
  "observed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "ingested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "external_id" VARCHAR(128),
  "metadata" JSONB,
  CONSTRAINT "fk_market_observations_instrument" FOREIGN KEY ("instrument_id") REFERENCES "market_instruments"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_market_observations_source" FOREIGN KEY ("source_id") REFERENCES "market_data_sources"("id") ON DELETE RESTRICT
);

-- Unique idempotency index: prevents duplicate ingestion of identical external observations
CREATE UNIQUE INDEX IF NOT EXISTS "market_observations_idempotency_idx" 
  ON "market_observations" ("source_id", "instrument_id", "observed_at");

-- Performance indexes for latest observation queries and time-range history
CREATE INDEX IF NOT EXISTS "market_observations_instrument_observed_idx" 
  ON "market_observations" ("instrument_id", "observed_at" DESC);

CREATE INDEX IF NOT EXISTS "market_observations_source_observed_idx" 
  ON "market_observations" ("source_id", "observed_at" DESC);

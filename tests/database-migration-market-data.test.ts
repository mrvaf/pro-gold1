import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Market Data Database Migration (0003_market_data_foundation.sql)', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../packages/database/src/migrations/0003_market_data_foundation.sql'
  );

  it('ensures migration 0003 exists and contains valid DDL for market data', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "market_data_sources"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "market_instruments"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "market_observations"');
  });

  it('verifies precision, foreign keys, and idempotency indexes in DDL', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Decimal precision: NUMERIC(24, 8)
    expect(sql).toContain('NUMERIC(24, 8)');

    // Immutable history: Foreign keys restrict deletion of active instruments or sources
    expect(sql).toContain('ON DELETE RESTRICT');

    // Idempotency constraint on source_id, instrument_id, observed_at
    expect(sql).toContain('market_observations_idempotency_idx');
    expect(sql).toContain('"source_id", "instrument_id", "observed_at"');

    // Chronological index
    expect(sql).toContain('"observed_at" DESC');
  });
});

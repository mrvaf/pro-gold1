import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Financial Semantics Database Migration (0004_financial_precision_currency_semantics.sql)', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../packages/database/src/migrations/0004_financial_precision_currency_semantics.sql'
  );

  it('ensures migration 0004 exists and contains valid DDL for FX rates', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "fx_rates"');
    expect(sql).toContain('"base_currency" VARCHAR(8) NOT NULL');
    expect(sql).toContain('"quote_currency" VARCHAR(8) NOT NULL');
  });

  it('verifies numeric precision and idempotency constraints in DDL', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Decimal precision: NUMERIC(24, 8)
    expect(sql).toContain('NUMERIC(24, 8)');

    // Idempotency index
    expect(sql).toContain('fx_rates_idempotency_idx');
    expect(sql).toContain('"base_currency", "quote_currency", "observed_at", "source"');

    // Chronological query index
    expect(sql).toContain('fx_rates_pair_observed_idx');
    expect(sql).toContain('"observed_at" DESC');
  });
});

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Pricing Engine Database Migration (0005_authoritative_pricing_engine.sql)', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../packages/database/src/migrations/0005_authoritative_pricing_engine.sql'
  );

  it('ensures migration 0005 exists and contains DDL for pricing_rules and pricing_results', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "pricing_rules"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "pricing_results"');
  });

  it('verifies numeric precision and index definitions in migration 0005', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Precision checks
    expect(sql).toContain('"final_amount" NUMERIC(24, 4)');
    expect(sql).toContain('"market_price" NUMERIC(24, 8)');
    expect(sql).toContain('"weight_grams" NUMERIC(16, 6)');
    expect(sql).toContain('"purity_fineness" NUMERIC(6, 4)');

    // Indexes
    expect(sql).toContain('pricing_rules_tenant_effective_idx');
    expect(sql).toContain('pricing_results_tenant_calc_idx');
  });

  it('ensures migration 0006 exists and adds audit metadata columns immutably', () => {
    const migration0006Path = path.resolve(
      __dirname,
      '../packages/database/src/migrations/0006_pricing_rule_audit_metadata.sql'
    );
    expect(fs.existsSync(migration0006Path)).toBe(true);
    const sql = fs.readFileSync(migration0006Path, 'utf-8');

    expect(sql).toContain('ALTER TABLE "pricing_rules"');
    expect(sql).toContain('is_reference_sample');
    expect(sql).toContain('specification_source');
    expect(sql).toContain('ALTER TABLE "pricing_results"');
    expect(sql).toContain('rule_reference_json');
  });
});

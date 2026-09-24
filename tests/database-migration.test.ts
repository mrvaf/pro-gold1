import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Database Migration: 0001_core_foundation.sql', () => {
  const rootDir = path.resolve(__dirname, '..');
  const migrationPath = path.resolve(
    rootDir,
    'packages/database/src/migrations/0001_core_foundation.sql'
  );

  it('migration file exists and is readable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const content = fs.readFileSync(migrationPath, 'utf-8');
    expect(content.length).toBeGreaterThan(50);
  });

  it('contains valid idempotent table definitions for tenants and stores', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('CREATE TABLE IF NOT EXISTS "tenants"');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS "stores"');

    // Foreign key with cascade
    expect(content).toContain('CONSTRAINT "fk_stores_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE');

    // Unique constraints and indexes
    expect(content).toContain('CONSTRAINT "tenants_slug_unique" UNIQUE ("slug")');
    expect(content).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "stores_tenant_id_code_idx" ON "stores" ("tenant_id", "code")');
    expect(content).toContain('CREATE INDEX IF NOT EXISTS "stores_tenant_id_idx" ON "stores" ("tenant_id")');

    // Timezone aware timestamps
    expect(content).toContain('TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()');
  });
});

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Database Migration: 0002_iam_foundation.sql', () => {
  const rootDir = path.resolve(__dirname, '..');
  const migrationPath = path.resolve(
    rootDir,
    'packages/database/src/migrations/0002_iam_foundation.sql'
  );

  it('migration file exists and is readable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const content = fs.readFileSync(migrationPath, 'utf-8');
    expect(content.length).toBeGreaterThan(50);
  });

  it('contains valid idempotent table definitions and constraints for IAM', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('CREATE TABLE IF NOT EXISTS "users"');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS "tenant_memberships"');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS "sessions"');

    // Foreign keys with cascade
    expect(content).toContain('CONSTRAINT "fk_memberships_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE');
    expect(content).toContain('CONSTRAINT "fk_memberships_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE');
    expect(content).toContain('CONSTRAINT "fk_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE');

    // Unique constraints and indexes
    expect(content).toContain('CONSTRAINT "users_email_unique" UNIQUE ("email")');
    expect(content).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "tenant_memberships_user_tenant_idx" ON "tenant_memberships" ("user_id", "tenant_id")');
    expect(content).toContain('CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id")');
    expect(content).toContain('CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" ("expires_at")');
  });
});

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sellerWorkspacesTable } from '@v-gold/database';

describe('Seller OS Database Schema & Migration Invariants', () => {
  it('validates sellerWorkspacesTable schema definition', () => {
    expect(sellerWorkspacesTable.id).toBeDefined();
    expect(sellerWorkspacesTable.tenantId).toBeDefined();
    expect(sellerWorkspacesTable.sellerProfileId).toBeDefined();
    expect(sellerWorkspacesTable.storeId).toBeDefined();
    expect(sellerWorkspacesTable.name).toBeDefined();
    expect(sellerWorkspacesTable.status).toBeDefined();
    expect(sellerWorkspacesTable.settingsJson).toBeDefined();
    expect(sellerWorkspacesTable.createdAt).toBeDefined();
    expect(sellerWorkspacesTable.updatedAt).toBeDefined();
    expect(sellerWorkspacesTable.createdByActorType).toBeDefined();
    expect(sellerWorkspacesTable.createdByActorId).toBeDefined();
    expect(sellerWorkspacesTable.updatedByActorType).toBeDefined();
    expect(sellerWorkspacesTable.updatedByActorId).toBeDefined();
  });

  it('verifies sequential migration 0011_seller_os_foundation.sql integrity', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../packages/database/src/migrations/0011_seller_os_foundation.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

    // 1. Table creation with NOT NULL tenantId
    expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS "seller_workspaces"');
    expect(sqlContent).toContain('"tenant_id" varchar(64) NOT NULL REFERENCES "tenants"("id")');
    expect(sqlContent).toContain('"seller_profile_id" varchar(128) NOT NULL');

    // 2. Composite unique constraint
    expect(sqlContent).toContain('CONSTRAINT "seller_workspaces_id_tenant_id_uniq" UNIQUE ("id", "tenant_id")');

    // 3. Single workspace per seller profile unique constraint
    expect(sqlContent).toContain('CONSTRAINT "seller_workspaces_seller_uniq" UNIQUE ("seller_profile_id")');

    // 4. Composite Foreign Key on (seller_profile_id, tenant_id) -> seller_profiles(id, tenant_id)
    expect(sqlContent).toContain('fk_seller_workspaces_seller_tenant');
    expect(sqlContent).toContain('FOREIGN KEY ("seller_profile_id", "tenant_id")');
    expect(sqlContent).toContain('REFERENCES "seller_profiles"("id", "tenant_id")');

    // 5. Composite Foreign Key on (store_id, tenant_id) -> stores(id, tenant_id)
    expect(sqlContent).toContain('fk_seller_workspaces_store_tenant');
    expect(sqlContent).toContain('FOREIGN KEY ("store_id", "tenant_id")');
    expect(sqlContent).toContain('REFERENCES "stores"("id", "tenant_id")');

    // 6. Performance indexes
    expect(sqlContent).toContain('CREATE INDEX IF NOT EXISTS "seller_workspaces_tenant_status_idx"');
    expect(sqlContent).toContain('CREATE INDEX IF NOT EXISTS "seller_workspaces_store_idx"');
  });
});

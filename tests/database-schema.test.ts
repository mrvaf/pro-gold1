import { describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { tenantsTable, storesTable } from '@v-gold/database';

describe('Database Schema & Table Definitions (Drizzle ORM)', () => {
  it('validates tenants table schema constraints', () => {
    const columns = getTableColumns(tenantsTable);

    // Primary key
    expect(columns.id.primary).toBe(true);
    expect(columns.id.notNull).toBe(true);

    // Columns
    expect(columns.name.notNull).toBe(true);
    expect(columns.slug.notNull).toBe(true);
    expect(columns.slug.isUnique).toBe(true);
    expect(columns.status.notNull).toBe(true);
    expect(columns.status.default).toBe('ACTIVE');

    // Timestamps
    expect(columns.createdAt.notNull).toBe(true);
    expect(columns.updatedAt.notNull).toBe(true);
  });

  it('validates stores table schema and foreign key constraints', () => {
    const columns = getTableColumns(storesTable);
    const tableConfig = getTableConfig(storesTable);

    // Primary key
    expect(columns.id.primary).toBe(true);
    expect(columns.id.notNull).toBe(true);

    // Tenant foreign key
    expect(columns.tenantId.notNull).toBe(true);
    expect(tableConfig.foreignKeys.length).toBeGreaterThan(0);

    const tenantFk = tableConfig.foreignKeys[0];
    expect(tenantFk?.onDelete).toBe('cascade');

    // Business attributes
    expect(columns.name.notNull).toBe(true);
    expect(columns.code.notNull).toBe(true);
    expect(columns.status.notNull).toBe(true);

    // Indexes
    expect(tableConfig.indexes.length).toBe(2);

    const indexNames = tableConfig.indexes.map((idx) => idx.config.name);
    expect(indexNames).toContain('stores_tenant_id_code_idx');
    expect(indexNames).toContain('stores_tenant_id_idx');

    const uniqueIndex = tableConfig.indexes.find(
      (idx) => idx.config.name === 'stores_tenant_id_code_idx'
    );
    expect(uniqueIndex?.config.unique).toBe(true);
  });
});

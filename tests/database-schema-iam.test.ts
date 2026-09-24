import { describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { usersTable, tenantMembershipsTable, sessionsTable } from '@v-gold/database';

describe('Database Schema & Constraints: IAM Tables', () => {
  it('validates users table constraints', () => {
    const columns = getTableColumns(usersTable);

    expect(columns.id.primary).toBe(true);
    expect(columns.id.notNull).toBe(true);
    expect(columns.email.notNull).toBe(true);
    expect(columns.email.isUnique).toBe(true);
    expect(columns.displayName.notNull).toBe(true);
    expect(columns.passwordHash.notNull).toBe(true);
    expect(columns.status.notNull).toBe(true);
    expect(columns.status.default).toBe('ACTIVE');
    expect(columns.createdAt.notNull).toBe(true);
    expect(columns.updatedAt.notNull).toBe(true);
  });

  it('validates tenant_memberships table foreign keys and composite unique index', () => {
    const columns = getTableColumns(tenantMembershipsTable);
    const tableConfig = getTableConfig(tenantMembershipsTable);

    expect(columns.id.primary).toBe(true);
    expect(columns.tenantId.notNull).toBe(true);
    expect(columns.userId.notNull).toBe(true);
    expect(columns.role.notNull).toBe(true);
    expect(columns.status.notNull).toBe(true);

    // Foreign keys
    expect(tableConfig.foreignKeys.length).toBe(2);
    for (const fk of tableConfig.foreignKeys) {
      expect(fk.onDelete).toBe('cascade');
    }

    // Composite unique index on (user_id, tenant_id)
    const uniqueIndex = tableConfig.indexes.find(
      (idx) => idx.config.name === 'tenant_memberships_user_tenant_idx'
    );
    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex?.config.unique).toBe(true);
  });

  it('validates sessions table foreign keys and indexes', () => {
    const columns = getTableColumns(sessionsTable);
    const tableConfig = getTableConfig(sessionsTable);

    expect(columns.id.primary).toBe(true);
    expect(columns.userId.notNull).toBe(true);
    expect(columns.expiresAt.notNull).toBe(true);
    expect(columns.lastActivityAt.notNull).toBe(true);

    // Foreign key to users with cascade
    expect(tableConfig.foreignKeys.length).toBe(1);
    expect(tableConfig.foreignKeys[0]?.onDelete).toBe('cascade');

    // Indexes on user_id and expires_at
    const indexNames = tableConfig.indexes.map((idx) => idx.config.name);
    expect(indexNames).toContain('sessions_user_id_idx');
    expect(indexNames).toContain('sessions_expires_at_idx');
  });
});

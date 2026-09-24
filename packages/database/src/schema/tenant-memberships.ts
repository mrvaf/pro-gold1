import { pgTable, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { usersTable } from './users.js';

export const tenantMembershipsTable = pgTable(
  'tenant_memberships',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull().default('MEMBER'),
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('tenant_memberships_user_tenant_idx').on(table.userId, table.tenantId),
    index('tenant_memberships_tenant_id_idx').on(table.tenantId),
    index('tenant_memberships_user_id_idx').on(table.userId),
  ]
);

export type TenantMembershipRecord = typeof tenantMembershipsTable.$inferSelect;
export type InsertTenantMembershipRecord = typeof tenantMembershipsTable.$inferInsert;

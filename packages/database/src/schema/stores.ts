import { pgTable, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';

export const storesTable = pgTable(
  'stores',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('stores_tenant_id_code_idx').on(table.tenantId, table.code),
    index('stores_tenant_id_idx').on(table.tenantId),
  ]
);

export type StoreRecord = typeof storesTable.$inferSelect;
export type InsertStoreRecord = typeof storesTable.$inferInsert;

import { pgTable, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { storesTable } from './stores.js';

export const inventoryLocationsTable = pgTable(
  'inventory_locations',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    storeId: varchar('store_id', { length: 64 }).references(() => storesTable.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('inventory_locations_tenant_code_uniq').on(table.tenantId, table.code),
  ]
);

export type InventoryLocationRecord = typeof inventoryLocationsTable.$inferSelect;
export type InsertInventoryLocationRecord = typeof inventoryLocationsTable.$inferInsert;

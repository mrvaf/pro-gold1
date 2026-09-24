import { pgTable, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { storesTable } from './stores.js';

export const productsTable = pgTable(
  'products',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    storeId: varchar('store_id', { length: 64 }).references(() => storesTable.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    productType: varchar('product_type', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('DRAFT'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdByActorId: varchar('created_by_actor_id', { length: 64 }),
    updatedByActorId: varchar('updated_by_actor_id', { length: 64 }),
  },
  (table) => [
    index('products_tenant_status_idx').on(table.tenantId, table.status),
    index('products_store_idx').on(table.storeId),
  ]
);

export type ProductRecord = typeof productsTable.$inferSelect;
export type InsertProductRecord = typeof productsTable.$inferInsert;

import { pgTable, varchar, numeric, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenantsTable } from './tenants.js';
import { storesTable } from './stores.js';
import { productVariantsTable } from './product-variants.js';
import { inventoryLocationsTable } from './inventory-locations.js';

export const inventoryItemsTable = pgTable(
  'inventory_items',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    storeId: varchar('store_id', { length: 64 }).references(() => storesTable.id, {
      onDelete: 'set null',
    }),
    productVariantId: varchar('product_variant_id', { length: 64 })
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: 'restrict' }),
    sku: varchar('sku', { length: 64 }).notNull(),
    serialNumber: varchar('serial_number', { length: 128 }),
    barcode: varchar('barcode', { length: 128 }),
    locationId: varchar('location_id', { length: 64 })
      .notNull()
      .references(() => inventoryLocationsTable.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 32 }).notNull().default('AVAILABLE'),
    quantity: numeric('quantity', { precision: 16, scale: 4 }).notNull().default('1.0000'),
    grossWeightGrams: numeric('gross_weight_grams', { precision: 16, scale: 6 }).notNull(),
    goldWeightGrams: numeric('gold_weight_grams', { precision: 16, scale: 6 }).notNull(),
    purityFineness: numeric('purity_fineness', { precision: 6, scale: 4 }).notNull(),
    purityKarat: numeric('purity_karat', { precision: 6, scale: 4 }).notNull(),
    passportRef: varchar('passport_ref', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdByActorId: varchar('created_by_actor_id', { length: 64 }),
    updatedByActorId: varchar('updated_by_actor_id', { length: 64 }),
  },
  (table) => [
    index('inventory_items_tenant_status_idx').on(table.tenantId, table.status),
    index('inventory_items_variant_idx').on(table.productVariantId),
    index('inventory_items_location_idx').on(table.locationId),
    uniqueIndex('inventory_items_tenant_serial_uniq')
      .on(table.tenantId, table.serialNumber)
      .where(sql`"serial_number" IS NOT NULL`),
  ]
);

export type InventoryItemRecord = typeof inventoryItemsTable.$inferSelect;
export type InsertInventoryItemRecord = typeof inventoryItemsTable.$inferInsert;

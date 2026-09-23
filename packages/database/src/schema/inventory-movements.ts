import { pgTable, varchar, numeric, timestamp, text, index } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { inventoryItemsTable } from './inventory-items.js';
import { inventoryLocationsTable } from './inventory-locations.js';

export const inventoryMovementsTable = pgTable(
  'inventory_movements',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    inventoryItemId: varchar('inventory_item_id', { length: 64 })
      .notNull()
      .references(() => inventoryItemsTable.id, { onDelete: 'cascade' }),
    movementType: varchar('movement_type', { length: 32 }).notNull(),
    fromLocationId: varchar('from_location_id', { length: 64 }).references(
      () => inventoryLocationsTable.id,
      { onDelete: 'set null' }
    ),
    toLocationId: varchar('to_location_id', { length: 64 }).references(
      () => inventoryLocationsTable.id,
      { onDelete: 'set null' }
    ),
    fromStatus: varchar('from_status', { length: 32 }).notNull(),
    toStatus: varchar('to_status', { length: 32 }).notNull(),
    quantity: numeric('quantity', { precision: 16, scale: 4 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    actorId: varchar('actor_id', { length: 64 }).notNull(),
    actorType: varchar('actor_type', { length: 32 }).notNull(),
    reference: varchar('reference', { length: 255 }),
    notes: text('notes'),
  },
  (table) => [
    index('inventory_movements_item_idx').on(table.inventoryItemId, table.occurredAt),
    index('inventory_movements_tenant_idx').on(table.tenantId, table.occurredAt),
  ]
);

export type InventoryMovementRecord = typeof inventoryMovementsTable.$inferSelect;
export type InsertInventoryMovementRecord = typeof inventoryMovementsTable.$inferInsert;

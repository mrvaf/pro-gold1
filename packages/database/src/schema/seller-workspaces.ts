import { pgTable, varchar, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { storesTable } from './stores.js';
import { sellerProfilesTable } from './seller-profiles.js';

export const sellerWorkspacesTable = pgTable(
  'seller_workspaces',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    sellerProfileId: varchar('seller_profile_id', { length: 128 })
      .notNull()
      .references(() => sellerProfilesTable.id, { onDelete: 'cascade' }),
    storeId: varchar('store_id', { length: 64 }).references(() => storesTable.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
    settingsJson: text('settings_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdByActorType: varchar('created_by_actor_type', { length: 32 }).notNull().default('SYSTEM'),
    createdByActorId: varchar('created_by_actor_id', { length: 128 }).notNull().default('system'),
    updatedByActorType: varchar('updated_by_actor_type', { length: 32 }).notNull().default('SYSTEM'),
    updatedByActorId: varchar('updated_by_actor_id', { length: 128 }).notNull().default('system'),
  },
  (table) => [
    uniqueIndex('seller_workspaces_seller_uniq').on(table.sellerProfileId),
    index('seller_workspaces_tenant_status_idx').on(table.tenantId, table.status),
    index('seller_workspaces_store_idx').on(table.storeId),
  ]
);

export type SellerWorkspaceRecord = typeof sellerWorkspacesTable.$inferSelect;
export type InsertSellerWorkspaceRecord = typeof sellerWorkspacesTable.$inferInsert;

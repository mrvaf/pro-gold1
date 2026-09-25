import { pgTable, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { productsTable } from './products.js';
import { productVariantsTable } from './product-variants.js';
import { studio3dAssetsTable } from './studio-3d-assets.js';

export const tryOnSessionsTable = pgTable(
  'try_on_sessions',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    productId: varchar('product_id', { length: 128 })
      .notNull()
      .references(() => productsTable.id, { onDelete: 'cascade' }),
    variantId: varchar('variant_id', { length: 128 }).references(
      () => productVariantsTable.id,
      { onDelete: 'cascade' }
    ),
    asset3dId: varchar('asset_3d_id', { length: 128 })
      .notNull()
      .references(() => studio3dAssetsTable.id, { onDelete: 'cascade' }),
    anchoringJson: text('anchoring_json').notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    signedAssetUrl: text('signed_asset_url').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('try_on_sessions_tenant_idx').on(table.tenantId),
    index('try_on_sessions_product_idx').on(table.productId),
    index('try_on_sessions_expires_idx').on(table.expiresAt),
  ]
);

export type TryOnSessionRecord = typeof tryOnSessionsTable.$inferSelect;
export type InsertTryOnSessionRecord = typeof tryOnSessionsTable.$inferInsert;

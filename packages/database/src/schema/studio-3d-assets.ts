import { pgTable, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { productsTable } from './products.js';
import { productVariantsTable } from './product-variants.js';

export const studio3dAssetsTable = pgTable(
  'studio_3d_assets',
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
    format: varchar('format', { length: 16 }).notNull(),
    mimeType: varchar('mime_type', { length: 64 }).notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    storageKey: text('storage_key').notNull(),
    boundingBoxJson: text('bounding_box_json').notNull(),
    materialJson: text('material_json').notNull(),
    lodLevels: integer('lod_levels').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('studio_3d_assets_tenant_idx').on(table.tenantId),
    index('studio_3d_assets_product_idx').on(table.productId),
  ]
);

export type Studio3DAssetRecord = typeof studio3dAssetsTable.$inferSelect;
export type InsertStudio3DAssetRecord = typeof studio3dAssetsTable.$inferInsert;

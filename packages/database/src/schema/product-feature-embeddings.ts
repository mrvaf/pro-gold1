import { pgTable, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { productsTable } from './products.js';
import { productVariantsTable } from './product-variants.js';

export const productFeatureEmbeddingsTable = pgTable(
  'product_feature_embeddings',
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
    featureDimensions: integer('feature_dimensions').notNull(),
    embeddingJson: text('embedding_json').notNull(),
    metadataJson: text('metadata_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('product_feature_embeddings_tenant_idx').on(table.tenantId),
    index('product_feature_embeddings_product_idx').on(table.productId),
  ]
);

export type ProductFeatureEmbeddingRecord = typeof productFeatureEmbeddingsTable.$inferSelect;
export type InsertProductFeatureEmbeddingRecord = typeof productFeatureEmbeddingsTable.$inferInsert;

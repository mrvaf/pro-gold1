import { pgTable, varchar, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { sellerProfilesTable } from './seller-profiles.js';
import { productsTable } from './products.js';
import { productVariantsTable } from './product-variants.js';

export const sellerListingsTable = pgTable(
  'seller_listings',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    sellerProfileId: varchar('seller_profile_id', { length: 128 })
      .notNull()
      .references(() => sellerProfilesTable.id, { onDelete: 'cascade' }),
    productId: varchar('product_id', { length: 64 })
      .notNull()
      .references(() => productsTable.id, { onDelete: 'cascade' }),
    productVariantId: varchar('product_variant_id', { length: 64 })
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 150 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 32 }).notNull().default('DRAFT'),
    visibility: varchar('visibility', { length: 32 }).notNull().default('PUBLIC'),
    tagsJson: text('tags_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdByActorType: varchar('created_by_actor_type', { length: 32 }).notNull().default('SYSTEM'),
    createdByActorId: varchar('created_by_actor_id', { length: 128 }).notNull().default('system'),
    updatedByActorType: varchar('updated_by_actor_type', { length: 32 }).notNull().default('SYSTEM'),
    updatedByActorId: varchar('updated_by_actor_id', { length: 128 }).notNull().default('system'),
  },
  (table) => [
    uniqueIndex('seller_listings_seller_variant_uniq').on(table.sellerProfileId, table.productVariantId),
    index('seller_listings_tenant_status_idx').on(table.tenantId, table.status),
    index('seller_listings_seller_status_idx').on(table.sellerProfileId, table.status),
    index('seller_listings_variant_idx').on(table.productVariantId),
  ]
);

export type SellerListingRecord = typeof sellerListingsTable.$inferSelect;
export type InsertSellerListingRecord = typeof sellerListingsTable.$inferInsert;

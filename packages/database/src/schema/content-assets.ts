import { pgTable, varchar, timestamp, text, jsonb } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { productsTable } from './products.js';

export const contentAssetsTable = pgTable('content_assets', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 })
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  productId: varchar('product_id', { length: 64 })
    .references(() => productsTable.id, { onDelete: 'set null' }),
  contentType: varchar('content_type', { length: 64 }).notNull(),
  language: varchar('language', { length: 32 }).notNull().default('fa-IR'),
  headline: varchar('headline', { length: 500 }).notNull(),
  body: text('body').notNull(),
  tags: jsonb('tags'),
  groundingAttributes: jsonb('grounding_attributes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
